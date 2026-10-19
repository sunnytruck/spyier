import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '../data/classes';
import { createRun, previewRunEventChoice, reduceRun } from '../engine/run';
import { deserializeRun, isValidRunState, serializeRun } from '../engine/runPersistence';
import type { ClassId } from '../types/game';
import type { MapNode, RunState } from '../types/run';

type UpgradeEventId = 'morning_circle' | 'restless_mirror';

/** A connected, visited route makes these room fixtures valid persisted runs. */
function eventRoom(classId?: ClassId, eventId: UpgradeEventId = 'morning_circle', seed = 'preview-event'): RunState {
  const state = createRun(seed, classId);
  const nodes = new Map(state.map.nodes.map((node) => [node.id, node]));
  function findEvent(node: MapNode, path: MapNode[]): MapNode[] | undefined {
    const route = [...path, node];
    if (node.type === 'event') return route;
    for (const id of node.connections) {
      const found = findEvent(nodes.get(id)!, route);
      if (found) return found;
    }
    return undefined;
  }
  const route = state.map.nodes.filter((node) => node.floor === 1)
    .map((node) => findEvent(node, []))
    .find((path) => path !== undefined)!;
  return {
    ...state,
    screen: 'event',
    floor: route.length,
    currentNodeId: route.at(-1)!.id,
    visited: route.map((node) => node.id),
    eventId,
    hp: state.maxHp - 12,
    gold: 100,
  };
}

describe('event upgrades preview the actual seeded result without committing it', () => {
  for (const classId of [undefined, ...CLASS_IDS]) {
    it.each(['morning_circle', 'restless_mirror'] as const)(
      `${classId ?? 'legacy'} / %s keeps preview, cost and committed card in agreement`,
      (eventId) => {
        const state = eventRoom(classId, eventId, `event-preview-${classId ?? 'legacy'}-${eventId}`);
        expect(isValidRunState(state)).toBe(true);
        const snapshot = structuredClone(state);
        const saved = serializeRun(state);
        const preview = previewRunEventChoice(state, 0)!;
        expect(preview.upgrades).toHaveLength(1);
        const { before, after } = preview.upgrades[0];
        expect(state.deck).toContainEqual(before);
        expect(before.upgraded).toBe(false);
        expect(after).toEqual({ ...before, upgraded: true });

        // Reopening/canceling a modal cannot reroll the random target or spend the reward.
        for (let open = 0; open < 5; open++)
          expect(previewRunEventChoice(state, 0)).toEqual(preview);
        expect(state).toEqual(snapshot);
        expect(state.screen).toBe('event');
        expect(serializeRun(state)).toBe(saved);
        const restored = deserializeRun(saved)!;
        expect(previewRunEventChoice(restored, 0)).toEqual(preview);

        const committed = reduceRun(state, { type: 'eventChoice', index: 0 });
        const changes = committed.deck.filter((card, index) => card.upgraded !== state.deck[index].upgraded);
        expect(changes).toEqual([after]);
        expect(committed.screen).toBe('map');
        expect(committed.gold).toBe(state.gold - (eventId === 'morning_circle' ? 35 : 0));
        expect(committed.hp).toBe(state.hp - (eventId === 'restless_mirror' ? 6 : 0));
        expect(committed.rngState).not.toBe(state.rngState);
        expect(reduceRun(restored, { type: 'eventChoice', index: 0 })).toEqual(committed);
        expect(deserializeRun(serializeRun(committed))).toEqual(committed);
        expect(previewRunEventChoice(committed, 0)).toBeNull();
        expect(state).toEqual(snapshot);
      },
    );
  }

  it('varies the target by saved RNG and never chooses a previously upgraded instance', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const state = eventRoom('assassin', 'morning_circle', `preview-target-${seed}`);
      state.deck[0].upgraded = true;
      state.deck[3].upgraded = true;
      const result = previewRunEventChoice(state, 0)!;
      expect(result.upgrades).toHaveLength(1);
      const target = result.upgrades[0].before;
      expect(target.upgraded).toBe(false);
      expect(target.uid).not.toBe(state.deck[0].uid);
      expect(target.uid).not.toBe(state.deck[3].uid);
      expect(reduceRun(state, { type: 'eventChoice', index: 0 }).deck)
        .toContainEqual(result.upgrades[0].after);
      seen.add(target.uid);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('can preview the final unupgraded instance without presenting an already upgraded twin', () => {
    const state = eventRoom('machinist');
    state.deck = state.deck.map((card, index) => ({ ...card, upgraded: index !== 2 }));
    const preview = previewRunEventChoice(state, 0)!;
    expect(preview.upgrades.map(({ before }) => before.uid)).toEqual([state.deck[2].uid]);
    const after = reduceRun(state, { type: 'eventChoice', index: 0 });
    expect(after.deck.every((card) => card.upgraded)).toBe(true);
  });

  it('returns detached preview instances, so changing a presentation cannot alter the run', () => {
    const state = eventRoom('oracle');
    const saved = serializeRun(state);
    const preview = previewRunEventChoice(state, 0)!;
    preview.upgrades[0].before.upgraded = true;
    preview.upgrades[0].after.cardId = 'presentation-only';
    expect(serializeRun(state)).toBe(saved);
    const reopened = previewRunEventChoice(state, 0)!;
    expect(reopened.upgrades[0].before.upgraded).toBe(false);
    expect(reopened.upgrades[0].after.cardId).not.toBe('presentation-only');
  });

  it('rejects unavailable, lethal, missing and non-upgrade choices without advancing anything', () => {
    const state = eventRoom('necromancer');
    const unavailable: Array<[RunState, number]> = [
      [{ ...state, gold: 34 }, 0],
      [{ ...state, eventId: 'restless_mirror', hp: 6 }, 0],
      [{ ...state, deck: state.deck.map((card) => ({ ...card, upgraded: true })) }, 0],
      [{ ...state, screen: 'map', eventId: null }, 0],
      [{ ...state, screen: 'rest', eventId: null }, 0],
      [{ ...state, eventId: 'unknown' }, 0],
      [state, -1],
      [state, 0.5],
      [state, Number.NaN],
      [state, 999],
      [state, 1],
      [state, 2],
    ];
    for (const [run, choice] of unavailable) {
      const snapshot = structuredClone(run);
      expect(previewRunEventChoice(run, choice)).toBeNull();
      expect(run).toEqual(snapshot);
    }
  });
});

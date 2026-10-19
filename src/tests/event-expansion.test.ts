import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import { CLASS_IDS } from '../data/classes';
import { ENEMY_DEFINITIONS } from '../data/enemies';
import { EVENT_DEFINITIONS, EVENT_IDS } from '../data/events';
import { RELIC_DEFINITIONS, eligibleRelicIds } from '../data/relics';
import { canChooseEvent, createRun, eligibleEventIds, reduceRun } from '../engine/run';
import { deserializeRun, isValidRunState, serializeRun } from '../engine/runPersistence';
import { getEnemies, getEnemyKey } from '../engine';
import type { ClassId } from '../types/game';
import type { MapNode, RunState } from '../types/run';

const ORIGINAL_EVENTS = ['sun_clock', 'shared_altar', 'moss_garden', 'morning_circle', 'restless_mirror'];
const NEW_EVENTS = EVENT_IDS.filter((id) => !ORIGINAL_EVENTS.includes(id));

function eventRoom(eventId: string, classId?: ClassId, seed = 'expanded-event'): RunState {
  const state = createRun(seed, classId);
  const byId = new Map(state.map.nodes.map((node) => [node.id, node]));
  function search(node: MapNode, path: MapNode[]): MapNode[] | undefined {
    const route = [...path, node];
    if (node.type === 'event') return route;
    for (const nextId of node.connections) {
      const route = search(byId.get(nextId)!, [...path, node]);
      if (route) return route;
    }
    return undefined;
  }
  const route = state.map.nodes.filter((node) => node.floor === 1)
    .map((node) => search(node, [])).find((path) => path !== undefined)!;
  return { ...state, screen: 'event', eventId, floor: route.length,
    currentNodeId: route.at(-1)!.id, visited: route.map((node) => node.id),
    hp: state.maxHp - 20, gold: 200 };
}

function fixtureBeforeEvent(state: RunState): RunState {
  return { ...state, screen: 'map', eventId: null, eventResult: null,
    floor: state.floor - 1, currentNodeId: state.visited.at(-2) ?? null,
    visited: state.visited.slice(0, -1) };
}

describe('expanded events are implemented content, not description-only rewards', () => {
  it('adds thirteen events, including five exclusive profession encounters', () => {
    expect(NEW_EVENTS.length).toBeGreaterThanOrEqual(10);
    expect(NEW_EVENTS.filter((id) => EVENT_DEFINITIONS[id].classIds)).toHaveLength(5);
    for (const event of Object.values(EVENT_DEFINITIONS)) {
      expect(event.id).toBeTruthy();
      expect(event.choices.length).toBeGreaterThanOrEqual(2);
      for (const choice of event.choices) for (const effect of choice.effects) {
        if (effect.type === 'card') {
          expect(CARD_DEFINITIONS[effect.cardId], `${event.id}/${effect.cardId}`).toBeDefined();
          for (const id of effect.pool?.cardIds ?? []) expect(CARD_DEFINITIONS[id], id).toBeDefined();
        }
        if (effect.type === 'battle')
          for (const id of effect.enemyIds) expect(ENEMY_DEFINITIONS[id], id).toBeDefined();
      }
    }
  });

  for (const classId of [undefined, ...CLASS_IDS]) {
    for (const eventId of EVENT_IDS.filter((id) => {
      const classes = EVENT_DEFINITIONS[id].classIds;
      return !classes || (classId !== undefined && classes.includes(classId));
    })) {
      it.each(EVENT_DEFINITIONS[eventId].choices.map((_, index) => index))(
        `${classId ?? 'legacy'} / ${eventId} choice %i commits once and persists its exact result`,
        (index) => {
          const before = eventRoom(eventId, classId, `expanded-${classId ?? 'legacy'}-${eventId}-${index}`);
          const snapshot = structuredClone(before);
          expect(isValidRunState(before)).toBe(true);
          expect(canChooseEvent(before, index)).toBe(true);
          const result = reduceRun(before, { type: 'eventChoice', index });
          expect(before).toEqual(snapshot);
          expect(result.screen).toBe('eventResult');
          expect(result.eventResult?.choiceIndex).toBe(index);
          expect(result.eventResult?.hpChange).toBe(result.hp - before.hp);
          expect(result.eventResult?.goldChange).toBe(result.gold - before.gold);
          expect(result.eventResult?.description).not.toHaveLength(0);
          expect(isValidRunState(result)).toBe(true);
          const restored = deserializeRun(serializeRun(result))!;
          expect(restored).toEqual(result);
          expect(reduceRun(result, { type: 'eventChoice', index })).toBe(result);
          expect(reduceRun(restored, { type: 'eventChoice', index })).toBe(restored);
          expect(reduceRun(before, { type: 'eventChoice', index })).toEqual(result);
          const continued = reduceRun(restored, { type: 'continueEvent' });
          expect(continued.screen).toBe(result.eventResult?.combatEnemyIds ? 'combat' : 'map');
          expect(reduceRun(continued, { type: 'continueEvent' })).toBe(continued);
          expect(deserializeRun(serializeRun(continued))).toEqual(continued);
          const choice = EVENT_DEFINITIONS[eventId].choices[index];
          if (choice.effects.some((effect) => effect.type === 'upgrade')) {
            expect(result.eventResult!.upgradedCards).toHaveLength(1);
            expect(result.deck.filter((card) => card.upgraded)).toHaveLength(1);
          }
          if (choice.effects.some((effect) => effect.type === 'remove'))
            expect(result.deck).toHaveLength(before.deck.length - 1);
          for (const id of result.eventResult!.relicIds) {
            expect(eligibleRelicIds(classId)).toContain(id);
            expect(RELIC_DEFINITIONS[id]).toBeDefined();
          }
        },
      );
    }
  }

  it('charges neither cost nor RNG for impossible choices', () => {
    const insufficientGold = eventRoom('stone_eraser', 'berserker'); insufficientGold.gold = 44;
    const lethal = eventRoom('blood_quarry', 'assassin'); lethal.hp = 11;
    const tinyDeck = eventRoom('stone_eraser', 'oracle'); tinyDeck.deck = tinyDeck.deck.slice(0, 5);
    const noUpgrade = eventRoom('morning_circle', 'machinist'); noUpgrade.deck.forEach((card) => { card.upgraded = true; });
    const fullPotions = eventRoom('amber_exchange', 'necromancer'); fullPotions.potions = ['spring_water', 'spring_water', 'spring_water'];
    const noRelic = eventRoom('sealed_mine', 'berserker'); noRelic.relicIds = eligibleRelicIds('berserker');
    const wrongClass = eventRoom('fist_trial', 'assassin');
    for (const state of [insufficientGold, lethal, tinyDeck, noUpgrade, fullPotions, noRelic, wrongClass]) {
      const snapshot = structuredClone(state);
      expect(canChooseEvent(state, 0)).toBe(false);
      expect(reduceRun(state, { type: 'eventChoice', index: 0 })).toBe(state);
      expect(state).toEqual(snapshot);
    }
  });

  it('never upgrades the unplayable curse and does not let it alone enable paid upgrades', () => {
    const state = eventRoom('morning_circle', 'assassin');
    state.deck.forEach((card) => { card.upgraded = true; });
    state.deck.push({ uid: `card-${state.nextCardId++}`, cardId: 'stone_doubt', upgraded: false });
    expect(canChooseEvent(state, 0)).toBe(false);
    state.deck[3].upgraded = false;
    const result = reduceRun(state, { type: 'eventChoice', index: 0 });
    expect(result.eventResult?.upgradedCards.map((card) => card.uid)).toEqual([state.deck[3].uid]);
    expect(result.deck.at(-1)?.upgraded).toBe(false);
  });

  it('uses fixed curse rewards independently of class pools and saves their actual card instances', () => {
    for (const classId of CLASS_IDS) {
      const before = eventRoom('stone_contract', classId);
      const after = reduceRun(before, { type: 'eventChoice', index: 0 });
      expect(after.gold - before.gold).toBe(90);
      expect(after.deck.at(-1)?.cardId).toBe('stone_doubt');
      expect(after.eventResult!.addedCards).toEqual([after.deck.at(-1)]);
      expect(after.eventResult!.description).toContain(CARD_DEFINITIONS.stone_doubt.name);
      expect(deserializeRun(serializeRun(after))).toEqual(after);
    }
  });
});

describe('saved event selection and event battles', () => {
  it('excludes the last three encounters while preserving seeded reproducibility', () => {
    const source = eventRoom('sun_clock', 'machinist');
    const history = ['sun_clock', 'blood_quarry', 'core_workshop'];
    const before = { ...fixtureBeforeEvent(source), eventHistory: history };
    const available = eligibleEventIds(before);
    expect(available).not.toContain('sun_clock');
    expect(available).not.toContain('blood_quarry');
    expect(available).not.toContain('core_workshop');
    const nodeId = source.currentNodeId!;
    const entered = reduceRun(before, { type: 'chooseNode', nodeId });
    expect(available).toContain(entered.eventId);
    expect(entered.eventHistory).toEqual([...history, entered.eventId]);
    expect(entered).toEqual(reduceRun(before, { type: 'chooseNode', nodeId }));
    expect(deserializeRun(serializeRun(entered))).toEqual(entered);
    const restored = deserializeRun(serializeRun(entered))!;
    expect(reduceRun(restored, { type: 'chooseNode', nodeId })).toBe(restored);
    expect(restored.eventId).toBe(entered.eventId);
  });

  it('offers each class only its own exclusive event and the general pool', () => {
    for (const classId of CLASS_IDS) {
      const pool = eligibleEventIds({ classId });
      const exclusive = pool.filter((id) => EVENT_DEFINITIONS[id].classIds);
      expect(exclusive).toHaveLength(1);
      expect(EVENT_DEFINITIONS[exclusive[0]].classIds).toContain(classId);
    }
    expect(eligibleEventIds({}).every((id) => !EVENT_DEFINITIONS[id].classIds)).toBe(true);
  });

  it('loads old version-2 event saves with absent extension fields without changing RNG', () => {
    const state = eventRoom('morning_circle', 'oracle');
    delete state.eventHistory; delete state.eventResult; delete state.eventCombat;
    const loaded = deserializeRun(serializeRun(state))!;
    expect(loaded).toEqual(state);
    expect(reduceRun(loaded, { type: 'eventChoice', index: 0 })).toEqual(reduceRun(state, { type: 'eventChoice', index: 0 }));
  });

  it('starts an event battle once, then grants its extra gold and relic through ordinary rewards', () => {
    const before = eventRoom('resonance_gate', 'berserker');
    const chosen = reduceRun(before, { type: 'eventChoice', index: 0 });
    expect(chosen.screen).toBe('eventResult');
    expect(chosen.eventResult!.combatEnemyIds).toEqual(['resonance_sentinel']);
    let fighting = reduceRun(deserializeRun(serializeRun(chosen))!, { type: 'continueEvent' });
    expect(fighting.screen).toBe('combat');
    expect(fighting.eventCombat).toEqual({ eventId: 'resonance_gate', bonusGold: 35, relicOnVictory: true });
    expect(deserializeRun(serializeRun(fighting))).toEqual(fighting);
    expect(reduceRun(fighting, { type: 'continueEvent' })).toBe(fighting);
    // Fixture isolates terminal reward routing; the attack and reward are still public actions.
    getEnemies(fighting.combat!)[0].hp = 1;
    fighting.combat!.enemy.hp = 1;
    const attack = fighting.combat!.hand.find((card) => CARD_DEFINITIONS[card.cardId].type === 'attack')!;
    const won = reduceRun(fighting, { type: 'combat', action: { type: 'playCard', cardId: attack.uid, targetId: getEnemyKey(fighting.combat!.enemy) } });
    expect(won.screen).toBe('reward');
    expect(won.stats.battlesWon).toBe(1);
    expect(won.stats.elitesDefeated).toBe(0);
    expect(won.reward!.gold).toBeGreaterThanOrEqual(53);
    expect(won.reward!.gold).toBeLessThanOrEqual(65);
    expect(won.reward!.relicId).not.toBeNull();
    expect(deserializeRun(serializeRun(won))).toEqual(won);
    const relic = reduceRun(won, { type: 'takeCard', cardId: null });
    expect(relic.screen).toBe('relic');
    expect(deserializeRun(serializeRun(relic))).toEqual(relic);
    const done = reduceRun(relic, { type: 'takeRelic' });
    expect(done.screen).toBe('map');
    expect(done.eventCombat).toBeNull();
    expect(done.eventId).toBeNull();
    expect(reduceRun(done, { type: 'takeRelic' })).toBe(done);
    expect(deserializeRun(serializeRun(done))).toEqual(done);
  });

  it('saves a defeat in an optional event fight without returning an unearned reward', () => {
    let run = eventRoom('resonance_gate', 'assassin'); run.hp = 1; run.potions = [null, null, null];
    run = reduceRun(reduceRun(run, { type: 'eventChoice', index: 0 }), { type: 'continueEvent' });
    for (let turn = 0; turn < 5 && run.screen === 'combat'; turn++)
      run = reduceRun(run, { type: 'combat', action: { type: 'endTurn' } });
    expect(run.screen).toBe('defeat');
    expect(run.reward).toBeNull();
    expect(run.gold).toBe(200);
    expect(deserializeRun(serializeRun(run))).toEqual(run);
  });

  it('rejects malformed result envelopes rather than rerolling a damaged event save', () => {
    const result = reduceRun(eventRoom('morning_circle', 'oracle'), { type: 'eventChoice', index: 0 });
    const invalid: RunState[] = [
      { ...result, eventResult: null },
      { ...result, screen: 'event' },
      { ...result, eventHistory: ['unknown'] },
      { ...result, eventResult: { ...result.eventResult!, eventId: 'sun_clock' } },
      { ...result, eventResult: { ...result.eventResult!, upgradedCards: [{ ...result.deck[0], uid: 'missing', upgraded: true }] } },
      { ...result, eventCombat: { eventId: 'morning_circle', bonusGold: 10, relicOnVictory: true } },
    ];
    for (const state of invalid) {
      expect(isValidRunState(state)).toBe(false);
      expect(deserializeRun(JSON.stringify({ version: 2, run: state }))).toBeNull();
    }
  });

  it('rejects injected enemies or bonus rewards in event battle saves', () => {
    const pending = reduceRun(eventRoom('resonance_gate', 'oracle'), { type: 'eventChoice', index: 0 });
    const fighting = reduceRun(pending, { type: 'continueEvent' });
    const invalid: RunState[] = [
      { ...pending, eventResult: { ...pending.eventResult!, combatEnemyIds: ['tower_abbot'] } },
      { ...pending, eventResult: { ...pending.eventResult!, combatReward: { gold: 999, relic: true } } },
      { ...pending, eventResult: { ...pending.eventResult!, combatReward: { gold: 35, relic: false } } },
      { ...pending, eventResult: { ...pending.eventResult!, combatEnemyIds: undefined, combatReward: undefined } },
      { ...fighting, eventCombat: { ...fighting.eventCombat!, bonusGold: 999 } },
      { ...fighting, eventCombat: { ...fighting.eventCombat!, relicOnVictory: false } },
    ];
    const peaceful = reduceRun(eventRoom('sun_clock', 'oracle'), { type: 'eventChoice', index: 0 });
    invalid.push({ ...peaceful, eventResult: { ...peaceful.eventResult!, combatEnemyIds: ['resonance_sentinel'], combatReward: { gold: 35, relic: true } } });
    for (const state of invalid) {
      expect(isValidRunState(state)).toBe(false);
      expect(deserializeRun(JSON.stringify({ version: 2, run: state }))).toBeNull();
    }
  });
});

import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import { CLASS_IDS } from '../data/classes';
import { isRelicEligible } from '../data/relics';
import { getEnemies } from '../engine';
import { createRun, getAvailableNodes, reduceRun } from '../engine/run';
import { deserializeRun, isValidRunState, serializeRun } from '../engine/runPersistence';
import type { ClassId } from '../types/game';
import type { RunAction, RunState } from '../types/run';
import oldSaves from './fixtures/pre-expansion-saves.json';
import { createRoguelikeDriver } from './helpers/roguelikeDriver';
import type { RoutePolicy } from './helpers/roguelikeDriver';

function assertInventory(state: RunState): void {
  expect(state.hp).toBeGreaterThanOrEqual(0);
  expect(state.hp).toBeLessThanOrEqual(state.maxHp);
  expect(Number.isSafeInteger(state.gold) && state.gold >= 0).toBe(true);
  expect(new Set(state.deck.map((card) => card.uid)).size).toBe(state.deck.length);
  expect(new Set(state.relicIds).size).toBe(state.relicIds.length);
  if (state.screen === 'reward') {
    const cards = state.reward!.cardIds;
    expect(new Set(cards).size).toBe(cards.length);
    for (const id of cards) {
      const definition = CARD_DEFINITIONS[id];
      expect(definition).toBeDefined();
      expect(definition.classId).toBe(state.classId);
      expect(definition.tokenOnly).not.toBe(true);
      expect(definition.unplayable).not.toBe(true);
      expect(definition.effects.length).toBeGreaterThan(0);
      expect(definition.upgradedEffects.length).toBeGreaterThan(0);
    }
    if (state.reward!.relicId) expect(isRelicEligible(state.reward!.relicId!, state.classId)).toBe(true);
  }
  if (state.combat) {
    expect(state.combat.classId).toBe(state.classId);
    expect(state.combat.player.hp).toBe(state.hp);
    expect(new Set(getEnemies(state.combat).map((enemy) => enemy.instanceId ?? enemy.id)).size)
      .toBe(getEnemies(state.combat).length);
  }
}

const campaigns = (['safe', 'elite', 'varied'] as RoutePolicy[]).flatMap((policy) =>
  CLASS_IDS.flatMap((classId) => [0, 1].map((index) => ({
    policy, classId, seed: `roguelike-regression-${index}`,
  }))),
);

describe('expanded roguelike campaigns through public game actions', () => {
  it.each(campaigns)('$classId / $policy / $seed has reproducible legal decisions and a genuine terminal result', ({ classId, seed, policy }) => {
    let state = createRun(seed, classId);
    const decide = createRoguelikeDriver(policy, seed);
    const replayDecide = createRoguelikeDriver(policy, seed);
    const originalMap = JSON.stringify(state.map);
    const visited: string[] = [];
    for (let step = 0; step < 2400 && !['victory', 'defeat'].includes(state.screen); step++) {
      expect(isValidRunState(state), `${state.screen} floor ${state.floor} step ${step}`).toBe(true);
      assertInventory(state);
      const before = serializeRun(state);
      const restored = deserializeRun(before)!;
      expect(restored).not.toBeNull();
      expect(serializeRun(restored)).toBe(before);
      const action = decide(state);
      expect(replayDecide(restored)).toEqual(action);
      if (action.type === 'chooseNode') {
        const available = getAvailableNodes(state);
        expect(available.map((node) => node.id)).toContain(action.nodeId);
        const chosen = available.find((node) => node.id === action.nodeId)!;
        expect(chosen.floor).toBe(state.floor + 1);
        expect(state.visited).not.toContain(chosen.id);
        const locked = state.map.nodes.find((node) => !available.some((option) => option.id === node.id));
        if (locked) expect(reduceRun(state, { type: 'chooseNode', nodeId: locked.id })).toBe(state);
        visited.push(chosen.id);
      }
      const next = reduceRun(state, action);
      expect(next, `stalled ${state.screen}: ${JSON.stringify(action)}`).not.toBe(state);
      expect(serializeRun(state)).toBe(before);
      expect(reduceRun(restored, action)).toEqual(next);
      expect(JSON.stringify(next.map)).toBe(originalMap);
      state = next;
    }
    expect(['victory', 'defeat']).toContain(state.screen);
    expect(state.visited).toEqual(visited);
    expect(isValidRunState(state)).toBe(true);
    assertInventory(state);
    if (state.screen === 'victory') {
      expect(state.floor).toBe(12);
      expect(state.hp).toBeGreaterThan(0);
      expect(visited).toHaveLength(12);
    } else expect(state.hp).toBe(0);
    expect(deserializeRun(serializeRun(state))).toEqual(state);
  }, 30000);
});

function reachScreen(classId: ClassId, screen: RunState['screen'], policy: RoutePolicy): RunState {
  let state = createRun(`roguelike-claim-${classId}`, classId);
  const decide = createRoguelikeDriver(policy, state.seed);
  for (let step = 0; step < 1200 && state.screen !== screen; step++) {
    if (state.screen === 'defeat' || state.screen === 'victory') break;
    const next = reduceRun(state, decide(state));
    if (next === state) throw new Error(`No progress toward ${screen}`);
    state = next;
  }
  return state;
}

describe('card and relic claims remain atomic across reload and repeated actions', () => {
  it.each(CLASS_IDS)('%s receives card rewards and already-credited gold exactly once', (classId) => {
    const reward = reachScreen(classId, 'reward', 'safe');
    expect(reward.screen).toBe('reward');
    const offered = reward.reward!.cardIds[0];
    expect(offered).toBeDefined();
    const action: RunAction = { type: 'takeCard', cardId: offered };
    const next = reduceRun(reward, action);
    expect(next.deck).toHaveLength(reward.deck.length + 1);
    expect(next.deck.at(-1)?.cardId).toBe(offered);
    expect(next.gold).toBe(reward.gold);
    expect(next.potions).toEqual(reward.potions);
    expect(next.stats.cardsAdded).toBe(reward.stats.cardsAdded + 1);
    expect(reduceRun(next, action)).toBe(next);
    const restored = deserializeRun(serializeRun(next))!;
    expect(reduceRun(restored, action)).toBe(restored);
    expect(restored.deck).toEqual(next.deck);
    expect(restored.gold).toBe(next.gold);
    expect(reduceRun(reward, { type: 'takeCard', cardId: 'missing-card' })).toBe(reward);
    expect(reduceRun(reward, { type: 'combat', action: { type: 'endTurn' } })).toBe(reward);
  });

  it.each(CLASS_IDS)('%s receives the saved relic once without rerolling or duplicating it', (classId) => {
    const reward = reachScreen(classId, 'relic', 'elite');
    expect(reward.screen).toBe('relic');
    const id = reward.reward!.relicId!;
    expect(id).toBeTruthy();
    expect(reward.relicIds).not.toContain(id);
    const restoredBefore = deserializeRun(serializeRun(reward))!;
    const next = reduceRun(reward, { type: 'takeRelic' });
    expect(reduceRun(restoredBefore, { type: 'takeRelic' })).toEqual(next);
    expect(next.relicIds).toEqual([...reward.relicIds, id]);
    expect(next.gold).toBe(reward.gold);
    expect(reduceRun(next, { type: 'takeRelic' })).toBe(next);
    const restored = deserializeRun(serializeRun(next))!;
    expect(reduceRun(restored, { type: 'takeRelic' })).toBe(restored);
  });
});

describe('old saved map choices are retained instead of regenerated', () => {
  it.each(Object.entries(oldSaves))('continues %s with its original room types, edges and chosen route', (_name, envelope) => {
    const original = JSON.stringify(envelope);
    let state = deserializeRun(original)!;
    expect(state).not.toBeNull();
    const savedMap = JSON.stringify(envelope.run.map);
    expect(JSON.stringify(state.map)).toBe(savedMap);
    const decide = createRoguelikeDriver('safe', state.seed);
    for (let step = 0; step < 12 && !['victory', 'defeat'].includes(state.screen); step++) {
      const next = reduceRun(state, decide(state));
      expect(next).not.toBe(state);
      expect(JSON.stringify(next.map)).toBe(savedMap);
      state = deserializeRun(serializeRun(next))!;
      expect(JSON.stringify(state.map)).toBe(savedMap);
    }
    expect(JSON.stringify(envelope)).toBe(original);
  });
});

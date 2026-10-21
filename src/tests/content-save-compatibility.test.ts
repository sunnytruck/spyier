import { describe, expect, it } from 'vitest';
import fixture from './fixtures/pre-content-boss-reward.json';
import { CARD_DEFINITIONS } from '../data/cards';
import { getCardPool } from '../engine/cardPools';
import { createBlessedRun, reduceRun } from '../engine/run';
import { deserializeRun, isValidRunState, serializeRun } from '../engine/runPersistence';
import type { RunState } from '../types/run';
import { createRoguelikeDriver } from './helpers/roguelikeDriver';

const originalSave = JSON.stringify(fixture.save);

function loadHistoricalBoss(): RunState {
  const restored = deserializeRun(originalSave);
  expect(restored).not.toBeNull();
  return restored!;
}

let freshBoss: RunState | undefined;
function currentBossReward(): RunState {
  if (freshBoss) return structuredClone(freshBoss);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const seed = `relic-boss-assassin-${attempt}`;
    const decide = createRoguelikeDriver('safe', seed);
    let state = createBlessedRun(seed, 'assassin');
    for (let step = 0; step < 1600 && state.screen !== 'defeat'; step += 1) {
      if (state.screen === 'reward' && state.reward?.completesRun) {
        freshBoss = state;
        return structuredClone(state);
      }
      if (state.screen === 'victory') break;
      const action = decide(state);
      const next = reduceRun(state, action);
      expect(next, `${seed}:${step}:${state.screen}:${action.type}`).not.toBe(state);
      state = next;
    }
  }
  throw new Error('Eight legal assassin campaigns did not reach a current boss reward');
}

describe('real pre-content boss reward save compatibility', () => {
  it('loads the unmodified historical three-identical-rare roll after the assassin rare pool grows', () => {
    expect(fixture.sourceCommit).toBe('22e43e8');
    expect(fixture.generator).toMatchObject({ seed: 'relic-boss-assassin-0', actionCount: 123, policy: 'safe' });
    expect(fixture.generator.actionsSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(fixture.save.run.reward.cardIds).toEqual(['assassin_oppress', 'assassin_oppress', 'assassin_oppress']);
    expect(fixture.save.run.reward).not.toHaveProperty('distinctRareCountAtRoll');
    expect(getCardPool('assassin', 'combat').filter((id) => CARD_DEFINITIONS[id].rarity === 'rare').length).toBeGreaterThanOrEqual(3);

    const restored = loadHistoricalBoss();
    expect(restored).toEqual(fixture.save.run);
    expect(isValidRunState(restored)).toBe(true);
    expect(serializeRun(restored)).toBe(originalSave);
    expect(restored.rngState).toBe(806502963);
    expect(restored.reward!.cardIds).toEqual(fixture.save.run.reward.cardIds);
    expect(restored.map).toEqual(fixture.save.run.map);
    expect(restored.deck).toEqual(fixture.save.run.deck);
    expect(restored.blessingHistory).toEqual(fixture.save.run.blessingHistory);
    // Repeated loads never reroll the reward or consume run/combat RNG.
    expect(deserializeRun(serializeRun(restored))).toEqual(restored);
    expect(reduceRun(restored, { type: 'ascendAct' })).toBe(restored);
  });

  it('takes one historical card exactly once, including after saving the resolved reward', () => {
    const before = loadHistoricalBoss();
    const chosen = reduceRun(before, { type: 'takeCard', cardId: 'assassin_oppress' });
    expect(chosen).not.toBe(before);
    expect(chosen.screen).toBe('victory');
    expect(chosen.reward).toBeNull();
    expect(chosen.deck.length).toBe(before.deck.length + 1);
    expect(chosen.deck.filter((card) => card.cardId === 'assassin_oppress').length)
      .toBe(before.deck.filter((card) => card.cardId === 'assassin_oppress').length + 1);
    expect(chosen.stats.cardsAdded).toBe(before.stats.cardsAdded + 1);
    expect(chosen.nextCardId).toBe(before.nextCardId + 1);
    expect(chosen.gold).toBe(before.gold);
    expect(chosen.rngState).toBe(before.rngState);
    expect(serializeRun(before)).toBe(originalSave);

    const saved = deserializeRun(serializeRun(chosen));
    expect(saved).toEqual(chosen);
    expect(reduceRun(saved!, { type: 'takeCard', cardId: 'assassin_oppress' })).toBe(saved);
    expect(reduceRun(saved!, { type: 'takeCard', cardId: null })).toBe(saved);
  });

  it('skips once and safely advances to the next Act without recovering a skipped boss reward', () => {
    const before = loadHistoricalBoss();
    const skipped = reduceRun(before, { type: 'takeCard', cardId: null });
    expect(skipped.screen).toBe('victory');
    expect(skipped.reward).toBeNull();
    expect(skipped.deck).toEqual(before.deck);
    expect(skipped.nextCardId).toBe(before.nextCardId);
    expect(skipped.stats.cardsAdded).toBe(before.stats.cardsAdded);
    expect(skipped.gold).toBe(before.gold);
    expect(skipped.rngState).toBe(before.rngState);
    const saved = deserializeRun(serializeRun(skipped))!;
    expect(saved).toEqual(skipped);
    expect(reduceRun(saved, { type: 'takeCard', cardId: null })).toBe(saved);
    expect(reduceRun(saved, { type: 'takeCard', cardId: 'assassin_oppress' })).toBe(saved);

    const ascended = reduceRun(saved, { type: 'ascendAct' });
    expect(ascended.act).toBe(2);
    expect(ascended.screen).toBe('blessing');
    expect(ascended.blessing!.options).toHaveLength(4);
    expect(ascended.actHistory![0].map).toEqual(before.map);
    expect(ascended.deck).toEqual(before.deck);
    expect(ascended.gold).toBe(before.gold);
    expect(deserializeRun(serializeRun(ascended))).toEqual(ascended);
    expect(reduceRun(ascended, { type: 'takeCard', cardId: 'assassin_oppress' })).toBe(ascended);
  });

  it('keeps the legacy duplicate exception restricted to the historical assassin rare', () => {
    const otherDuplicate = loadHistoricalBoss();
    otherDuplicate.reward!.cardIds = Array(3).fill('assassin_infinite_blades');
    expect(isValidRunState(otherDuplicate)).toBe(false);
    expect(() => serializeRun(otherDuplicate)).toThrow('保存できない探索状態');
    expect(deserializeRun(JSON.stringify({ version: 2, run: otherDuplicate }))).toBeNull();

    const mixedDuplicates = loadHistoricalBoss();
    mixedDuplicates.reward!.cardIds[2] = 'assassin_assassinate';
    expect(isValidRunState(mixedDuplicates)).toBe(false);

    const nonBossMarker = loadHistoricalBoss();
    delete nonBossMarker.reward!.rareOnly;
    expect(isValidRunState(nonBossMarker)).toBe(false);
  });
});

describe('new boss offers freeze their distinct count when rolled', () => {
  it('writes three distinct offers through a real current campaign and preserves its proof and RNG', () => {
    const state = currentBossReward();
    expect(state.reward!.distinctRareCountAtRoll).toBe(3);
    expect(new Set(state.reward!.cardIds).size).toBe(3);
    const saved = serializeRun(state);
    const restored = deserializeRun(saved)!;
    expect(restored).not.toBeNull();
    expect(serializeRun(restored)).toBe(saved);
    expect(restored.reward).toEqual(state.reward);
    expect(restored.rngState).toBe(state.rngState);

    const duplicate = structuredClone(state);
    duplicate.reward!.cardIds[1] = duplicate.reward!.cardIds[0];
    expect(isValidRunState(duplicate)).toBe(false);
    const wrongCount = structuredClone(state);
    wrongCount.reward!.distinctRareCountAtRoll = 2;
    expect(isValidRunState(wrongCount)).toBe(false);
  }, 30000);

  it.each([0, -1, 4, 1.5, '3', null])('rejects an invalid frozen distinct count %s', (count) => {
    const data = JSON.parse(serializeRun(currentBossReward()));
    data.run.reward.distinctRareCountAtRoll = count;
    expect(deserializeRun(JSON.stringify(data))).toBeNull();
  });

  it('accepts an explicit historical count of one even when the current catalog contains three rares', () => {
    // This verifies the new forward-compatible schema; the real old fixture above predates this field.
    const state = loadHistoricalBoss();
    state.reward!.distinctRareCountAtRoll = 1;
    expect(isValidRunState(state)).toBe(true);
    expect(deserializeRun(serializeRun(state))).toEqual(state);
  });
});

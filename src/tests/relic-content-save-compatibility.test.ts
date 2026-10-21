import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/pre-content-expansion-relic-saves.json';
import { CARD_DEFINITIONS } from '../data/cards';
import { createBlessedRun, reduceRun } from '../engine/run';
import { deserializeRun, serializeRun } from '../engine/runPersistence';
import { acquireRelic, isValidRelicAcquisitionState } from '../engine/relicAcquisition';
import { getCardPool } from '../engine/cardPools';
import type { RunAction, RunState } from '../types/run';

const saved = (name: string): RunState => structuredClone(fixtures.fixtures.find((entry) => entry.name === name)!.save.run) as unknown as RunState;

describe('authentic pre-expansion acquisition saves keep their frozen rewards', () => {
  it('records the real archived revision and public actions used for every fixture', () => {
    expect(fixtures.sourceCommit).toBe('22e43e89fdeeeee20e9e1920bdf38392e7e9ae38');
    expect(fixtures.fixtures).toHaveLength(8);
    for (const fixture of fixtures.fixtures) {
      expect(createHash('sha256').update(JSON.stringify(fixture.actions)).digest('hex')).toBe(fixture.actionsSha256);
      expect(fixture.actions.map((action) => action.type).slice(0, 3)).toEqual(['chooseBlessing', 'confirmBlessing', 'continueBlessing']);
    }
  });
  it.each(fixtures.fixtures.map((fixture) => [fixture.name, fixture] as const))('%s loads byte-for-byte without rerolling or adding migration fields', (_, fixture) => {
    const raw = JSON.stringify(fixture.save);
    const restored = deserializeRun(raw);
    expect(restored).not.toBeNull();
    expect(serializeRun(restored!)).toBe(raw);
    expect(isValidRelicAcquisitionState(restored!)).toBe(true);
    expect(restored!.relicAcquisition!.randomCardPlans).toBeUndefined();
    expect(serializeRun(deserializeRun(serializeRun(restored!))!)).toBe(raw);
  });
  it.each(['ref_lead_paperweight', 'ref_claw'])('%s resumes an old selection to the exact historical committed result, once', (id) => {
    const before = fixtures.fixtures.find((fixture) => fixture.name === `${id}-select`)!;
    const after = fixtures.fixtures.find((fixture) => fixture.name === `${id}-result`)!;
    let state = deserializeRun(JSON.stringify(before.save))!;
    for (const action of after.actions.slice(before.actions.length)) state = reduceRun(state, action as RunAction);
    expect(serializeRun(state)).toBe(JSON.stringify(after.save));
    expect(reduceRun(state, { type: 'confirmRelicAcquisition' })).toBe(state);
    const continued = reduceRun(state, { type: 'continueRelicAcquisition' });
    expect(continued.relicAcquisition).toBeNull();
    expect(continued.deck).toEqual(state.deck);
    expect(continued.rngState).toBe(state.rngState);
    expect(reduceRun(continued, { type: 'continueRelicAcquisition' })).toBe(continued);
  });
  it.each(fixtures.fixtures.filter((fixture) => fixture.stage === 'result').map((fixture) => [fixture.name, fixture] as const))('%s continues its committed result without another award', (_, fixture) => {
    const state = deserializeRun(JSON.stringify(fixture.save))!;
    const next = reduceRun(state, { type: 'continueRelicAcquisition' });
    expect(next.deck).toEqual(state.deck);
    expect(next.gold).toBe(state.gold);
    expect(next.hp).toBe(state.hp);
    expect(next.rngState).toBe(state.rngState);
    expect(reduceRun(next, { type: 'confirmRelicAcquisition' })).toBe(next);
    expect(acquireRelic(next, fixture.relicId, 'blessing', 'map')).toBe(next);
    expect(deserializeRun(serializeRun(next))).toEqual(next);
  });
});

describe('frozen acquisition validation keeps authored constraints', () => {
  it.each(['token_knife', 'blessing_apotheosis', 'berserker_twin', 'not-a-card'])('rejects %s in an old colorless offer', (cardId) => {
    const state = saved('ref_lead_paperweight-select');
    state.relicAcquisition!.offeredCardIds[0] = cardId;
    expect(isValidRelicAcquisitionState(state)).toBe(false);
  });
  it('rejects a missing/duplicated offer, changed count, or foreign selected UID', () => {
    for (const tamper of [
      (state: RunState) => state.relicAcquisition!.offeredCardIds.pop(),
      (state: RunState) => { state.relicAcquisition!.offeredCardIds[1] = state.relicAcquisition!.offeredCardIds[0]; },
      (state: RunState) => { state.relicAcquisition!.count += 1; },
      (state: RunState) => state.relicAcquisition!.selectedCardUids.push('unowned-card'),
    ]) {
      const state = saved('ref_lead_paperweight-select'); tamper(state);
      expect(isValidRelicAcquisitionState(state)).toBe(false);
    }
  });
  it.each(['token_soul', 'blessing_tearing', 'oracle_wall', 'not-a-card'])('rejects %s in an old class-restricted transform map', (cardId) => {
    const state = saved('ref_claw-select');
    state.relicAcquisition!.replacements[state.deck[0].uid] = cardId;
    expect(isValidRelicAcquisitionState(state)).toBe(false);
  });
  it('rejects an extra mapping key, missing mapping, forged eligible UID and altered result receipt', () => {
    for (const tamper of [
      (state: RunState) => { state.relicAcquisition!.replacements['unowned-card'] = 'machinist_cold_snap'; },
      (state: RunState) => { delete state.relicAcquisition!.replacements[state.deck[0].uid]; },
      (state: RunState) => { state.relicAcquisition!.eligibleCardUids[0] = 'unowned-card'; },
    ]) {
      const state = saved('ref_claw-select'); tamper(state);
      expect(isValidRelicAcquisitionState(state)).toBe(false);
    }
    const result = saved('ref_arcane_scroll-result');
    result.relicAcquisition!.receipt!.goldChange += 1;
    expect(isValidRelicAcquisitionState(result)).toBe(false);
  });
  it.each(['token_sword', 'blessing_apotheosis', 'berserker_offering'])('rejects %s even when an old random-reward receipt and deck are altered together', (cardId) => {
    const state = saved('ref_arcane_scroll-result');
    const added = state.relicAcquisition!.receipt!.addedCards[0];
    state.deck.find((card) => card.uid === added.uid)!.cardId = cardId;
    added.cardId = cardId;
    expect(isValidRelicAcquisitionState(state)).toBe(false);
  });
  it('rejects a normal card of the wrong rarity in an old random rare reward', () => {
    const state = saved('ref_arcane_scroll-result');
    const added = state.relicAcquisition!.receipt!.addedCards[0];
    const common = getCardPool(state.classId, 'combat').find((id) => CARD_DEFINITIONS[id].rarity === 'common')!;
    state.deck.find((card) => card.uid === added.uid)!.cardId = common;
    added.cardId = common;
    expect(isValidRelicAcquisitionState(state)).toBe(false);
  });
  it.each(['ref_glass_eye', 'ref_arcane_scroll', 'ref_lead_paperweight', 'ref_claw'])('%s freezes new acquisition choices without a historical-pool assumption', (id) => {
    let state: RunState | undefined;
    for (let index = 0; index < 5000; index++) {
      const candidate = createBlessedRun(`new-content-acquisition-${id}-${index}`, 'machinist');
      const option = candidate.blessing!.options.find((entry) => entry.rewards.some((reward) => reward.kind === 'relic' && reward.relicId === id));
      if (!option) continue;
      state = reduceRun(candidate, { type: 'chooseBlessing', optionId: option.id });
      state = reduceRun(state, { type: 'confirmBlessing' });
      state = reduceRun(state, { type: 'continueBlessing' });
      break;
    }
    expect(state, `${id}: no matching new public blessing within 5000 seeds`).toBeDefined();
    if (!state) throw new Error('Missing public blessing fixture');
    expect(isValidRelicAcquisitionState(state)).toBe(true);
    expect(deserializeRun(serializeRun(state))).toEqual(state);
    if (id === 'ref_glass_eye' || id === 'ref_arcane_scroll') {
      expect(state.relicAcquisition!.randomCardPlans).toBeDefined();
      const forged = structuredClone(state);
      const plan = Object.values(forged.relicAcquisition!.randomCardPlans!)[0];
      plan.cardIds[0] = 'blessing_apotheosis';
      expect(isValidRelicAcquisitionState(forged)).toBe(false);
    }
  });
});

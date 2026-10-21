import { describe, expect, it } from 'vitest';
import { createCombat } from '../engine';
import { CARD_DEFINITIONS } from '../data/cards';
import { getTurnMetrics, recordCardPlay, recordDiscard, recordDoom, recordDraw, resetTurnMetrics } from '../engine/combat/cardMetrics';

const card = (cardId: string, upgraded = false) => ({ uid: `metric-${cardId}`, cardId, upgraded });

describe('card metrics are recorded only by committed operation boundaries', () => {
  it('creates an empty counter record without changing RNG, actors or inventory', () => {
    const state = createCombat('metrics-init');
    delete state.turnMetrics;
    const before = structuredClone(state);
    expect(getTurnMetrics(state)).toEqual({ skillsPlayed: 0, energySpent: 0, drawn: 0, discarded: 0, doomApplied: 0 });
    const { turnMetrics: _metrics, ...without } = state;
    expect(without).toEqual(before);
    expect(getTurnMetrics(state)).toBe(state.turnMetrics);
  });
  it('does not create records for zero, negative or nonfinite draw, discard or doom amounts', () => {
    const state = createCombat('metrics-no-op'); delete state.turnMetrics;
    const before = structuredClone(state);
    for (const amount of [0, -1, Infinity, NaN]) {
      recordDraw(state, amount); recordDiscard(state, amount); recordDoom(state, amount);
    }
    expect(state).toEqual(before);
  });
  it('adds actual draw, explicit discard and positive applied doom separately', () => {
    const state = createCombat('metrics-amounts'); resetTurnMetrics(state);
    recordDraw(state, 3); recordDraw(state, 2);
    recordDiscard(state, 2); recordDoom(state, 7); recordDoom(state, 5);
    expect(state.turnMetrics).toEqual({ skillsPlayed: 0, energySpent: 0, drawn: 5, discarded: 2, doomApplied: 12 });
  });
  it('counts skill cards and actual payments, without inventing payment for powers or X bonuses', () => {
    const state = createCombat('metrics-play'); resetTurnMetrics(state);
    recordCardPlay(state, card('still_guard'), 1);
    recordCardPlay(state, card('stone_strike'), 1);
    recordCardPlay(state, card('berserker_demon_form'), 2);
    recordCardPlay(state, card('berserker_whirlwind'), 3);
    expect(state.turnMetrics).toMatchObject({ skillsPlayed: 1, energySpent: 7 });
    expect(state.stats.cardsPlayed).toBe(0); // The boundary owns serials; this helper does not add another play.
  });
  it('ignores unknown card identities without changing any counter', () => {
    const state = createCombat('metrics-unknown'); const before = structuredClone(state);
    recordCardPlay(state, card('missing-card'), 100);
    expect(state).toEqual(before);
  });
  it('reads the played upgrade flag when ethereal is removed by an upgrade', () => {
    const definition = CARD_DEFINITIONS.blessing_apparition;
    expect(definition.ethereal).toBe(true); expect(definition.upgradedEthereal).toBe(false);
    const state = createCombat('metrics-ethereal');
    delete state.battleMetrics;
    recordCardPlay(state, card(definition.id), 1);
    recordCardPlay(state, card(definition.id, true), 1);
    recordCardPlay(state, card('necromancer_exhausting_hand', true), 1);
    expect(state.battleMetrics).toEqual({ etherealPlayed: 2 });
  });
  it('resets before turn-start draws while keeping battle-wide ethereal history', () => {
    const state = createCombat('metrics-reset');
    recordCardPlay(state, card('necromancer_exhausting_hand'), 1);
    recordDraw(state, 7); recordDiscard(state, 3); recordDoom(state, 10);
    const rng = state.rngState;
    resetTurnMetrics(state);
    expect(state.turnMetrics).toEqual({ skillsPlayed: 0, energySpent: 0, drawn: 0, discarded: 0, doomApplied: 0 });
    expect(state.battleMetrics).toEqual({ etherealPlayed: 1 });
    expect(state.rngState).toBe(rng);
  });
});

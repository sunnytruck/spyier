import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import { createCombat, getEnemies, getEnemyKey, reduceCombat } from '../engine';
import { cardRequiresEnemy, cardTargetMode, resolveCardDrop } from '../presentation/targeting';
import type { CardDefinition, CardInstance, Effect } from '../types/game';

function fixture(cardId: string) {
  const deck = [{ uid: 'dragged-card', cardId, upgraded: false }];
  const state = createCombat('drag-target-tests', ['grit_scout', 'grit_scout'], { deck, classId: 'berserker' });
  state.energy = 10;
  return { state, card: state.hand[0] };
}

function definition(effects: Effect[], upgradedEffects = effects): CardDefinition {
  return { ...CARD_DEFINITIONS.stone_strike, effects, upgradedEffects };
}

describe('effect-driven drag target rules', () => {
  it.each([
    'stone_strike', 'shared_screen', 'poison_moss', 'poison_rite',
    'necromancer_unleash', 'necromancer_doom_draw',
  ])('%s requires an exact live enemy even when it is a skill', (id) => {
    expect(cardRequiresEnemy(CARD_DEFINITIONS[id])).toBe(true);
    expect(cardTargetMode(CARD_DEFINITIONS[id])).toBe('enemy');
    const { state, card } = fixture(id);
    expect(resolveCardDrop(state, card, { inArena: true })).toMatchObject({ valid: false, reason: 'target' });
    expect(resolveCardDrop(state, card, { inArena: true, overPlayer: true })).toMatchObject({ valid: false, reason: 'target' });
    const accepted = resolveCardDrop(state, card, { inArena: true, enemyId: 'grit_scout-1' });
    expect(accepted).toEqual({ valid: true, mode: 'enemy', targetId: 'grit_scout-1' });
    expect(reduceCombat(state, { type: 'playCard', cardId: card.uid, targetId: accepted.targetId })).not.toBe(state);
  });

  it.each(['bedrock_sweep', 'oracle_star_burst', 'necromancer_negative_wave'])('%s accepts an arena drop and lets the engine resolve all targets', (id) => {
    const { state, card } = fixture(id);
    expect(cardTargetMode(CARD_DEFINITIONS[id])).toBe('allEnemies');
    expect(cardRequiresEnemy(CARD_DEFINITIONS[id])).toBe(false);
    expect(resolveCardDrop(state, card, { inArena: true })).toEqual({ valid: true, mode: 'allEnemies' });
    expect(resolveCardDrop(state, card, { inArena: true, enemyId: 'grit_scout-1' })).toEqual({ valid: true, mode: 'allEnemies' });
  });

  it.each(['still_guard', 'morning_chant', 'berserker_inflame', 'oracle_manifest', 'necromancer_bodyguard', 'machinist_dual_cast'])('%s is a self cast, including engine-targeted orb effects', (id) => {
    const { state, card } = fixture(id);
    expect(cardTargetMode(CARD_DEFINITIONS[id])).toBe('self');
    expect(resolveCardDrop(state, card, { inArena: true, overPlayer: true })).toEqual({ valid: true, mode: 'self' });
    expect(resolveCardDrop(state, card, { inArena: true })).toEqual({ valid: true, mode: 'self' });
  });

  it('an explicit enemy effect takes precedence over an area or self effect on the same card', () => {
    const mixed = definition([
      { type: 'damage', amount: 3, all: true },
      { type: 'block', amount: 4 },
      { type: 'status', status: 'weak', target: 'enemy', amount: 1 },
    ]);
    expect(cardTargetMode(mixed)).toBe('enemy');
    expect(cardRequiresEnemy(mixed)).toBe(true);
  });

  it('derives target mode from the active upgrade definition rather than the base card type', () => {
    const changesTarget = definition([{ type: 'block', amount: 2 }], [{ type: 'damage', amount: 3 }]);
    expect(cardTargetMode(changesTarget, false)).toBe('self');
    expect(cardTargetMode(changesTarget, true)).toBe('enemy');
    const allAfterUpgrade = definition([{ type: 'damage', amount: 2 }], [{ type: 'damage', amount: 3, all: true }]);
    expect(cardTargetMode(allAfterUpgrade, true)).toBe('allEnemies');
  });

  it.each(['stone_strike', 'still_guard', 'bedrock_sweep'])('dropping %s outside the arena always cancels without playing or consuming energy', (id) => {
    const { state, card } = fixture(id);
    const before = structuredClone(state);
    expect(resolveCardDrop(state, card, { inArena: false, enemyId: 'grit_scout-1', overPlayer: true })).toMatchObject({ valid: false, reason: 'outside' });
    expect(state).toEqual(before);
  });

  it('does not silently redirect a dead, stale, unknown or non-instance target to the selected enemy', () => {
    const { state, card } = fixture('stone_strike');
    getEnemies(state)[1].hp = 0;
    for (const enemyId of ['grit_scout-1', 'grit_scout', 'missing', 'player']) {
      expect(resolveCardDrop(state, card, { inArena: true, enemyId })).toMatchObject({ valid: false, reason: 'target' });
    }
    expect(resolveCardDrop(state, card, { inArena: true, enemyId: getEnemyKey(getEnemies(state)[0]) })).toMatchObject({ valid: true, targetId: 'grit_scout-0' });
  });

  it('rejects a stale card identity or changed upgrade, even when its UID was reused', () => {
    const { state, card } = fixture('stone_strike');
    const drop = { inArena: true, enemyId: 'grit_scout-0' };
    const invalid: CardInstance[] = [
      { ...card, uid: 'already-played' },
      { ...card, cardId: 'still_guard' },
      { ...card, upgraded: true },
      { ...card, cardId: 'does-not-exist' },
    ];
    for (const stale of invalid) expect(resolveCardDrop(state, stale, drop)).toMatchObject({ valid: false, reason: 'unavailable' });
  });

  it('rechecks the authoritative phase, energy and pending choice when the pointer is released', () => {
    const { state, card } = fixture('stone_strike');
    const drop = { inArena: true, enemyId: 'grit_scout-0' };
    const noEnergy = { ...state, energy: 0 };
    const terminal = { ...state, phase: 'defeat' as const };
    const pending = { ...state, pendingChoice: { mode: 'discard' as const, amount: 1, resume: { effects: [], defense: false } } };
    for (const unavailable of [noEnergy, terminal, pending]) {
      expect(resolveCardDrop(unavailable, card, drop)).toMatchObject({ valid: false, reason: 'unavailable' });
    }
  });
});

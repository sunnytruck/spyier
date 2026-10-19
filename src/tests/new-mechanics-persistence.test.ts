import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import { createCombat, getEnemies, reduceCombat } from '../engine';
import { deserializeGame, isValidCombatState, serializeGame } from '../engine/persistence';
import type { CombatState } from '../types/game';

function battle(cardId: string, handSize = 5): CombatState {
  const definition = CARD_DEFINITIONS[cardId];
  const played = { uid: 'played', cardId, upgraded: false };
  const filler = Array.from({ length: handSize + 12 }, (_, index) => ({ uid: `filler-${index}`, cardId: 'still_guard', upgraded: false }));
  const state = createCombat('new-mechanic-save-validation', 'grit_scout', {
    classId: definition.classId === 'colorless' ? undefined : definition.classId,
    deck: [played, ...filler],
  });
  state.hand = [played, ...filler.slice(0, handSize - 1)];
  state.discardPile = filler.slice(handSize - 1, handSize + 5);
  state.drawPile = filler.slice(handSize + 5);
  state.exhaustPile = [];
  state.energy = 10;
  state.jitto = 0;
  for (const enemy of getEnemies(state)) { enemy.hp = 1000; enemy.maxHp = 1000; }
  expect(isValidCombatState(state)).toBe(true);
  return state;
}

const play = (state: CombatState) => reduceCombat(state, { type: 'playCard', cardId: 'played' });
const load = (state: CombatState) => deserializeGame(serializeGame(state))!;

describe('new card mechanics preserve save boundaries and reject corrupted continuations', () => {
  it('restores a retrieve selection limited by the remaining hand capacity', () => {
    const pending = play(battle('necromancer_harvest', 50));
    expect(pending.pendingChoice).toMatchObject({ mode: 'retrieve', sourceZone: 'discardPile', amount: 1 });
    const restored = load(pending);
    const action = { type: 'chooseCards', cardIds: [pending.discardPile[0].uid] } as const;
    const after = reduceCombat(pending, { ...action, cardIds: [...action.cardIds] });
    expect(after.hand).toHaveLength(50);
    expect(reduceCombat(restored, { ...action, cardIds: [...action.cardIds] })).toEqual(after);
    expect(load(after)).toEqual(after);
    expect(reduceCombat(after, { ...action, cardIds: [...action.cardIds] })).toBe(after);
  });

  it.each(['oracle_faint_light', 'oracle_cosmic_indifference', 'machinist_hologram'])('%s preserves its actual choice source and rejects a changed source or queue', (cardId) => {
    const pending = play(battle(cardId));
    expect(pending.pendingChoice).toBeDefined();
    expect(load(pending)).toEqual(pending);
    const wrongZone = structuredClone(pending);
    wrongZone.pendingChoice!.sourceZone = pending.pendingChoice!.sourceZone === 'discardPile' ? 'hand' : 'discardPile';
    expect(isValidCombatState(wrongZone)).toBe(false);
    const injectedQueue = structuredClone(pending);
    injectedQueue.pendingChoice!.resume.effects.push({ type: 'heal', amount: 999 });
    expect(isValidCombatState(injectedQueue)).toBe(false);
  });

  it('restores authored next-turn effects but rejects arbitrary saved effects and unknown source instances', () => {
    const scheduled = play(battle('oracle_hidden_wealth'));
    expect(scheduled.scheduledEffects).toHaveLength(1);
    expect(load(scheduled)).toEqual(scheduled);
    const injected = structuredClone(scheduled);
    injected.scheduledEffects![0].effects = [{ type: 'energy', amount: 999 }];
    expect(isValidCombatState(injected)).toBe(false);
    const fakeSource = structuredClone(scheduled);
    fakeSource.scheduledEffects![0].sourceCard!.uid = 'unknown-card';
    expect(isValidCombatState(fakeSource)).toBe(false);
    const after = reduceCombat(load(scheduled), { type: 'endTurn' });
    expect(after.classResources!.starsGainedThisTurn).toBe(3);
    expect(after.scheduledEffects).toBeUndefined();
    expect(reduceCombat(load(after), { type: 'endTurn' }).classResources!.starsGainedThisTurn).toBe(0);
  });

  it('restores signed strength and temporary modifiers, rejecting unknown modifier opcodes', () => {
    const negative = play(battle('necromancer_common_fate'));
    expect(negative.player.strength).toBe(-2);
    expect(negative.enemy.strength).toBe(-2);
    expect(load(negative)).toEqual(negative);
    const temporary = play(battle('berserker_rage'));
    expect(temporary.turnModifiers).toHaveLength(1);
    const after = reduceCombat(load(temporary), { type: 'endTurn' });
    expect(after.powerStacks!.blockOnAttack).toBe(0);
    expect(after.turnModifiers).toBeUndefined();
    const corrupted = JSON.parse(serializeGame(temporary));
    corrupted.combat.turnModifiers[0].power = 'unknown-power';
    expect(deserializeGame(JSON.stringify(corrupted))).toBeNull();
  });

  it('saves the bounded energy value produced by repeated energy multiplication', () => {
    const state = battle('machinist_double_energy');
    state.energy = 600_000;
    const result = play(state);
    expect(result.energy).toBe(1_000_000);
    expect(load(result)).toEqual(result);
  });
});

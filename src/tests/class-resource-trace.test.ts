import { describe, expect, it } from 'vitest';
import { ENEMY_DEFINITIONS } from '../data/enemies';
import { createCombat, reduceCombat } from '../engine';
import { captureCombatTransition } from '../presentation/trace';
import type { ClassId } from '../types/game';

const card = (cardId: string) => ({ uid: 'resource-test', cardId, upgraded: false });

function battle(classId: ClassId, cardId = 'stone_strike') {
  const state = createCombat('resource-cue-contract', 'grit_scout', { classId, deck: [card(cardId)] });
  state.enemy.hp = state.enemy.maxHp = 500;
  return state;
}

describe('resource presentation follows actual combat transitions', () => {
  it('shows actual summon and growth without adding an automatic attack', () => {
    for (const initial of [0, 4]) {
      const state = battle('necromancer', 'necromancer_bodyguard');
      state.classResources!.ostyHp = initial;
      const result = captureCombatTransition(state, () => reduceCombat(state, { type: 'playCard', cardId: 'resource-test' }));
      expect(result.result.classResources!.ostyHp).toBe(initial + 5);
      expect(result.cues.find((cue) => cue.resource === 'ostyHp')).toMatchObject({ targetId: 'osty', amount: 5, resourceAction: initial ? 'grow' : 'summon' });
      expect(result.cues.some((cue) => cue.kind === 'attack')).toBe(false);
    }
  });

  it('shows guard damage and disappearance before the remaining player damage', () => {
    const state = battle('necromancer');
    state.classResources!.ostyHp = 3;
    const result = captureCombatTransition(state, () => reduceCombat(state, { type: 'endTurn' }));
    const guard = result.cues.findIndex((cue) => cue.resourceAction === 'guard');
    const vanish = result.cues.findIndex((cue) => cue.resourceAction === 'vanish');
    const impact = result.cues.findIndex((cue) => cue.kind === 'impact' && cue.targetId === 'player');
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(vanish).toBeGreaterThan(guard);
    expect(impact).toBeGreaterThan(vanish);
    expect(result.cues[guard]).toMatchObject({ targetId: 'osty', amount: -3, absorbed: 3 });
    expect(result.cues[vanish].frame.classResources!.ostyHp).toBe(0);
    expect(result.result.player.hp).toBe(78);
  });

  it('does not pretend that the summon absorbs an attack fully stopped by block', () => {
    const state = battle('necromancer');
    state.classResources!.ostyHp = 3;
    state.player.block = 5;
    const result = captureCombatTransition(state, () => reduceCombat(state, { type: 'endTurn' }));
    expect(result.cues.some((cue) => cue.resource === 'ostyHp')).toBe(false);
    expect(result.result.classResources!.ostyHp).toBe(3);
    expect(result.result.player.hp).toBe(80);
  });

  it('distinguishes a field attack from ordinary guard and damages both units', () => {
    const state = battle('necromancer');
    state.enemy.id = 'hollow_mountain';
    state.enemy.intentIndex = 1;
    state.enemy.intent = { ...ENEMY_DEFINITIONS.hollow_mountain.intents[1] };
    state.classResources!.ostyHp = 8;
    const result = captureCombatTransition(state, () => reduceCombat(state, { type: 'endTurn' }));
    expect(result.cues.find((cue) => cue.resourceAction === 'sweep')).toMatchObject({ targetId: 'osty', amount: -8 });
    expect(result.cues.some((cue) => cue.resourceAction === 'guard')).toBe(false);
    expect(result.result.player.hp).toBe(66);
    expect(result.result.classResources!.ostyHp).toBe(0);
  });

  it('a star reference is visibly announced without spending stored stars', () => {
    const state = battle('oracle', 'oracle_star_burst');
    state.classResources!.stars = 20;
    state.classResources!.starsGainedThisTurn = 2;
    const result = captureCombatTransition(state, () => reduceCombat(state, { type: 'playCard', cardId: 'resource-test' }));
    expect(result.cues.find((cue) => cue.resourceAction === 'reference')).toMatchObject({ resource: 'stars', amount: 0 });
    expect(result.result.classResources!.stars).toBe(20);
    expect(result.result.classResources!.starsGainedThisTurn).toBe(2);
    expect(result.result.enemy.hp).toBe(494);
  });

  it('a relic triggered by an orb kill uses its own source, not an inherited orb anchor', () => {
    const state = createCombat('orb-kill-relic', 'grit_scout', { classId: 'machinist', hp: 70, relicIds: ['soul_ladle'] });
    state.enemy.hp = 3;
    state.classResources!.orbs = ['lightning'];
    const result = captureCombatTransition(state, () => reduceCombat(state, { type: 'endTurn' }));
    const hit = result.cues.find((cue) => cue.kind === 'impact');
    expect(hit).toMatchObject({ sourceId: 'orb-0', orbIndex: 0, orbMode: 'passive' });
    const heal = result.cues.find((cue) => cue.kind === 'heal');
    expect(heal).toMatchObject({ sourceId: 'player', effect: 'relic', amount: 2 });
    expect(heal!.orbIndex).toBeUndefined();
    expect(heal!.orbMode).toBeUndefined();
    expect(result.result.player.hp).toBe(72);
  });
});

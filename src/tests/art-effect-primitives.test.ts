import { describe, expect, it } from 'vitest';
import { createCombat, getEnemies, getEnemyKey } from '../engine';
import { resolveEffects } from '../engine/effects/resolve';
import { generateCards } from '../engine/combat/resources';
import { deserializeGame, serializeGame } from '../engine/persistence';
import { combatValue, meetsEffectCondition } from '../engine/combat/values';
import type { CombatState } from '../types/game';

const fixture = (multi = false): CombatState => {
  const state = createCombat('art-primitives-contract', multi ? ['grit_scout', 'candle_moth'] : 'grit_scout', { classId: 'oracle' });
  for (const enemy of getEnemies(state)) { enemy.hp = enemy.maxHp = 100; enemy.block = 0; }
  return state;
};

describe('shared art-expansion effect primitives', () => {
  it('an explicit lethal award executes on the last enemy but cannot award twice for later hits', () => {
    const state = fixture(); state.enemy.hp = 4;
    resolveEffects(state, [{ type: 'damage', amount: 4, hits: 3, onKill: { stars: 5, energy: 3 } }]);
    expect(state.phase).toBe('victory'); expect(state.classResources?.stars).toBe(5); expect(state.energy).toBe(6);
    expect(deserializeGame(serializeGame(state))).toEqual(state);
  });
  it('a lethal random hit awards once and a subsequent hit uses another living enemy', () => {
    const state = fixture(true);
    for (const enemy of getEnemies(state)) enemy.hp = 4;
    resolveEffects(state, [{ type: 'damage', amount: 4, randomTarget: true, hits: 5, onKill: { stars: 2 } }]);
    expect(state.phase).toBe('victory'); expect(state.classResources?.stars).toBe(4);
    expect(getEnemies(state).map((enemy) => enemy.hp)).toEqual([0, 0]);
  });
  it('lethal detection counts actual death after block, not raw damage or a near kill', () => {
    const state = fixture(); state.enemy.hp = 4; state.enemy.block = 1;
    resolveEffects(state, [{ type: 'damage', amount: 4, onKill: { energy: 3 } }]);
    expect(state.enemy.hp).toBe(1); expect(state.energy).toBe(3);
  });
  it('a scaled player buff observes the explicit target instead of the selected/default enemy', () => {
    const state = fixture(true); const enemies = getEnemies(state);
    enemies[0].vulnerable = 30; enemies[1].vulnerable = 4;
    resolveEffects(state, [{ type: 'status', target: 'player', status: 'strength', amount: 1, bonusPer: { value: 'enemyVulnerable', multiplier: 2 } }], { defense: false }, { targetId: getEnemyKey(enemies[1]) });
    expect(state.player.strength).toBe(9);
  });
  it('a status multiplier preserves zero and changes only its authored debuff', () => {
    const state = fixture(); state.enemy.vulnerable = 0; state.enemy.weak = 3; state.enemy.poison = 5;
    resolveEffects(state, [{ type: 'multiplyStatus', status: 'vulnerable', amount: 2 }]);
    expect([state.enemy.vulnerable, state.enemy.weak, state.enemy.poison]).toEqual([0, 3, 5]);
    resolveEffects(state, [{ type: 'multiplyStatus', status: 'weak', amount: 2 }]);
    expect([state.enemy.vulnerable, state.enemy.weak, state.enemy.poison]).toEqual([0, 6, 5]);
  });
  it('random status selects seeded living targets per hit and applies poison relic bonuses per application', () => {
    const state = fixture(true); state.relicIds = ['ref_snecko_skull'];
    const before = structuredClone(state);
    resolveEffects(state, [{ type: 'randomStatus', status: 'poison', amount: 3, hits: 4 }]);
    resolveEffects(before, [{ type: 'randomStatus', status: 'poison', amount: 3, hits: 4 }]);
    expect(getEnemies(state).reduce((sum, enemy) => sum + enemy.poison, 0)).toBe(16);
    expect(state).toEqual(before);
    expect(state.rngState).not.toBe(fixture(true).rngState);
  });
  it('per-instance damage bonuses do not leak into the same-name global bonus map', () => {
    const state = fixture(); const first = state.hand[0];
    resolveEffects(state, [{ type: 'instanceDamageBonus', amount: 5 }], { defense: false }, { sourceCard: first });
    expect(state.instanceDamageBonuses).toEqual({ [first.uid]: 5 });
    expect(state.cardDamageBonuses).toBeUndefined();
    expect(deserializeGame(serializeGame(state))).toEqual(state);
  });
  it('zero-cost retrieval excludes X cards even with zero energy and conserves overflow at the hand cap', () => {
    const state = fixture();
    const zero = generateCards(state, 'token_knife', 2, 'discardPile');
    generateCards(state, 'berserker_whirlwind', 1, 'discardPile');
    state.energy = 0;
    generateCards(state, 'token_soul', 44, 'hand'); // five-card opening hand + 44 = 49
    resolveEffects(state, [{ type: 'moveMatching', from: 'discardPile', to: 'hand', cost: 0 }]);
    expect(state.hand).toHaveLength(50);
    expect(state.hand.some((card) => card.uid === zero[0].uid)).toBe(true);
    expect(state.discardPile.some((card) => card.uid === zero[1].uid)).toBe(true);
    expect(state.discardPile.some((card) => card.cardId === 'berserker_whirlwind')).toBe(true);
    expect(deserializeGame(serializeGame(state))).toEqual(state);
  });
  it('returnSelf records the played instance without generating a copy or moving it early', () => {
    const state = fixture(); const card = state.hand[0];
    const inventory = JSON.stringify([state.hand, state.drawPile, state.discardPile, state.generatedCards]);
    resolveEffects(state, [{ type: 'returnSelf', destination: 'drawPile' }], { defense: false }, { sourceCard: card });
    expect(state.cardReturnTargets).toEqual({ [card.uid]: 'drawPile' });
    expect(JSON.stringify([state.hand, state.drawPile, state.discardPile, state.generatedCards])).toBe(inventory);
  });
  it('read-only metrics and conditions return zero/false for old saves without initializing new state', () => {
    const state = fixture(); delete state.turnMetrics; delete state.battleMetrics;
    const before = serializeGame(state);
    for (const value of ['skillsPlayedThisTurn', 'discardedThisTurn', 'drawnThisTurn', 'etherealPlayedBattle', 'energySpentThisTurn'] as const)
      expect(combatValue(state, value)).toBe(0);
    expect(meetsEffectCondition(state, { type: 'doomAppliedThisTurn' })).toBe(false);
    expect(serializeGame(state)).toBe(before);
  });
});

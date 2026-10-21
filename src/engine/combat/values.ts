import type { CombatState, CombatValue, EffectCondition, EffectScaling, EnemyState } from '../../types/game';
import { findEnemy, getEnemies } from './targets';

/** Canonical read-only quantities: preview and resolution use the same source. */
export function combatValue(state: CombatState, value: CombatValue, target?: EnemyState): number {
  const enemy = target ?? findEnemy(state);
  switch (value) {
    case 'handSize': return state.hand.length;
    case 'drawPileSize': return state.drawPile.length;
    case 'discardPileSize': return state.discardPile.length;
    case 'exhaustPileSize': return state.exhaustPile.length;
    case 'enemyPoison': return enemy?.poison ?? 0;
    case 'enemyWeak': return enemy?.weak ?? 0;
    case 'enemyVulnerable': return enemy?.vulnerable ?? 0;
    case 'enemyDoom': return enemy?.doom ?? 0;
    case 'enemyDebuffs': return enemy ? [enemy.weak, enemy.vulnerable, enemy.poison, enemy.doom ?? 0, enemy.stun ?? 0,
      Math.max(0, -enemy.strength)].filter((amount) => amount > 0).length : 0;
    case 'totalEnemyPoison': return getEnemies(state).filter((actor) => actor.hp > 0).reduce((sum, actor) => sum + actor.poison, 0);
    case 'orbCount': return state.classResources?.orbs.length ?? 0;
    case 'distinctOrbCount': return new Set(state.classResources?.orbs ?? []).size;
    case 'livingEnemyCount': return getEnemies(state).filter((actor) => actor.hp > 0).length;
  }
}

export function meetsEffectCondition(state: CombatState, condition: EffectCondition, target?: EnemyState): boolean {
  const enemy = target ?? findEnemy(state);
  switch (condition.type) {
    case 'targetStatus': return (enemy?.[condition.status] ?? 0) >= (condition.min ?? 1);
    case 'targetAttacking': return enemy?.intent.damage !== undefined && (enemy?.stun ?? 0) === 0;
    case 'cardsPlayedAtMost': return state.cardsPlayedThisTurn <= condition.amount;
  }
}

/** Raw amount before the effect-specific nonnegative clamp/floor or attack modifiers. */
export function scaledEffectAmount(state: CombatState, effect: { amount: number; bonusPer?: EffectScaling }, target?: EnemyState): number {
  if (!effect.bonusPer) return effect.amount;
  const raw = combatValue(state, effect.bonusPer.value, target);
  const groups = effect.bonusPer.divisor === undefined ? raw : Math.floor(raw / effect.bonusPer.divisor);
  return effect.amount + groups * effect.bonusPer.multiplier;
}

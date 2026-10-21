import type { CardInstance, CombatState } from '../../types/game';
import { getActiveRelics } from './relics';

/** Dynamic bonuses are read from current HP, never written into permanent strength. */
export function getRelicStrengthBonus(state: CombatState): number {
  return getActiveRelics(state).reduce((sum, relic) => {
    const threshold = relic.passive?.hpThresholdStrength;
    return sum + (threshold && state.player.hp * 100 <= state.player.maxHp * threshold.percent ? threshold.amount : 0);
  }, 0);
}

/** This increases an X effect's value without increasing its energy payment. */
export function getRelicXBonus(state: CombatState): number {
  return getActiveRelics(state).reduce((sum, relic) => sum + (relic.passive?.xEffectBonus ?? 0), 0);
}

export function getRelicVulnerableMultiplier(state: CombatState): number {
  return getActiveRelics(state).reduce((multiplier, relic) => Math.max(multiplier, relic.passive?.vulnerableEnemyMultiplier ?? 1.5), 1.5);
}

export function getRelicEnemyWeakMultiplier(state: CombatState): number {
  return getActiveRelics(state).reduce((multiplier, relic) => Math.min(multiplier, relic.passive?.weakEnemyMultiplier ?? 0.75), 0.75);
}

/** Card-count protection affects enemy attacks, not poison, HP costs or other HP loss. */
export function getRelicEnemyAttackMultiplier(state: CombatState): number {
  return getActiveRelics(state).reduce((multiplier, relic) => {
    const protection = relic.passive?.enemyDamageMultiplierWhenCardsAtMost;
    return multiplier * (protection && state.cardsPlayedThisTurn <= protection.cards ? protection.multiplier : 1);
  }, 1);
}

export function getRelicCardPlayLimit(state: CombatState): number {
  return getActiveRelics(state).reduce((limit, relic) => Math.min(limit, relic.passive?.cardsPerTurnLimit ?? Infinity), Infinity);
}

export function shouldRelicRetainHand(state: CombatState): boolean {
  return getActiveRelics(state).some((relic) => Boolean(relic.passive?.retainHand) || (
    relic.passive?.retainHandThroughTurn !== undefined && state.turn <= relic.passive.retainHandThroughTurn
  ));
}

/** The resolver snapshots a triggering attack's multiplier before its first hit. */
export function getRelicCardDamageMultiplier(state: CombatState, card?: CardInstance): number {
  return card ? state.relicCounters?.[`attack-multiplier:${card.uid}`] ?? 1 : 1;
}

import type { CombatState, CombatValue, EffectCondition, EffectScaling, EnemyState } from '../../types/game';
import { findEnemy, getEnemies } from './targets';
import { CARD_DEFINITIONS } from '../../data/cards';
import { isStrikeCard } from './resources';

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
    case 'handSkillCount': return state.hand.filter((card) => CARD_DEFINITIONS[card.cardId]?.type === 'skill').length;
    case 'skillsPlayedThisTurn': return state.turnMetrics?.skillsPlayed ?? 0;
    case 'generatedCardCount': return state.generatedCards?.length ?? 0;
    case 'exhaustSoulCount': return state.exhaustPile.filter((card) => card.cardId === 'token_soul').length;
    case 'strikeCardCount': return [...state.deck, ...(state.generatedCards ?? [])].filter((card) => isStrikeCard(card.cardId)).length;
    case 'discardedThisTurn': return state.turnMetrics?.discarded ?? 0;
    case 'drawnThisTurn': return state.turnMetrics?.drawn ?? 0;
    case 'energySpentThisTurn': return state.turnMetrics?.energySpent ?? 0;
    case 'etherealPlayedBattle': return state.battleMetrics?.etherealPlayed ?? 0;
  }
}

export function meetsEffectCondition(state: CombatState, condition: EffectCondition, target?: EnemyState): boolean {
  const enemy = target ?? findEnemy(state);
  switch (condition.type) {
    case 'targetStatus': return (enemy?.[condition.status] ?? 0) >= (condition.min ?? 1);
    case 'targetAttacking': return enemy?.intent.damage !== undefined && (enemy?.stun ?? 0) === 0;
    case 'cardsPlayedAtMost': return state.cardsPlayedThisTurn <= condition.amount;
    case 'handSizeAtLeast': return state.hand.length >= condition.amount;
    case 'drawPileEmpty': return state.drawPile.length === 0;
    case 'doomAppliedThisTurn': return (state.turnMetrics?.doomApplied ?? 0) > 0;
  }
}

/** Raw amount before the effect-specific nonnegative clamp/floor or attack modifiers. */
export function scaledEffectAmount(state: CombatState, effect: { amount: number; bonusPer?: EffectScaling }, target?: EnemyState): number {
  if (!effect.bonusPer) return effect.amount;
  const raw = combatValue(state, effect.bonusPer.value, target);
  const groups = effect.bonusPer.divisor === undefined ? raw : Math.floor(raw / effect.bonusPer.divisor);
  return effect.amount + groups * effect.bonusPer.multiplier;
}

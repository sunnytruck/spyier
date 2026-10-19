import { canPlayCard, getEnemies, getEnemyKey } from '../engine';
import { CARD_DEFINITIONS } from '../data/cards';
import type { CardDefinition, CardInstance, CombatState, Effect } from '../types/game';

export type CardTargetMode = 'enemy' | 'allEnemies' | 'self';

/** Effect-driven targeting is shared by pointer input and UI tests, never card IDs. */
function effectTargetMode(effect: Effect): CardTargetMode {
  switch (effect.type) {
    case 'damage':
    case 'starBurst':
    case 'doom':
      return effect.all ? 'allEnemies' : 'enemy';
    case 'status':
      return effect.target === 'enemy' ? 'enemy' : effect.target === 'allEnemies' ? 'allEnemies' : 'self';
    case 'multiplyPoison':
    case 'summonDamage':
      return 'enemy';
    default:
      // Orb strikes select targets within the combat engine, so they are self casts.
      return 'self';
  }
}

export function cardTargetMode(card: CardDefinition, upgraded = false): CardTargetMode {
  const modes = (upgraded ? card.upgradedEffects : card.effects).map(effectTargetMode);
  // A mixed card with even one selected-target effect must have a valid enemy.
  return modes.includes('enemy') ? 'enemy' : modes.includes('allEnemies') ? 'allEnemies' : 'self';
}

export function cardRequiresEnemy(card: CardDefinition, upgraded = false): boolean {
  return cardTargetMode(card, upgraded) === 'enemy';
}

export interface CardDropLocation {
  enemyId?: string;
  inArena: boolean;
  overPlayer?: boolean;
}

export interface CardDropResult {
  valid: boolean;
  mode: CardTargetMode;
  targetId?: string;
  reason?: 'unavailable' | 'outside' | 'target';
}

/** UI-only validation. reduceCombat remains the authority for every accepted play. */
export function resolveCardDrop(
  state: CombatState,
  card: CardInstance,
  drop: CardDropLocation,
): CardDropResult {
  const definition = CARD_DEFINITIONS[card.cardId];
  const mode = definition ? cardTargetMode(definition, card.upgraded) : 'self';
  const currentCard = state.hand.find((candidate) => candidate.uid === card.uid);
  if (!definition || !currentCard || currentCard.cardId !== card.cardId ||
      currentCard.upgraded !== card.upgraded || !canPlayCard(state, card.uid)) {
    return { valid: false, mode, reason: 'unavailable' };
  }
  if (!drop.inArena) return { valid: false, mode, reason: 'outside' };
  if (mode === 'enemy') {
    const enemy = getEnemies(state).find((actor) => getEnemyKey(actor) === drop.enemyId && actor.hp > 0);
    if (!enemy || !canPlayCard(state, card.uid, getEnemyKey(enemy))) {
      return { valid: false, mode, reason: 'target' };
    }
    return { valid: true, mode, targetId: getEnemyKey(enemy) };
  }
  return { valid: true, mode };
}

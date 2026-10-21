import type { Actor, CardInstance, CombatState } from '../../types/game';
import { effectivePlayerStrength } from './relics';
import { getRelicCardDamageMultiplier, getRelicEnemyAttackMultiplier, getRelicEnemyWeakMultiplier, getRelicVulnerableMultiplier } from './relicModifiers';

/** Strength and both multipliers are evaluated per hit, then floored exactly once. */
export function calculateDamage(base: number, attacker: Actor, defender: Actor, modifiers: {
  weakMultiplier?: number; vulnerableMultiplier?: number; multiplier?: number;
} = {}): number {
  const strengthened = Math.max(0, base + attacker.strength);
  return Math.floor(
    strengthened * (attacker.weak > 0 ? modifiers.weakMultiplier ?? 0.75 : 1) *
    (defender.vulnerable > 0 ? modifiers.vulnerableMultiplier ?? 1.5 : 1) * (modifiers.multiplier ?? 1),
  );
}

/** Attack cards, previews and resumed hits use the same final-rounding rule. */
export function calculatePlayerAttackDamage(state: CombatState, base: number, defender: Actor, source: 'card' | 'potion' = 'card', sourceCard?: CardInstance): number {
  const attacker = { ...state.player, strength: source === 'potion' ? 0 : effectivePlayerStrength(state), weak: source === 'potion' ? 0 : state.player.weak };
  return calculateDamage(base, attacker, defender, {
    vulnerableMultiplier: getRelicVulnerableMultiplier(state),
    multiplier: source === 'potion' ? 1 : getRelicCardDamageMultiplier(state, sourceCard),
  });
}

/** Enemy-only protection never changes poison, card HP costs or summon attacks. */
export function calculateEnemyAttackDamage(state: CombatState, base: number, attacker: Actor, defender: Actor = state.player): number {
  return calculateDamage(base, attacker, defender, {
    weakMultiplier: getRelicEnemyWeakMultiplier(state),
    multiplier: getRelicEnemyAttackMultiplier(state),
  });
}

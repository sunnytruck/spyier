import type { Actor } from '../../types/game';

/** Strength and both multipliers are evaluated per hit, then floored exactly once. */
export function calculateDamage(base: number, attacker: Actor, defender: Actor): number {
  const strengthened = Math.max(0, base + attacker.strength);
  return Math.floor(
    strengthened * (attacker.weak > 0 ? 0.75 : 1) * (defender.vulnerable > 0 ? 1.5 : 1),
  );
}

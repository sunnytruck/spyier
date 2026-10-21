import { CARD_DEFINITIONS } from '../../data/cards';
import type { CardInstance, CombatState } from '../../types/game';

type MetricState = CombatState & {
  turnMetrics?: { skillsPlayed: number; energySpent: number; drawn: number; discarded: number; doomApplied: number };
  battleMetrics?: { etherealPlayed: number };
};

/** Write helpers belong only at committed engine boundaries, never read-only views. */
export function getTurnMetrics(state: MetricState): NonNullable<MetricState['turnMetrics']> {
  return state.turnMetrics ??= { skillsPlayed: 0, energySpent: 0, drawn: 0, discarded: 0, doomApplied: 0 };
}

const amountOf = (amount: number): number => Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;

export function recordDraw(state: MetricState, amount: number): void {
  const count = amountOf(amount);
  if (count) getTurnMetrics(state).drawn += count;
}

/** Only explicit card-effect discards count; playing a card and end-turn cleanup do not. */
export function recordDiscard(state: MetricState, amount: number): void {
  const count = amountOf(amount);
  if (count) getTurnMetrics(state).discarded += count;
}

/** Count the actual positive applied doom, including applications to separate enemies. */
export function recordDoom(state: MetricState, amount: number): void {
  const count = amountOf(amount);
  if (count) getTurnMetrics(state).doomApplied += count;
}

/** Call once after legal cost payment, before the played card resolves. */
export function recordCardPlay(state: MetricState, card: CardInstance, paidEnergy: number): void {
  const definition = CARD_DEFINITIONS[card.cardId];
  if (!definition) return;
  const turn = getTurnMetrics(state);
  if (definition.type === 'skill') turn.skillsPlayed += 1;
  turn.energySpent += amountOf(paidEnergy);
  const ethereal = card.upgraded ? definition.upgradedEthereal ?? definition.ethereal : definition.ethereal;
  if (ethereal) {
    state.battleMetrics ??= { etherealPlayed: 0 };
    state.battleMetrics.etherealPlayed += 1;
  }
}

/** Reset before the new turn's opening effects and normal five-card draw. */
export function resetTurnMetrics(state: MetricState): void {
  state.turnMetrics = { skillsPlayed: 0, energySpent: 0, drawn: 0, discarded: 0, doomApplied: 0 };
}

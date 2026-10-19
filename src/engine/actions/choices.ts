import type { CardInstance, CombatState } from '../../types/game';

export function getPendingChoiceCards(state: CombatState): CardInstance[] {
  return state.pendingChoice ? state[state.pendingChoice.sourceZone ?? 'hand'] : [];
}

export function getPendingChoiceLabel(state: CombatState): string {
  const choice = state.pendingChoice;
  if (!choice) return '';
  const source = choice.sourceZone === 'discardPile' ? '捨て札' : choice.sourceZone === 'drawPile' ? '山札' : '手札';
  return `${source}から${choice.amount}枚${choice.mode === 'topdeck' ? 'を山札の一番上に戻す' : choice.mode === 'retrieve' ? 'を手札に戻す' : choice.mode === 'discard' ? '捨てる' : '廃棄する'}`;
}

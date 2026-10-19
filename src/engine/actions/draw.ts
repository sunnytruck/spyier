import type { CombatState } from '../../types/game';
import { shuffle } from '../random';
import { appendLog } from '../combat/state';

/** Internal mutating helper: state must be a freshly created/reducer-owned copy. */
export function drawInto(state: CombatState, amount: number): void {
  for (let index = 0; index < Math.max(0, Math.floor(amount)); index += 1) {
    if (state.hand.length >= 50) {
      appendLog(state, '手札の上限50枚に達したため、ドローを止めた。');
      break;
    }
    if (state.drawPile.length === 0 && state.discardPile.length > 0) {
      const shuffled = shuffle(state.discardPile, state.rngState);
      state.drawPile = shuffled.values;
      state.discardPile = [];
      state.rngState = shuffled.rngState;
      appendLog(state, '捨て札をシャッフルして山札に戻した。');
    }
    const card = state.drawPile.pop();
    if (!card) break;
    state.hand.push(card);
  }
}

/** Public helper is immutable, like reduceCombat; use the returned state. */
export function drawCards(state: CombatState, amount: number): CombatState {
  const next = structuredClone(state);
  drawInto(next, amount);
  return next;
}

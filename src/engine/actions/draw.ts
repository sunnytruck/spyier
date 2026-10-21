import type { CardInstance, CombatState } from '../../types/game';
import { shuffle } from '../random';
import { triggerRelics } from '../combat/relics';
import { appendLog } from '../combat/state';
import { emitCombatCue, inheritCombatTrace } from '../../presentation/trace';
import { recordDraw } from '../combat/cardMetrics';

/** Internal mutating helper: state must be a freshly created/reducer-owned copy. */
export function drawInto(state: CombatState, amount: number): void {
  if (state.drawBlocked) { appendLog(state, 'このターンは追加のドローができない。'); return; }
  let drawn: CardInstance[] = [];
  const flush = () => {
    if (drawn.length) emitCombatCue(state, { kind: 'draw', card: drawn[0], cards: drawn, fromZone: 'drawPile', toZone: 'hand', amount: drawn.length });
    drawn = [];
  };
  for (let index = 0; index < Math.max(0, Math.floor(amount)); index += 1) {
    if (state.hand.length >= 50) {
      appendLog(state, '手札の上限50枚に達したため、ドローを止めた。');
      break;
    }
    if (state.drawPile.length === 0 && state.discardPile.length > 0) {
      flush();
      const reshuffled = [...state.discardPile];
      const shuffled = shuffle(state.discardPile, state.rngState);
      state.drawPile = shuffled.values;
      state.discardPile = [];
      state.rngState = shuffled.rngState;
      appendLog(state, '捨て札をシャッフルして山札に戻した。');
      emitCombatCue(state, { kind: 'discard', cards: reshuffled, fromZone: 'discardPile', toZone: 'drawPile', label: 'シャッフル' });
      triggerRelics(state, 'shuffle');
    }
    const card = state.drawPile.pop();
    if (!card) break;
    state.hand.push(card);
    recordDraw(state, 1);
    drawn.push(card);
  }
  flush();
}

/** Public helper is immutable, like reduceCombat; use the returned state. */
export function drawCards(state: CombatState, amount: number): CombatState {
  const next = structuredClone(state);
  inheritCombatTrace(state, next);
  drawInto(next, amount);
  return next;
}

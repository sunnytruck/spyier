import { CARD_DEFINITIONS } from '../../data/cards';
import type { CardInstance } from '../../types/game';
import type { RelicAcquisitionAction, RelicAcquisitionRun } from '../../types/relics';

/** A test-player policy. Every choice is still validated by the production reducer. */
export function chooseRelicAcquisitionAction<State extends RelicAcquisitionRun>(
  state: State,
  reduce: (state: State, action: RelicAcquisitionAction) => State,
  valueCard: (card: CardInstance, upgraded: boolean) => number = () => 0,
): RelicAcquisitionAction {
  const pending = state.relicAcquisition;
  if (state.screen !== 'relicAcquisition' || !pending) throw new Error('No active relic acquisition');
  if (pending.stage === 'result') return { type: 'continueRelicAcquisition' };
  if (pending.kind === 'chooseCard') {
    const candidates = pending.offeredCardIds.map((cardId) => ({
      uid: `policy-${cardId}`, cardId, upgraded: false,
    }));
    const cardIds = candidates.sort((left, right) => valueCard(right, false) - valueCard(left, false))
      .slice(0, pending.count).map((card) => card.cardId);
    if (cardIds.length < pending.minCount) throw new Error('Insufficient relic card offers');
    if (JSON.stringify(pending.selectedCardIds) !== JSON.stringify(cardIds)) {
      const action: RelicAcquisitionAction = { type: 'selectRelicCards', cardIds };
      if (reduce(state, action) === state) throw new Error('Relic card selection was rejected');
      return action;
    }
  } else {
    const eligible = state.deck.filter((card) => pending.eligibleCardUids.includes(card.uid));
    const score = (card: CardInstance) => pending.kind === 'upgrade'
      ? valueCard(card, true) - valueCard(card, card.upgraded)
      : pending.kind === 'copy' ? valueCard(card, card.upgraded) : -valueCard(card, card.upgraded);
    const cardUids = eligible.sort((left, right) => score(right) - score(left))
      .slice(0, pending.count).map((card) => card.uid);
    if (cardUids.length < pending.minCount) throw new Error('Insufficient relic card targets');
    if (JSON.stringify(pending.selectedCardUids) !== JSON.stringify(cardUids)) {
      const action: RelicAcquisitionAction = { type: 'selectRelicCards', cardUids };
      if (reduce(state, action) === state) throw new Error('Relic target selection was rejected');
      return action;
    }
  }
  const action: RelicAcquisitionAction = { type: 'confirmRelicAcquisition' };
  if (reduce(state, action) === state) {
    const name = CARD_DEFINITIONS[pending.offeredCardIds[0]]?.name ?? pending.relicId;
    throw new Error(`Relic confirmation was rejected: ${name}`);
  }
  return action;
}

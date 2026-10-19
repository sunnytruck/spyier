import type { BlessingAction, BlessingOption, BlessingRun } from '../../types/blessing';
import type { CardInstance } from '../../types/game';

/** Test-player preference only; the production reducer decides availability and every effect. */
function optionValue(state: BlessingRun, option: BlessingOption): number {
  const reward = option.rewards.reduce((sum, effect) => sum + (
    effect.kind === 'heal' ? Math.min(effect.amount, state.maxHp - state.hp) * 3 :
    effect.kind === 'maxHp' ? effect.amount * 2.5 :
    effect.kind === 'gold' ? effect.amount * 0.2 :
    effect.kind === 'relic' ? 35 :
    effect.kind === 'cards' ? effect.cardIds.length * 12 :
    effect.kind === 'upgrade' ? effect.amount * 16 : effect.amount * 8
  ), 0);
  return reward - option.costs.reduce((sum, cost) => sum + cost.amount * (
    cost.kind === 'hp' ? 2.5 : cost.kind === 'maxHp' ? 3 : cost.kind === 'gold' ? 0.25 : 20
  ), 0);
}

/**
 * Uses only public, immutable reducer probes to reject unavailable choices.
 * Probing never commits rewards or advances the live game's random stream.
 */
export function chooseBlessingAction<State extends BlessingRun>(
  state: State,
  reduce: (state: State, action: BlessingAction) => State,
  valueCard: (card: CardInstance, upgraded: boolean) => number = () => 0,
): BlessingAction {
  const encounter = state.blessing;
  if (state.screen !== 'blessing' || !encounter) throw new Error('No active blessing');
  if (encounter.stage === 'result') return { type: 'continueBlessing' };
  if (encounter.stage === 'confirm') return { type: 'confirmBlessing' };
  if (encounter.stage === 'offer') {
    const available = encounter.options.filter((option) =>
      reduce(state, { type: 'chooseBlessing', optionId: option.id }) !== state,
    );
    const best = [...available].sort((left, right) => optionValue(state, right) - optionValue(state, left))[0];
    if (!best) throw new Error('No legal blessing option');
    return { type: 'chooseBlessing', optionId: best.id };
  }
  const option = encounter.options.find((candidate) => candidate.id === encounter.selectedOptionId);
  if (!option?.target) throw new Error('Missing blessing target contract');
  const eligible = state.deck.filter((card) => option.target!.eligibleCardUids.includes(card.uid));
  const score = (card: CardInstance) => option.target!.kind === 'upgrade'
    ? valueCard(card, true) - valueCard(card, false) : -valueCard(card, card.upgraded);
  const targets = [...eligible].sort((left, right) => score(right) - score(left));
  const action: BlessingAction = {
    type: 'selectBlessingTargets', cardUids: targets.slice(0, option.target.count).map((card) => card.uid),
  };
  if (reduce(state, action) === state) throw new Error('No legal blessing targets');
  return action;
}

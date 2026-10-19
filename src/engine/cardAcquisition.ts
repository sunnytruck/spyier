import type { CardDefinition } from '../types/game';

export type CardAcquisitionCategory = NonNullable<CardDefinition['acquisition']>;

/** Old token flags remain a hard exclusion even if future metadata conflicts. */
export function getCardAcquisitionCategory(card: CardDefinition): CardAcquisitionCategory {
  return card.tokenOnly ? 'generatedOnly' : card.acquisition ?? 'normal';
}

/** A category/whitelist cannot turn a basic, curse, placeholder, or token into a reward. */
export function isAcquirableCard(card: CardDefinition): boolean {
  return !card.tokenOnly && card.rewardEligible !== false && !card.curse && !card.unplayable &&
    card.effects.length > 0 && card.upgradedEffects.length > 0;
}

export function isNormalAcquisitionCard(card: CardDefinition): boolean {
  return getCardAcquisitionCategory(card) === 'normal' && isAcquirableCard(card);
}

export function isBlessingAcquisitionCard(card: CardDefinition): boolean {
  return getCardAcquisitionCategory(card) === 'blessingOnly' && isAcquirableCard(card);
}

export const CARD_ACQUISITION_LABELS: Record<CardAcquisitionCategory, string> = {
  normal: '通常取得', blessingOnly: '祝福限定', generatedOnly: '生成専用',
};

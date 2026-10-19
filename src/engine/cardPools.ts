import { CARD_DEFINITIONS, LEGACY_CARD_IDS } from '../data/cards';
import type { ClassId } from '../types/game';
import { isBlessingAcquisitionCard, isNormalAcquisitionCard } from './cardAcquisition';

export type CardAcquisitionSource = 'combat' | 'shop' | 'event';

/** Cross-class rewards require both an explicit opt-in and named classes. */
export interface EventCardPoolPolicy {
  includeOwnClass?: boolean;
  includeColorless?: boolean;
  additionalClassIds?: readonly ClassId[];
  allowOtherClasses?: boolean;
  /** A whitelist can narrow the permitted pool, but cannot bypass its ownership rules. */
  cardIds?: readonly string[];
}

/** Only engine-backed cards are in CARD_DEFINITIONS; source-only records never enter this pool. */
export function getCardPool(
  classId: ClassId | undefined,
  source: CardAcquisitionSource,
  policy: EventCardPoolPolicy = {},
): string[] {
  // Old runs have no class. Freeze their original pool and order for save/seed compatibility.
  if (!classId) return LEGACY_CARD_IDS.filter((id) => isNormalAcquisitionCard(CARD_DEFINITIONS[id]));

  const permittedClasses = new Set<string>();
  if (source === 'combat') permittedClasses.add(classId);
  else if (source === 'shop') {
    permittedClasses.add(classId);
    permittedClasses.add('colorless');
  } else {
    if (policy.includeOwnClass !== false) permittedClasses.add(classId);
    if (policy.includeColorless !== false) permittedClasses.add('colorless');
    if (policy.allowOtherClasses === true)
      for (const additional of policy.additionalClassIds ?? []) permittedClasses.add(additional);
  }

  const whitelist = source === 'event' && policy.cardIds ? new Set(policy.cardIds) : null;
  return Object.values(CARD_DEFINITIONS)
    .filter(
      (card) =>
        card.classId !== undefined &&
        permittedClasses.has(card.classId) &&
        isNormalAcquisitionCard(card) &&
        (!whitelist || whitelist.has(card.id)),
    )
    .map((card) => card.id);
}

/** An optional character whitelist can only narrow explicit, implemented blessing cards. */
export function getBlessingCardPool(classId: ClassId | undefined, characterCardIds?: readonly string[]): string[] {
  const whitelist = characterCardIds ? new Set(characterCardIds) : null;
  return Object.values(CARD_DEFINITIONS)
    .filter((card) => isBlessingAcquisitionCard(card) &&
      (card.classId === 'colorless' || (classId !== undefined && card.classId === classId)) &&
      (!whitelist || whitelist.has(card.id)))
    .map((card) => card.id);
}

import { CARD_DEFINITIONS } from '../data/cards';
import type { CardDefinition, Effect } from '../types/game';
import { nextRandom } from './random';
import { isNormalAcquisitionCard } from './cardAcquisition';

export type RewardTier = 'battle' | 'elite' | 'boss' | 'shop';
type Rarity = NonNullable<CardDefinition['rarity']>;

/** IWASON balance settings, not rarity information supplied by the reference TXT. */
export const REWARD_RARITY_WEIGHTS: Record<RewardTier, Record<Rarity, number>> = {
  battle: { common: 60, uncommon: 33, rare: 7 },
  elite: { common: 45, uncommon: 40, rare: 15 },
  boss: { common: 0, uncommon: 0, rare: 100 },
  shop: { common: 40, uncommon: 45, rare: 15 },
};

export const RARITY_CARD_PRICES: Record<Rarity, number> = { common: 45, uncommon: 65, rare: 95 };

/** Broad mechanics, rather than a preferred deck, gently diversify a single offer. */
export function cardBuildFamilies(card: CardDefinition): Set<string> {
  const result = new Set<string>();
  const visit = (effect: Effect): void => {
    switch (effect.type) {
      case 'damage':
        if (effect.fromBlock) result.add('block-attack');
        if (effect.fromForge) result.add('forge');
        if ((effect.hits ?? 1) > 1) result.add('multi-hit');
        break;
      case 'status': case 'temporaryStatus':
        if (effect.status === 'strength') result.add('strength');
        if (effect.status === 'poison') result.add('poison');
        break;
      case 'multiplyPoison': result.add('poison'); break;
      case 'loseHp': result.add('hp-payment'); break;
      case 'exhaustChoice': case 'exhaustRandom': result.add('exhaust'); break;
      case 'discard': result.add('discard'); break;
      case 'generate': if (effect.cardId === 'token_knife') result.add('knife'); break;
      case 'channel': result.add(effect.orb); break;
      case 'xChannel': result.add(effect.orb); break;
      case 'evoke': result.add('evoke'); break;
      case 'focus': result.add('focus'); break;
      case 'summon': case 'summonDamage': result.add('summon'); break;
      case 'soul': result.add('soul'); break;
      case 'doom': result.add('doom'); break;
      case 'gainStars': case 'starBurst': result.add('stars'); break;
      case 'forge': case 'fetchGenerated': result.add('forge'); break;
      case 'power': case 'temporaryPower': result.add(effect.power); break;
      case 'conditional': case 'nextTurn': effect.effects.forEach(visit); break;
      case 'moveChoice': case 'drawTo': case 'redraw': result.add('hand-management'); break;
      case 'multiply': result.add(effect.resource === 'block' ? 'block-attack' : 'energy'); break;
    }
  };
  card.effects.forEach(visit);
  if (card.exhaust) result.add('exhaust');
  if (card.retain) result.add('retain');
  return result;
}

/** Seeded sampling without replacement. Missing rarity groups fall back to available groups. */
export function sampleCardRewards(
  pool: readonly string[],
  rngState: number,
  tier: RewardTier,
  count = 3,
  previousChoices: readonly string[] = [],
): { cardIds: string[]; rngState: number } {
  const remaining = [...new Set(pool)].filter((id) => {
    const card = CARD_DEFINITIONS[id];
    return card && isNormalAcquisitionCard(card) && !previousChoices.includes(id) &&
      (tier !== 'boss' || card.rarity === 'rare');
  });
  const rareFallback = tier === 'boss' ? [...remaining] : [];
  const cardIds: string[] = [];
  const shownFamilies = new Set(previousChoices.flatMap((id) => [...cardBuildFamilies(CARD_DEFINITIONS[id])]));
  const roll = () => {
    const result = nextRandom(rngState);
    rngState = result.state;
    return result.value;
  };
  while (cardIds.length < Math.max(0, Math.floor(count)) && remaining.length) {
    const rarities = (['common', 'uncommon', 'rare'] as const).filter((rarity) =>
      remaining.some((id) => (CARD_DEFINITIONS[id].rarity ?? 'common') === rarity),
    );
    const weights = REWARD_RARITY_WEIGHTS[tier];
    let rarityRoll = roll() * rarities.reduce((sum, rarity) => sum + weights[rarity], 0);
    const rarity = rarities.find((entry) => (rarityRoll -= weights[entry]) < 0) ?? rarities.at(-1)!;
    const candidates = remaining.filter((id) => (CARD_DEFINITIONS[id].rarity ?? 'common') === rarity);
    const varietyWeights = candidates.map((id) => {
      const families = cardBuildFamilies(CARD_DEFINITIONS[id]);
      return families.size > 0 && [...families].every((family) => shownFamilies.has(family)) ? 0.8 : 1;
    });
    let cardRoll = roll() * varietyWeights.reduce((sum, weight) => sum + weight, 0);
    const index = varietyWeights.findIndex((weight) => (cardRoll -= weight) < 0);
    const id = candidates[index < 0 ? candidates.length - 1 : index];
    cardIds.push(id);
    cardBuildFamilies(CARD_DEFINITIONS[id]).forEach((family) => shownFamilies.add(family));
    remaining.splice(remaining.indexOf(id), 1);
  }
  // A class with fewer than three implemented rares still gets three legal offers.
  // Exhaust distinct rares first; never substitute a nonrare or alter source rarity metadata.
  while (tier === 'boss' && cardIds.length < Math.max(0, Math.floor(count)) && rareFallback.length)
    cardIds.push(rareFallback[Math.floor(roll() * rareFallback.length)]);
  return { cardIds, rngState };
}

export function newShopCardPrice(cardId: string): number {
  const card = CARD_DEFINITIONS[cardId];
  return RARITY_CARD_PRICES[card.rarity ?? 'common'] + (card.classId === 'colorless' ? 10 : 0);
}

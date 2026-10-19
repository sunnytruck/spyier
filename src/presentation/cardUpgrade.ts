import { CARD_DEFINITIONS } from '../data/cards';
import type { CardDefinition, CardInstance, Effect } from '../types/game';

export interface CardPresentation {
  card: CardInstance;
  name: string;
  cost: number | 'X';
  description: string;
  keywords: string[];
  effects: Effect[];
}

export interface CardUpgradePreviewData {
  before: CardPresentation;
  after: CardPresentation;
  changes: {
    name: boolean;
    cost: boolean;
    description: boolean;
    keywords: boolean;
  };
}

export interface CardTextSegment {
  text: string;
  changed: boolean;
}

function keywordsFor(definition: CardDefinition, upgraded: boolean): string[] {
  const result: string[] = [];
  if (definition.defense) result.push('防御');
  if (upgraded ? (definition.upgradedExhaust ?? definition.exhaust) : definition.exhaust)
    result.push('廃棄');
  if (upgraded ? (definition.upgradedRetain ?? definition.retain) : definition.retain)
    result.push('保留');
  if (definition.ethereal) result.push('エセリアル');
  if (definition.innate) result.push('天賦');
  return result;
}

/** Read the same normal/upgraded fields that the combat engine resolves. */
export function getCardPresentation(card: CardInstance): CardPresentation | null {
  const definition = CARD_DEFINITIONS[card.cardId];
  if (!definition) return null;
  return {
    card: { ...card },
    name: `${definition.name}${card.upgraded ? '＋' : ''}`,
    cost: definition.xCost ? 'X' : card.upgraded
      ? (definition.upgradedCost ?? definition.cost)
      : definition.cost,
    description: card.upgraded ? definition.upgradedDescription : definition.description,
    keywords: keywordsFor(definition, card.upgraded),
    effects: structuredClone(card.upgraded ? definition.upgradedEffects : definition.effects),
  };
}

export function canUpgradeCard(card: CardInstance): boolean {
  return !!CARD_DEFINITIONS[card.cardId] && !card.upgraded;
}

/** Pure presentation data: previewing never changes the supplied card or its definition. */
export function getCardUpgradePreview(card: CardInstance): CardUpgradePreviewData | null {
  const before = getCardPresentation({ ...card, upgraded: false });
  const after = getCardPresentation({ ...card, upgraded: true });
  if (!before || !after) return null;
  return {
    before,
    after,
    changes: {
      name: before.name !== after.name,
      cost: before.cost !== after.cost,
      description: before.description !== after.description,
      keywords: before.keywords.join('\u0000') !== after.keywords.join('\u0000'),
    },
  };
}

/** Keep text verbatim; mark the added/replaced tokens in the second string. */
export function diffCardText(before: string, after: string): CardTextSegment[] {
  const tokenize = (text: string) => text.match(/\d+(?:\.\d+)?|[^\d]/gu) ?? [];
  const oldTokens = tokenize(before);
  const newTokens = tokenize(after);
  const lengths = Array.from({ length: oldTokens.length + 1 }, () =>
    new Uint32Array(newTokens.length + 1));
  for (let i = oldTokens.length - 1; i >= 0; i -= 1) {
    for (let j = newTokens.length - 1; j >= 0; j -= 1) {
      lengths[i][j] = oldTokens[i] === newTokens[j]
        ? lengths[i + 1][j + 1] + 1
        : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const segments: CardTextSegment[] = [];
  const append = (text: string, changed: boolean) => {
    const previous = segments.at(-1);
    if (previous?.changed === changed) previous.text += text;
    else segments.push({ text, changed });
  };
  let i = 0;
  let j = 0;
  while (j < newTokens.length) {
    if (i < oldTokens.length && oldTokens[i] === newTokens[j]) {
      append(newTokens[j++], false);
      i += 1;
    } else if (i < oldTokens.length && lengths[i + 1][j] >= lengths[i][j + 1]) {
      i += 1;
    } else append(newTokens[j++], true);
  }
  return segments;
}

import type { CardDefinition, Effect } from '../types/game';
import type { SourceClassId } from '../types/catalog';
import catalog from './sourceCardIndex.generated.json';

export interface PlayableInput {
  id: string;
  sourceName: string;
  classId: SourceClassId;
  name: string;
  type: CardDefinition['type'];
  glyph: string;
  description: string;
  upgradedDescription: string;
  effects: Effect[];
  upgradedEffects: Effect[];
  rarity?: CardDefinition['rarity'];
  options?: Partial<CardDefinition>;
}

/** Every playable adaptation explicitly identifies its reference. No lexical parsing executes effects. */
export function createReferenceCard(input: PlayableInput): CardDefinition {
  const source = catalog.cards.find((entry) => entry.sourceClass === input.classId && entry.sourceName === input.sourceName);
  if (!source) throw new Error(`Unknown source card: ${input.classId}/${input.sourceName}`);
  const xCost = source.normal.costRaw === 'X';
  const cost = xCost ? 0 : Number(source.normal.costRaw);
  const upgradedCost = source.upgraded.costRaw === 'X' ? 0 : Number(source.upgraded.costRaw);
  if (!Number.isInteger(cost) || !Number.isInteger(upgradedCost)) throw new Error(`Unresolved source cost: ${source.sourceId}`);
  return {
    id: input.id, classId: input.classId, sourceCardId: source.sourceId,
    name: input.name, type: input.type, cost, upgradedCost, xCost,
    defense: input.type === 'skill' && input.effects.some((effect) => effect.type === 'block'),
    description: input.description, upgradedDescription: input.upgradedDescription,
    flavor: '教義は石に刻む。作戦は手札で変える。', glyph: input.glyph,
    rarity: input.rarity ?? 'common', metadataProvisional: true,
    effects: input.effects, upgradedEffects: input.upgradedEffects,
    ...input.options,
  };
}


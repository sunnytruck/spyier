import { afterEach, describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS, LEGACY_CARD_IDS } from '../data/cards';
import { BLESSING_CARD_REGISTRY } from '../data/blessingCardRegistry';
import { getBlessingCardPool, getCardPool } from '../engine/cardPools';
import { getCardAcquisitionCategory, isBlessingAcquisitionCard, isNormalAcquisitionCard } from '../engine/cardAcquisition';
import { sampleCardRewards } from '../engine/rewards';
import { seedToState } from '../engine/random';
import type { CardDefinition, ClassId } from '../types/game';

const classes: ClassId[] = ['berserker', 'assassin', 'oracle', 'necromancer', 'machinist'];
const addedIds: string[] = [];
const replacements = new Map<string, CardDefinition>();

function add(id: string, patch: Partial<CardDefinition> = {}): CardDefinition {
  const definition: CardDefinition = {
    ...CARD_DEFINITIONS.stone_strike, id: `test-blessing-${id}`, name: `試験専用 ${id}`,
    classId: 'colorless', rewardEligible: true, effects: [{ type: 'damage', amount: 1 }],
    upgradedEffects: [{ type: 'damage', amount: 2 }], ...patch,
  };
  addedIds.push(definition.id);
  CARD_DEFINITIONS[definition.id] = definition;
  return definition;
}

afterEach(() => {
  for (const id of addedIds.splice(0)) delete CARD_DEFINITIONS[id];
  for (const [id, card] of replacements) CARD_DEFINITIONS[id] = card;
  replacements.clear();
});

describe('limited-card acquisition metadata remains explicit and fail-closed', () => {
  it('classifies exactly the eight explicit source-backed cards from the provided limited list', () => {
    expect(BLESSING_CARD_REGISTRY.status).toBe('ready');
    expect(BLESSING_CARD_REGISTRY.unresolvedCardNames).toEqual([]);
    const limited = Object.values(CARD_DEFINITIONS).filter((card) => getCardAcquisitionCategory(card) === 'blessingOnly');
    expect(limited.map((card) => card.id).sort()).toEqual([...BLESSING_CARD_REGISTRY.matchedCardIds].sort());
    expect(limited).toHaveLength(8);
    expect(limited.every((card) => card.sourceCardId)).toBe(true);
    for (const classId of classes) expect(getBlessingCardPool(classId).sort()).toEqual([...BLESSING_CARD_REGISTRY.matchedCardIds].sort());
  });

  it('keeps old untagged cards normal and old token flags generated-only', () => {
    expect(getCardAcquisitionCategory(CARD_DEFINITIONS.stone_strike)).toBe('normal');
    expect(getCardAcquisitionCategory(CARD_DEFINITIONS.token_knife)).toBe('generatedOnly');
    const conflicting = add('conflicting-token', { acquisition: 'blessingOnly', tokenOnly: true });
    expect(getCardAcquisitionCategory(conflicting)).toBe('generatedOnly');
    expect(isBlessingAcquisitionCard(conflicting)).toBe(false);
    expect(isNormalAcquisitionCard(conflicting)).toBe(false);
  });

  it.each(classes)('%s blessing pool includes only eligible own-class and colorless limited cards', (classId) => {
    const own = add('own', { classId, acquisition: 'blessingOnly' });
    const shared = add('shared', { acquisition: 'blessingOnly' });
    const foreign = add('foreign', { classId: classes.find((id) => id !== classId), acquisition: 'blessingOnly' });
    const normal = add('normal', { classId });
    const generated = add('generated', { classId, acquisition: 'generatedOnly' });
    const legacyToken = add('token', { classId, acquisition: 'blessingOnly', tokenOnly: true });
    const basic = add('basic', { classId, acquisition: 'blessingOnly', rewardEligible: false });
    const curse = add('curse', { classId, acquisition: 'blessingOnly', curse: true });
    const unplayable = add('unplayable', { classId, acquisition: 'blessingOnly', unplayable: true });
    const missingNormal = add('missing-normal', { classId, acquisition: 'blessingOnly', effects: [] });
    const missingUpgrade = add('missing-upgrade', { classId, acquisition: 'blessingOnly', upgradedEffects: [] });
    expect(getBlessingCardPool(classId)).toEqual([...Object.keys(CARD_DEFINITIONS).filter((id) => BLESSING_CARD_REGISTRY.matchedCardIds.includes(id)), own.id, shared.id]);
    const ids = [own, shared, foreign, normal, generated, legacyToken, basic, curse, unplayable, missingNormal, missingUpgrade].map((card) => card.id);
    expect(getBlessingCardPool(classId, ids)).toEqual([own.id, shared.id]);
    expect(getBlessingCardPool(classId, [shared.id, foreign.id, normal.id, 'missing'])).toEqual([shared.id]);
    expect(getBlessingCardPool(classId, [])).toEqual([]);
  });

  it.each(classes)('%s every ordinary acquisition path rejects blessing and generation categories', (classId) => {
    const blessing = add('blessing', { classId, acquisition: 'blessingOnly' });
    const colorlessBlessing = add('colorless-blessing', { acquisition: 'blessingOnly' });
    const generated = add('generated', { classId, acquisition: 'generatedOnly' });
    const normal = add('normal', { classId, acquisition: 'normal' });
    for (const source of ['combat', 'shop', 'event'] as const) {
      const pool = getCardPool(classId, source, {
        includeOwnClass: true, includeColorless: true, allowOtherClasses: true, additionalClassIds: classes,
        cardIds: [blessing.id, colorlessBlessing.id, generated.id, normal.id],
      });
      expect(pool).toContain(normal.id);
      expect(pool).not.toContain(blessing.id);
      expect(pool).not.toContain(colorlessBlessing.id);
      expect(pool).not.toContain(generated.id);
    }
  });

  it('legacy pool keeps its exact order and applies an explicit later reclassification', () => {
    for (const source of ['combat', 'shop', 'event'] as const) expect(getCardPool(undefined, source)).toEqual(LEGACY_CARD_IDS);
    const id = LEGACY_CARD_IDS[0];
    replacements.set(id, CARD_DEFINITIONS[id]);
    CARD_DEFINITIONS[id] = { ...CARD_DEFINITIONS[id], acquisition: 'blessingOnly' };
    for (const source of ['combat', 'shop', 'event'] as const) expect(getCardPool(undefined, source)).toEqual(LEGACY_CARD_IDS.slice(1));
  });

  it('a raw caller-provided reward pool cannot bypass category and playability exclusions', () => {
    const blessing = add('blessing', { acquisition: 'blessingOnly' });
    const generated = add('generated', { acquisition: 'generatedOnly' });
    const empty = add('empty', { effects: [] });
    const normal = add('normal', { rarity: 'rare' });
    for (const tier of ['battle', 'elite', 'boss', 'shop'] as const) {
      const sampled = sampleCardRewards([blessing.id, generated.id, empty.id, normal.id], seedToState(`category-${tier}`), tier, 4);
      expect(sampled.cardIds).toEqual(Array.from({ length: tier === 'boss' ? 4 : 1 }, () => normal.id));
      const none = sampleCardRewards([blessing.id, generated.id, empty.id], sampled.rngState, tier, 3);
      expect(none.cardIds).toEqual([]);
      expect(none.rngState).toBe(sampled.rngState);
    }
  });

  it('ordinary random rewards keep the same seeded result when excluded categories are appended', () => {
    const ordinary = getCardPool('assassin', 'combat');
    const blessing = add('blessing', { classId: 'assassin', acquisition: 'blessingOnly' });
    const generated = add('generated', { classId: 'assassin', acquisition: 'generatedOnly' });
    const rng = seedToState('category-compatibility');
    expect(sampleCardRewards([...ordinary, blessing.id, generated.id], rng, 'battle')).toEqual(sampleCardRewards(ordinary, rng, 'battle'));
  });
});

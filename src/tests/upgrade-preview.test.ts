import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import { CLASS_IDS } from '../data/classes';
import { createCombat, getCardCost, reduceCombat } from '../engine';
import { createRun, reduceRun } from '../engine/run';
import {
  canUpgradeCard,
  diffCardText,
  getCardPresentation,
  getCardUpgradePreview,
} from '../presentation/cardUpgrade';
import type { CardInstance, ClassId, CombatState } from '../types/game';

const instance = (cardId: string, upgraded = false): CardInstance => ({
  uid: 'preview-card', cardId, upgraded,
});

function oneCardBattle(cardId: string, upgraded: boolean, classId?: ClassId): CombatState {
  const state = createCombat(`preview-combat-${cardId}`, 'grit_scout', {
    deck: [instance(cardId, upgraded)], classId,
  });
  state.energy = 3;
  state.player.block = 10;
  state.enemy.hp = 500;
  state.enemy.maxHp = 500;
  return state;
}

describe('upgrade previews read actual normal and upgraded card definitions', () => {
  it.each(Object.values(CARD_DEFINITIONS))('$id projects exact costs, prose, effects and keyword rules', (definition) => {
    const card = instance(definition.id);
    const savedCard = JSON.stringify(card);
    const savedDefinition = JSON.stringify(definition);
    const preview = getCardUpgradePreview(card)!;
    expect(preview.before.card).toEqual(card);
    expect(preview.before.name).toBe(definition.name);
    expect(preview.before.cost).toBe(definition.xCost ? 'X' : definition.cost);
    expect(preview.before.description).toBe(definition.description);
    expect(preview.before.effects).toEqual(definition.effects);
    expect(preview.after.card).toEqual({ ...card, upgraded: true });
    expect(preview.after.name).toBe(`${definition.name}＋`);
    expect(preview.after.cost).toBe(definition.xCost ? 'X' : definition.upgradedCost ?? definition.cost);
    expect(preview.after.description).toBe(definition.upgradedDescription);
    expect(preview.after.effects).toEqual(definition.upgradedEffects);

    for (const [presentation, upgraded] of [[preview.before, false], [preview.after, true]] as const) {
      expect(presentation.keywords.includes('廃棄'))
        .toBe(!!(upgraded ? definition.upgradedExhaust ?? definition.exhaust : definition.exhaust));
      expect(presentation.keywords.includes('保留'))
        .toBe(!!(upgraded ? definition.upgradedRetain ?? definition.retain : definition.retain));
      expect(presentation.keywords.includes('防御')).toBe(definition.defense);
      expect(presentation.keywords.includes('エセリアル')).toBe(!!definition.ethereal);
      expect(presentation.keywords.includes('天賦')).toBe(!!definition.innate);
    }
    expect(preview.changes.cost).toBe(preview.before.cost !== preview.after.cost);
    expect(preview.changes.description).toBe(definition.description !== definition.upgradedDescription);
    expect(getCardPresentation({ ...card, upgraded: true })).toEqual(preview.after);
    expect(canUpgradeCard(card)).toBe(!definition.unupgradable);
    expect(canUpgradeCard({ ...card, upgraded: true })).toBe(false);
    expect(JSON.stringify(card)).toBe(savedCard);
    expect(JSON.stringify(definition)).toBe(savedDefinition);

    // Both versions must preserve all punctuation, spaces and complete long descriptions.
    expect(diffCardText(preview.before.description, preview.after.description).map((part) => part.text).join(''))
      .toBe(definition.upgradedDescription);
    expect(diffCardText(preview.after.description, preview.before.description).map((part) => part.text).join(''))
      .toBe(definition.description);
  });

  it('covers each profession, colorless rewards and the legacy card pool', () => {
    for (const classId of CLASS_IDS) {
      const cards = Object.values(CARD_DEFINITIONS).filter((card) => card.classId === classId);
      expect(cards.length).toBeGreaterThan(0);
      expect(cards.every((card) => getCardUpgradePreview(instance(card.id)) !== null)).toBe(true);
    }
    expect(getCardUpgradePreview(instance('colorless_flash'))).not.toBeNull();
    expect(getCardUpgradePreview(instance('stone_strike'))).not.toBeNull();
  });

  it('does not expose unknown definitions as upgradeable cards', () => {
    expect(getCardUpgradePreview(instance('missing-card'))).toBeNull();
    expect(getCardPresentation(instance('missing-card'))).toBeNull();
    expect(canUpgradeCard(instance('missing-card'))).toBe(false);
  });

  it('returns detached card and effect data so an inspection cannot change combat definitions', () => {
    const card = instance('assassin_poison_sting');
    const saved = JSON.stringify(CARD_DEFINITIONS[card.cardId]);
    const preview = getCardUpgradePreview(card)!;
    preview.before.card.upgraded = true;
    preview.after.effects[0] = { type: 'damage', amount: 9999 };
    preview.before.effects.push({ type: 'heal', amount: 9999 });
    preview.after.keywords.push('presentation-only');
    expect(card.upgraded).toBe(false);
    expect(JSON.stringify(CARD_DEFINITIONS[card.cardId])).toBe(saved);
    expect(getCardUpgradePreview(card)!.after.effects).toEqual(CARD_DEFINITIONS[card.cardId].upgradedEffects);
  });
});

describe('different upgrade patterns agree with real combat and rest confirmation', () => {
  it('shows a cost reduction from 1 to 0 and combat charges the displayed cost', () => {
    const preview = getCardUpgradePreview(instance('berserker_body_slam'))!;
    expect(preview.before.cost).toBe(1);
    expect(preview.after.cost).toBe(0);
    expect(preview.changes.cost).toBe(true);
    for (const upgraded of [false, true]) {
      const state = oneCardBattle('berserker_body_slam', upgraded, 'berserker');
      const after = reduceCombat(state, { type: 'playCard', cardId: 'preview-card' });
      expect(after.energy).toBe(state.energy - (upgraded ? 0 : 1));
      expect(state.enemy.hp - after.enemy.hp).toBe(10);
    }
  });

  it('shows the exact damage and poison values that the upgraded attack applies', () => {
    const preview = getCardUpgradePreview(instance('assassin_poison_sting'))!;
    expect(preview.before.description).toBe('6ダメージ。毒3。');
    expect(preview.after.description).toBe('8ダメージ。毒4。');
    for (const upgraded of [false, true]) {
      const state = oneCardBattle('assassin_poison_sting', upgraded, 'assassin');
      const after = reduceCombat(state, { type: 'playCard', cardId: 'preview-card' });
      expect(state.enemy.hp - after.enemy.hp).toBe(upgraded ? 8 : 6);
      expect(after.enemy.poison).toBe(upgraded ? 4 : 3);
    }
  });

  it('shows X cost without substituting the numeric zero stored in the definition', () => {
    const preview = getCardUpgradePreview(instance('machinist_tempest'))!;
    expect(preview.before.cost).toBe('X');
    expect(preview.after.cost).toBe('X');
    expect(preview.changes.cost).toBe(false);
    expect(preview.before.effects).toContainEqual({ type: 'xChannel', orb: 'lightning', bonus: 0 });
    expect(preview.after.effects).toContainEqual({ type: 'xChannel', orb: 'lightning', bonus: 1 });
    for (const upgraded of [false, true]) {
      const state = oneCardBattle('machinist_tempest', upgraded, 'machinist');
      expect(getCardCost(state.hand[0], state)).toBe(3);
      const after = reduceCombat(state, { type: 'playCard', cardId: 'preview-card' });
      expect(after.energy).toBe(0);
      expect(after.classResources!.orbs).toHaveLength(3);
      expect(state.enemy.hp - after.enemy.hp).toBe(upgraded ? 8 : 0);
    }
  });

  it('shows removal of exhaust and the played card goes to the corresponding real zone', () => {
    const preview = getCardUpgradePreview(instance('machinist_hotfix'))!;
    expect(preview.before.keywords).toContain('廃棄');
    expect(preview.after.keywords).not.toContain('廃棄');
    expect(preview.changes.keywords).toBe(true);
    for (const upgraded of [false, true]) {
      const state = oneCardBattle('machinist_hotfix', upgraded, 'machinist');
      const after = reduceCombat(state, { type: 'playCard', cardId: 'preview-card' });
      expect(after.classResources!.focus).toBe(2);
      expect(after.exhaustPile.some((card) => card.uid === 'preview-card')).toBe(!upgraded);
      expect(after.discardPile.some((card) => card.uid === 'preview-card')).toBe(upgraded);
    }
  });

  it('shows added retain and end-turn processing really keeps only the upgraded version', () => {
    const preview = getCardUpgradePreview(instance('necromancer_wisp'))!;
    expect(preview.before.keywords).not.toContain('保留');
    expect(preview.after.keywords).toContain('保留');
    expect(preview.changes.keywords).toBe(true);
    for (const upgraded of [false, true]) {
      const state = oneCardBattle('necromancer_wisp', upgraded, 'necromancer');
      // Keep enough draw cards that an unretained test card will not immediately reshuffle back.
      const filler = Array.from({ length: 10 }, (_, index) => ({
        uid: `filler-${index}`, cardId: 'necromancer_guard', upgraded: false,
      }));
      state.deck.push(...filler);
      state.drawPile.push(...filler);
      const after = reduceCombat(state, { type: 'endTurn' });
      expect(after.hand.some((card) => card.uid === 'preview-card')).toBe(upgraded);
      expect(after.discardPile.some((card) => card.uid === 'preview-card')).toBe(!upgraded);
    }
  });

  it.each([
    ['berserker', 'berserker_body_slam'],
    ['assassin', 'assassin_poison_sting'],
    ['oracle', 'oracle_sky_force'],
    ['necromancer', 'necromancer_wisp'],
    ['machinist', 'machinist_hotfix'],
  ] as const)('%s rest preview does not spend the room, and confirmation applies that exact upgrade', (classId, cardId) => {
    const state = { ...createRun(`rest-preview-${classId}`, classId), screen: 'rest' as const };
    const card: CardInstance = { uid: `card-${state.nextCardId++}`, cardId, upgraded: false };
    state.deck.push(card);
    const selecting = reduceRun(state, { type: 'rest', choice: 'upgrade' });
    expect(selecting.screen).toBe('upgrade');
    const snapshot = structuredClone(selecting);
    const preview = getCardUpgradePreview(selecting.deck.at(-1)!)!;
    expect(selecting).toEqual(snapshot);
    expect(preview.after.card).toEqual({ ...card, upgraded: true });
    expect(reduceRun(selecting, { type: 'leaveNode' }).screen).toBe('rest');
    expect(state.deck.at(-1)!.upgraded).toBe(false);

    const confirmed = reduceRun(selecting, { type: 'upgradeCard', cardUid: card.uid });
    expect(confirmed.deck.at(-1)).toEqual(preview.after.card);
    expect(getCardPresentation(confirmed.deck.at(-1)!)).toEqual(preview.after);
    expect(confirmed.screen).toBe('map');
    expect(confirmed.hp).toBe(state.hp);
    expect(confirmed.gold).toBe(state.gold);
    expect(confirmed.rngState).toBe(state.rngState);
    expect(canUpgradeCard(confirmed.deck.at(-1)!)).toBe(false);
    expect(selecting).toEqual(snapshot);
  });
});

describe('upgrade text differences preserve source wording', () => {
  it('marks replaced numeric tokens without highlighting unchanged surrounding prose', () => {
    const segments = diffCardText('9ダメージ。1枚引く。', '10ダメージ。2枚引く。');
    expect(segments.filter((part) => part.changed).map((part) => part.text)).toEqual(['10', '2']);
    expect(segments.filter((part) => !part.changed).map((part) => part.text).join('')).toBe('ダメージ。枚引く。');
  });

  it('marks added effects and exposes removed effects by comparing in reverse', () => {
    const normal = 'このターンだけ集中力 +2。廃棄。';
    const upgraded = 'このターンだけ集中力 +2。';
    const after = diffCardText(normal, upgraded);
    const before = diffCardText(upgraded, normal);
    expect(after.every((part) => !part.changed)).toBe(true);
    expect(before.filter((part) => part.changed).map((part) => part.text).join('')).toBe('廃棄。');
    expect(diffCardText('エナジー +1。廃棄。', '保留。エナジー +1。廃棄。')
      .filter((part) => part.changed).map((part) => part.text).join('')).toBe('保留。');
  });

  it.each([
    ['', ''],
    ['', '✦を3得る。'],
    ['廃棄。', ''],
    ['HP −6。\nエナジー +2。', 'HP −6。\nエナジー +2。5枚引く。'],
    ['👁️ 星の力 ×1.5。', '👁️ 星の力 ×2.5。'],
    ['同じ説明。', '同じ説明。'],
  ])('preserves the entire target text for %j → %j', (before, after) => {
    const segments = diffCardText(before, after);
    expect(segments.map((part) => part.text).join('')).toBe(after);
    expect(segments.every((part) => part.text.length > 0)).toBe(true);
    if (before === after) expect(segments.every((part) => !part.changed)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { CARD_DEFINITIONS, LEGACY_CARD_IDS, STARTER_DECK } from '../data/cards';
import { CLASS_CARD_DEFINITIONS, PLAYABLE_SOURCE_CARD_IDS } from '../data/classCards';
import { CLASS_DEFINITIONS, CLASS_IDS, isClassId } from '../data/classes';
import { RELIC_DEFINITIONS } from '../data/relics';
import catalog from '../data/sourceCards.generated.json';
import { canPlayCard, createCombat, getCardCost, getEnemies, reduceCombat } from '../engine';
import { createRun, getAvailableNodes, reduceRun } from '../engine/run';
import { getPendingChoiceCards } from '../engine/actions/choices';
import type { ClassId, CombatState } from '../types/game';

describe('selectable classes and legacy compatibility', () => {
  it('has five stable IDs and five independent, replaceable display names', () => {
    expect(CLASS_IDS).toEqual(['berserker', 'assassin', 'oracle', 'necromancer', 'machinist']);
    expect(new Set(CLASS_IDS.map((id) => CLASS_DEFINITIONS[id].displayName)).size).toBe(5);
    for (const id of CLASS_IDS) {
      const definition = CLASS_DEFINITIONS[id];
      expect(definition.id).toBe(id);
      expect(definition.displayName.length).toBeGreaterThan(0);
      expect(definition.description.length).toBeGreaterThan(0);
      expect(definition.resourceSummary.length).toBeGreaterThan(0);
      expect(RELIC_DEFINITIONS[definition.starterRelicId]).toBeDefined();
      expect(isClassId(id)).toBe(true);
    }
    for (const invalid of [null, 'colorless', 'unknown', 0, {}, 'toString']) expect(isClassId(invalid)).toBe(false);
  });

  it.each(CLASS_IDS)('%s keeps the legacy factory deck, HP, starter and reproducible first combat', (classId) => {
    const definition = CLASS_DEFINITIONS[classId];
    const run = createRun(`class-start-${classId}`, classId);
    expect(run.classId).toBe(classId);
    expect(run.hp).toBe(definition.maxHp);
    expect(run.maxHp).toBe(definition.maxHp);
    expect(run.deck.map((card) => card.cardId)).toEqual(definition.starterDeck);
    expect(run.deck).toHaveLength(10);
    expect(new Set(run.deck.map((card) => card.uid)).size).toBe(10);
    expect(run.relicIds).toEqual([definition.legacyStarterRelicId]);
    expect(run.deck.every((card) => CARD_DEFINITIONS[card.cardId].classId === classId)).toBe(true);
    const first = reduceRun(run, { type: 'chooseNode', nodeId: getAvailableNodes(run)[0].id });
    expect(first.screen).toBe('combat');
    expect(first.combat!.classId).toBe(classId);
    expect(first.combat!.classResources).toEqual({
      stars: 0, starsGainedThisTurn: 0, forge: 0, ostyHp: 0,
      focus: 0, temporaryFocus: 0, orbs: [], nextTurnEnergy: 0,
    });
    expect(first.combat!.hand).toHaveLength(classId === 'assassin' ? 7 : 5);
    expect(createRun(`class-start-${classId}`, classId)).toEqual(run);
    expect(reduceRun(createRun(`class-start-${classId}`, classId), {
      type: 'chooseNode', nodeId: getAvailableNodes(run)[0].id,
    })).toEqual(first);
  });

  it('keeps classless legacy runs and practice decks unchanged', () => {
    const run = createRun('legacy-deck');
    const combat = createCombat('legacy-deck');
    expect(run).not.toHaveProperty('classId');
    expect(combat).not.toHaveProperty('classId');
    expect(combat).not.toHaveProperty('classResources');
    expect(run.deck.map((card) => card.cardId)).toEqual(STARTER_DECK);
    expect(combat.deck.map((card) => card.cardId)).toEqual(STARTER_DECK);
    expect(run.hp).toBe(80);
    expect(run.relicIds).toEqual(['warm_pebble']);
  });

  it('preserves the complete definitions of all 30 original cards and the starter deck', () => {
    // Captured from main before class work, including effects, upgrade values, text and IDs.
    const original = Object.fromEntries(LEGACY_CARD_IDS.map((id) => [id, CARD_DEFINITIONS[id]]));
    expect(createHash('sha256').update(JSON.stringify({ cards: original, starter: STARTER_DECK })).digest('hex'))
      .toBe('39db2d273ea75f9618af3af9cb43d41bd8ce31c88a85a69efd77484754b23093');
  });
});

describe('implemented card provenance and effect execution', () => {
  it('links every implemented reference to one exact source record and preserves both source costs', () => {
    const sourceIds: string[] = [];
    for (const card of Object.values(CLASS_CARD_DEFINITIONS)) {
      expect(CARD_DEFINITIONS[card.id]).toBe(card);
      expect(card.metadataProvisional).toBe(true);
      if (!card.sourceCardId) {
        expect(card.id).toBe('token_knife');
        expect(card.tokenOnly).toBe(true);
        continue;
      }
      const source = catalog.cards.find((entry) => entry.id === card.sourceCardId)!;
      expect(source).toBeDefined();
      expect(source.sourceClass).toBe(card.classId);
      expect(source.normal.costRaw).toBe(card.xCost ? 'X' : String(card.cost));
      expect(source.upgraded.costRaw).toBe(card.xCost ? 'X' : String(card.upgradedCost ?? card.cost));
      expect(card.effects.length).toBeGreaterThan(0);
      expect(card.upgradedEffects.length).toBeGreaterThan(0);
      sourceIds.push(card.sourceCardId);
    }
    expect(new Set(sourceIds).size).toBe(sourceIds.length);
    expect(new Set(PLAYABLE_SOURCE_CARD_IDS)).toEqual(new Set(sourceIds));
    expect(PLAYABLE_SOURCE_CARD_IDS.length).toBeLessThan(catalog.cards.length);
  });

  for (const card of Object.values(CLASS_CARD_DEFINITIONS)) {
    it.each([false, true])(`${card.id} has a real gameplay effect and conserves all card instances (upgraded=%s)`, (upgraded) => {
      const classId: ClassId = card.classId === 'colorless' ? 'berserker' : card.classId!;
      const state = createCombat(`all-cards-${card.id}`, 'grit_scout', { classId });
      const played = { uid: 'card-under-test', cardId: card.id, upgraded };
      const filler = Array.from({ length: 20 }, (_, index) => ({ uid: `filler-${index}`, cardId: 'still_guard', upgraded: false }));
      state.deck = [played, ...filler];
      state.hand = [played, ...filler.slice(0, 3)];
      state.drawPile = filler.slice(3, 14);
      state.discardPile = filler.slice(14, 18);
      state.exhaustPile = filler.slice(18);
      state.powers = [];
      state.energy = 5;
      state.player.block = 4;
      state.classResources = {
        stars: 5, starsGainedThisTurn: 3, forge: 8, ostyHp: 7,
        focus: 1, temporaryFocus: 0, orbs: ['frost', 'lightning'], nextTurnEnergy: 0,
      };
      state.enemy.hp = 500;
      state.enemy.maxHp = 500;
      // Conditional/scaling cards need their real prerequisites, not an empty
      // state in which the source explicitly says that their effect is zero.
      state.enemy.poison = 2;
      state.enemy.vulnerable = 2;
      state.enemy.doom = 9;
      const before = structuredClone(state);
      expect(canPlayCard(state, played.uid)).toBe(true);
      const expectedEnergyAfterPayment = state.energy - getCardCost(played, state);
      let after = reduceCombat(state, { type: 'playCard', cardId: played.uid });
      for (let count = 0; after.pendingChoice && count < 5; count++)
        after = reduceCombat(after, { type: 'chooseCards', cardIds: getPendingChoiceCards(after).slice(0, after.pendingChoice.amount).map((instance) => instance.uid) });
      expect(after.pendingChoice).toBeUndefined();
      expect(after.stats.cardsPlayed).toBe(1);
      expect(after.phase).toBe('player');
      expect(state).toEqual(before);
      const actualEffect = (combat: CombatState) => ({
        player: combat.player,
        enemies: getEnemies(combat),
        energy: combat.energy,
        resources: combat.classResources,
        powers: combat.powerStacks,
        hand: combat.hand.filter((instance) => instance.uid !== played.uid),
        exhaust: combat.exhaustPile.filter((instance) => instance.uid !== played.uid),
        generated: combat.generatedCards ?? [],
        scheduled: combat.scheduledEffects ?? [],
        temporary: combat.turnModifiers ?? [],
        intangible: combat.intangible ?? 0,
        cardDamageBonuses: combat.cardDamageBonuses ?? {},
        temporaryUpgrades: combat.temporaryUpgrades ?? [],
        dexterity: combat.dexterity ?? 0,
        plate: combat.plate ?? 0,
        vigor: combat.vigor ?? 0,
        orbSlotBonus: combat.orbSlotBonus ?? 0,
      });
      const onlyPayment = { ...before, energy: expectedEnergyAfterPayment };
      expect(actualEffect(after)).not.toEqual(actualEffect(onlyPayment));
      const zones = [...after.hand, ...after.drawPile, ...after.discardPile, ...after.exhaustPile, ...after.powers];
      expect(new Set(zones.map((instance) => instance.uid)).size).toBe(zones.length);
      expect(zones.map((instance) => instance.uid).sort()).toEqual(
        [...after.deck, ...(after.generatedCards ?? [])].map((instance) => instance.uid).sort(),
      );
      const destination = card.type === 'power' ? after.powers
        : (upgraded ? card.upgradedExhaust ?? card.exhaust : card.exhaust) ? after.exhaustPile : after.discardPile;
      expect(destination.map((instance) => instance.uid)).toContain(played.uid);
    });
  }
});

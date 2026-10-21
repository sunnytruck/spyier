import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import { CONTINUATION_MYSTIC_CARDS } from '../data/continuationMysticCards';
import catalog from '../data/sourceCards.generated.json';
import { canPlayCard, createCombat, getEnemies, getEnemyKey, reduceCombat } from '../engine';
import { deserializeGame, serializeGame } from '../engine/persistence';
import { getCardPool } from '../engine/cardPools';
import type { CardInstance, ClassId, CombatState } from '../types/game';

function fixture(cardId: string, upgraded = false, multiple = false): CombatState {
  const definition = CARD_DEFINITIONS[cardId];
  expect(definition).toBeDefined();
  const card: CardInstance = { uid: 'mystic-added-card', cardId, upgraded };
  const state = createCombat('mystic-continuation', multiple ? ['grit_scout', 'candle_moth'] : 'grit_scout', {
    classId: definition.classId as ClassId, relicIds: [], deck: [card],
  });
  state.energy = 10;
  for (const enemy of getEnemies(state)) { enemy.hp = enemy.maxHp = 500; enemy.block = 0; }
  return state;
}
const play = (state: CombatState) => reduceCombat(state, { type: 'playCard', cardId: 'mystic-added-card' });

function addCards(state: CombatState, zone: 'hand' | 'drawPile' | 'discardPile', amount: number, cardId = 'oracle_strike'): CardInstance[] {
  const cards = Array.from({ length: amount }, (_, index) => ({ uid: `${zone}-added-${index}`, cardId, upgraded: false }));
  state.deck.push(...cards.map((card) => ({ ...card })));
  state[zone].push(...cards);
  return cards;
}

describe('source-backed oracle and necromancer continuation cards', () => {
  it.each(CONTINUATION_MYSTIC_CARDS)('$id uses a unique source, both exact costs and the correct class pool', (card) => {
    expect(CARD_DEFINITIONS[card.id]).toEqual(card);
    expect(Object.values(CARD_DEFINITIONS).filter((entry) => entry.sourceCardId === card.sourceCardId)).toHaveLength(1);
    const source = catalog.cards.find((entry) => entry.id === card.sourceCardId)!;
    expect(source).toBeDefined();
    expect(card.cost).toBe(Number(source.normal.costRaw));
    expect(card.upgradedCost).toBe(Number(source.upgraded.costRaw));
    expect(card.metadataProvisional).toBe(true);
    expect(getCardPool(card.classId as ClassId, 'combat')).toContain(card.id);
    const other = card.classId === 'oracle' ? 'necromancer' : 'oracle';
    expect(getCardPool(other, 'combat')).not.toContain(card.id);
  });

  it.each([false, true])('gravitational pressure damages and weakens every enemy, then restores only its temporary delta (%s)', (upgraded) => {
    const state = fixture('oracle_gravitational_pressure', upgraded, true);
    getEnemies(state).forEach((enemy) => { enemy.strength = 3; });
    const result = play(state);
    expect(result.energy).toBe(9);
    expect(getEnemies(result).map((enemy) => enemy.hp)).toEqual([500 - (upgraded ? 8 : 7), 500 - (upgraded ? 8 : 7)]);
    expect(getEnemies(result).map((enemy) => enemy.strength)).toEqual([3 - (upgraded ? 2 : 1), 3 - (upgraded ? 2 : 1)]);
    const restored = deserializeGame(serializeGame(result))!;
    expect(restored).toEqual(result);
    const next = reduceCombat(restored, { type: 'endTurn' });
    expect(getEnemies(next).map((enemy) => enemy.strength)).toEqual([3, 3]);
    expect(result).not.toBe(state);
    expect(getEnemies(state).map((enemy) => enemy.strength)).toEqual([3, 3]);
  });

  it.each([false, true])('stars end permits negative enemy strength and exhausts if left ethereal in hand (%s)', (upgraded) => {
    const state = fixture('oracle_stars_end', upgraded, true);
    const result = play(state);
    expect(getEnemies(result).map((enemy) => enemy.hp)).toEqual([500 - (upgraded ? 11 : 9), 500 - (upgraded ? 11 : 9)]);
    expect(getEnemies(result).map((enemy) => enemy.strength)).toEqual([upgraded ? -11 : -9, upgraded ? -11 : -9]);
    const unused = reduceCombat(state, { type: 'endTurn' });
    expect(unused.exhaustPile.some((card) => card.uid === 'mystic-added-card')).toBe(true);
  });

  it.each([false, true])('exhausting hand affects only the selected enemy through the enemy turn (%s)', (upgraded) => {
    const state = fixture('necromancer_exhausting_hand', upgraded, true);
    state.selectedEnemyId = getEnemyKey(getEnemies(state)[1]);
    const result = play(state);
    expect(getEnemies(result).map((enemy) => enemy.strength)).toEqual([0, upgraded ? -11 : -8]);
    expect(getEnemies(result).map((enemy) => enemy.hp)).toEqual([500, 500]);
    const next = reduceCombat(deserializeGame(serializeGame(result))!, { type: 'endTurn' });
    expect(getEnemies(next).map((enemy) => enemy.strength)).toEqual([0, 0]);
  });

  it.each([false, true])('friendship pays permanent strength once and grants energy only at later turn starts (%s)', (upgraded) => {
    const state = fixture('necromancer_friendship', upgraded);
    const result = play(state);
    expect(result.player.strength).toBe(upgraded ? -1 : -2);
    expect(result.energy).toBe(9);
    expect(result.powerStacks?.energyOnTurn).toBe(1);
    expect(result.powers.some((card) => card.uid === 'mystic-added-card')).toBe(true);
    const second = reduceCombat(deserializeGame(serializeGame(result))!, { type: 'endTurn' });
    expect(second.energy).toBe(4);
    expect(second.player.strength).toBe(upgraded ? -1 : -2);
    expect(reduceCombat(second, { type: 'endTurn' }).energy).toBe(4);
    expect(reduceCombat(result, { type: 'playCard', cardId: 'mystic-added-card' })).toBe(result);
  });

  it.each([false, true])('buckler deploy keeps its block while empowering only the next attack (%s)', (upgraded) => {
    const state = fixture('oracle_buckler_deploy', upgraded);
    const [strike] = addCards(state, 'hand', 1);
    const guarded = play(state);
    expect(guarded.player.block).toBe(upgraded ? 11 : 9);
    expect(guarded.vigor).toBe(upgraded ? 3 : 2);
    expect(deserializeGame(serializeGame(guarded))).toEqual(guarded);
    const attacked = reduceCombat(guarded, { type: 'playCard', cardId: strike.uid });
    expect(attacked.enemy.hp).toBe(500 - 6 - (upgraded ? 3 : 2));
    expect(attacked.vigor).toBe(0);
    expect(attacked.player.block).toBe(upgraded ? 11 : 9);
  });

  it.each([false, true])('terraform stacks vigor and applies it to each hit of the next attack (%s)', (upgraded) => {
    const state = fixture('oracle_terraform', upgraded);
    state.vigor = 2;
    // A pre-existing two-hit attack verifies that the card empowers the whole next attack, not one hit.
    const twoHit = Object.values(CARD_DEFINITIONS).find((card) => card.effects.some((effect) => effect.type === 'damage' && effect.hits === 2 && effect.amount === 5));
    expect(twoHit).toBeDefined();
    const [attack] = addCards(state, 'hand', 1, twoHit!.id);
    const prepared = play(state);
    expect(prepared.vigor).toBe(upgraded ? 10 : 8);
    const attacked = reduceCombat(prepared, { type: 'playCard', cardId: attack.uid });
    expect(attacked.enemy.hp).toBe(500 - 2 * (5 + (upgraded ? 10 : 8)));
    expect(attacked.vigor).toBe(0);
  });

  it.each([false, true])('embodied authority generates exactly one normal-pool colorless card with the authored upgrade state (%s)', (upgraded) => {
    const state = fixture('oracle_embodied_authority', upgraded);
    const result = play(state);
    expect(result).toEqual(play(state));
    expect(result.player.block).toBe(upgraded ? 8 : 7);
    expect(result.hand).toHaveLength(1);
    const generated = result.hand[0];
    const definition = CARD_DEFINITIONS[generated.cardId];
    expect(definition.classId).toBe('colorless');
    expect(definition.acquisition ?? 'normal').toBe('normal');
    expect(definition.tokenOnly).not.toBe(true);
    expect(generated.upgraded).toBe(upgraded);
    expect(result.generatedCards).toContainEqual(generated);
    expect(deserializeGame(serializeGame(result))).toEqual(result);
  });

  it.each([false, true])('unexpected gift generates three or four unupgraded cards and exhausts itself (%s)', (upgraded) => {
    const state = fixture('oracle_unexpected_gift', upgraded);
    const result = play(state);
    expect(result.hand).toHaveLength(upgraded ? 4 : 3);
    expect(new Set(result.hand.map((card) => card.uid)).size).toBe(upgraded ? 4 : 3);
    expect(result.hand.every((card) => !card.upgraded && CARD_DEFINITIONS[card.cardId].classId === 'colorless' && (CARD_DEFINITIONS[card.cardId].acquisition ?? 'normal') === 'normal')).toBe(true);
    expect(result.exhaustPile.some((card) => card.uid === 'mystic-added-card')).toBe(true);
    expect(result.energy).toBe(9);
    expect(result).toEqual(play(state));
    expect(deserializeGame(serializeGame(result))).toEqual(result);
  });

  it.each([false, true])('strength absorption damages once and upgrades distinct eligible discard cards only (%s)', (upgraded) => {
    const state = fixture('necromancer_strength_absorption', upgraded);
    const discard = addCards(state, 'discardPile', 4, 'necromancer_strike');
    discard[3].upgraded = true;
    state.deck.find((card) => card.uid === discard[3].uid)!.upgraded = true;
    const [untouched] = addCards(state, 'hand', 1, 'necromancer_strike');
    const result = play(state);
    expect(result.enemy.hp).toBe(upgraded ? 488 : 490);
    expect(result.discardPile.filter((card) => discard.slice(0, 3).some((candidate) => candidate.uid === card.uid) && card.upgraded)).toHaveLength(upgraded ? 3 : 2);
    expect(result.temporaryUpgrades).toHaveLength(upgraded ? 3 : 2);
    expect(result.temporaryUpgrades).not.toContain(discard[3].uid);
    expect(result.hand.find((card) => card.uid === untouched.uid)!.upgraded).toBe(false);
    expect(result).toEqual(play(state));
    expect(deserializeGame(serializeGame(result))).toEqual(result);
  });

  it.each([false, true])('purification summons then resumes a saved draw-pile exhaust choice without double payment (%s)', (upgraded) => {
    const state = fixture('necromancer_purification', upgraded);
    const [first, second] = addCards(state, 'drawPile', 2, 'necromancer_strike');
    state.classResources!.ostyHp = 2;
    const pending = play(state);
    expect(pending.classResources!.ostyHp).toBe(upgraded ? 7 : 5);
    expect(pending.pendingChoice?.mode).toBe('exhaust');
    expect(pending.pendingChoice?.sourceZone).toBe('drawPile');
    expect(pending.pendingChoice?.amount).toBe(1);
    expect(pending.energy).toBe(9);
    const loaded = deserializeGame(serializeGame(pending))!;
    expect(loaded).toEqual(pending);
    expect(play(loaded)).toBe(loaded);
    const result = reduceCombat(loaded, { type: 'chooseCards', cardIds: [first.uid] });
    expect(result.pendingChoice).toBeUndefined();
    expect(result.drawPile.map((card) => card.uid)).toEqual([second.uid]);
    expect(result.exhaustPile.map((card) => card.uid)).toContain(first.uid);
    expect(result.energy).toBe(9);
    expect(result.classResources!.ostyHp).toBe(upgraded ? 7 : 5);
    expect(reduceCombat(result, { type: 'chooseCards', cardIds: [first.uid] })).toBe(result);
    expect(deserializeGame(serializeGame(result))).toEqual(result);
  });

  it.each([false, true])('no escape uses pre-application doom in whole groups of ten (%s)', (upgraded) => {
    for (const priorDoom of [0, 9, 10, 19, 20, 29]) {
      const state = fixture('necromancer_no_escape', upgraded, true);
      const target = getEnemies(state)[1];
      state.selectedEnemyId = getEnemyKey(target);
      target.doom = priorDoom;
      const result = play(state);
      expect(getEnemies(result)[0].doom ?? 0).toBe(0);
      expect(getEnemies(result)[1].doom).toBe(priorDoom + (upgraded ? 15 : 10) + Math.floor(priorDoom / 10) * 5);
      expect(deserializeGame(serializeGame(result))).toEqual(result);
    }
  });

  it.each([false, true])('spirit extraction loses raw HP through block and combat modifiers, then creates plain souls (%s)', (upgraded) => {
    const state = fixture('necromancer_spirit_extraction', upgraded, true);
    const target = getEnemies(state)[1];
    state.selectedEnemyId = getEnemyKey(target);
    state.player.strength = 100;
    state.player.weak = 2;
    target.vulnerable = 2;
    target.block = 100;
    const result = play(state);
    expect(getEnemies(result).map((enemy) => enemy.hp)).toEqual([500, upgraded ? 496 : 497]);
    expect(getEnemies(result)[1].block).toBe(100);
    expect(result.drawPile).toHaveLength(upgraded ? 4 : 3);
    expect(result.drawPile.every((card) => card.cardId === 'token_soul' && !card.upgraded)).toBe(true);
    expect(result.generatedCards).toHaveLength(upgraded ? 4 : 3);
    expect(deserializeGame(serializeGame(result))).toEqual(result);
  });

  it.each(CONTINUATION_MYSTIC_CARDS)('$id cannot play without its energy and round-trips before and after play', (card) => {
    for (const upgraded of [false, true]) {
      const state = fixture(card.id, upgraded);
      const before = serializeGame(state);
      expect(deserializeGame(before)).toEqual(state);
      state.energy = Math.max(0, (upgraded ? card.upgradedCost ?? card.cost : card.cost) - 1);
      if ((upgraded ? card.upgradedCost ?? card.cost : card.cost) > 0) {
        expect(canPlayCard(state, 'mystic-added-card')).toBe(false);
        expect(play(state)).toBe(state);
      }
      const valid = fixture(card.id, upgraded);
      const after = play(valid);
      expect(deserializeGame(serializeGame(after))).toEqual(after);
    }
  });
});

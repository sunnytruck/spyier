import { describe, expect, it } from 'vitest';
import catalog from '../data/sourceCards.generated.json';
import { CARD_DEFINITIONS } from '../data/cards';
import { CONTINUATION_MARTIAL_CARDS } from '../data/continuationMartialCards';
import { canPlayCard, createCombat, getCardCost, getEnemies, reduceCombat } from '../engine';
import { getCardPool } from '../engine/cardPools';
import { deserializeGame, isValidCombatState, serializeGame } from '../engine/persistence';
import { sampleCardRewards } from '../engine/rewards';
import type { CardInstance, CombatState } from '../types/game';

function fixture(id: string, upgraded: boolean): CombatState {
  const definition = CARD_DEFINITIONS[id];
  const state = createCombat('continuation-martial', ['grit_scout', 'candle_moth'], {
    classId: definition.classId === 'assassin' ? 'assassin' : 'berserker', relicIds: [], maxHp: 80,
  });
  const tested = { uid: 'tested', cardId: id, upgraded };
  const filler: CardInstance[] = Array.from({ length: 18 }, (_, index) => ({
    uid: `filler-${index}`, cardId: definition.classId === 'assassin' ? 'assassin_guard' : 'berserker_guard', upgraded: false,
  }));
  state.deck = [tested, ...filler];
  state.hand = [tested, ...filler.slice(0, 4)];
  state.drawPile = filler.slice(4, 14);
  state.discardPile = filler.slice(14);
  state.exhaustPile = [];
  state.powers = [];
  state.energy = 5;
  for (const enemy of getEnemies(state)) { enemy.hp = enemy.maxHp = 500; enemy.block = 0; }
  return state;
}

function roundTrip(state: CombatState): CombatState {
  expect(isValidCombatState(state)).toBe(true);
  const restored = deserializeGame(serializeGame(state));
  expect(restored).toEqual(state);
  return restored!;
}

const play = (state: CombatState) => reduceCombat(state, { type: 'playCard', cardId: 'tested' });
function finishChoice(state: CombatState, chosen?: string[]): CombatState {
  const restored = roundTrip(state);
  const choice = restored.pendingChoice!;
  const uids = chosen ?? restored[choice.sourceZone ?? 'hand'].slice(0, choice.amount).map((card) => card.uid);
  return reduceCombat(restored, { type: 'chooseCards', cardIds: uids });
}

describe('source-backed martial continuation registry and costs', () => {
  it('adds unique source identities, executable normal/upgraded effects and class-only offers', () => {
    expect(CONTINUATION_MARTIAL_CARDS.length).toBe(14);
    const all = Object.values(CARD_DEFINITIONS);
    for (const card of CONTINUATION_MARTIAL_CARDS) {
      expect(all.filter((held) => held.id === card.id)).toHaveLength(1);
      expect(all.filter((held) => held.sourceCardId === card.sourceCardId)).toHaveLength(1);
      expect(card.metadataProvisional).toBe(true);
      expect(card.effects.length).toBeGreaterThan(0);
      expect(card.upgradedEffects.length).toBeGreaterThan(0);
      expect(getCardPool(card.classId as 'berserker' | 'assassin', 'combat')).toContain(card.id);
      expect(getCardPool(card.classId === 'berserker' ? 'assassin' : 'berserker', 'combat')).not.toContain(card.id);
    }
    expect(getCardPool('assassin', 'combat').filter((id) => CARD_DEFINITIONS[id].rarity === 'rare').length).toBeGreaterThanOrEqual(3);
  });

  it.each(CONTINUATION_MARTIAL_CARDS.flatMap((card) => [false, true].map((upgraded) => ({ card, upgraded }))))
  ('$card.id upgrade=$upgraded consumes its exact source cost once and survives saved choices', ({ card, upgraded }) => {
    const source = catalog.cards.find((entry) => entry.sourceId === card.sourceCardId)!;
    expect(source).toBeDefined();
    expect(source.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    const state = fixture(card.id, upgraded);
    const cost = Number((upgraded ? source.upgraded : source.normal).costRaw);
    expect(getCardCost(state.hand[0], state)).toBe(cost);
    const before = serializeGame(state);
    const first = play(state);
    expect(first).not.toBe(state);
    expect(first.energy).toBe(5 - cost);
    expect(serializeGame(state)).toBe(before);
    roundTrip(first);
    let after = first;
    if (after.pendingChoice) {
      expect(reduceCombat(after, { type: 'endTurn' })).toBe(after);
      after = finishChoice(after);
    }
    expect(after.pendingChoice).toBeUndefined();
    expect(after.energy).toBe(5 - cost);
    expect(after.stats.cardsPlayed).toBe(1);
    expect(reduceCombat(after, { type: 'playCard', cardId: 'tested' })).toBe(after);
    roundTrip(after);
    if (cost > 0) {
      const poor = fixture(card.id, upgraded); poor.energy = cost - 1;
      expect(canPlayCard(poor, 'tested')).toBe(false);
      expect(play(poor)).toBe(poor);
    }
  });

  it('gives the assassin three different playable rare boss choices across seeded reward rolls', () => {
    const pool = getCardPool('assassin', 'combat');
    const offered = new Set<string>();
    for (let seed = 1; seed <= 32; seed += 1) {
      const result = sampleCardRewards(pool, seed, 'boss');
      expect(result.cardIds).toHaveLength(3);
      expect(new Set(result.cardIds).size).toBe(3);
      for (const id of result.cardIds) {
        const definition = CARD_DEFINITIONS[id];
        expect(definition.classId).toBe('assassin');
        expect(definition.rarity).toBe('rare');
        expect(definition.effects.length).toBeGreaterThan(0);
        offered.add(id);
      }
      expect(sampleCardRewards(pool, seed, 'boss')).toEqual(result);
    }
    expect(offered.has('assassin_infinite_blades')).toBe(true);
    expect(offered.has('assassin_assassinate')).toBe(true);
  });
});

describe.each([false, true])('martial source effects, upgraded=%s', (upgraded) => {
  it('headbutt uses the chosen discard and makes it the actual next draw', () => {
    const state = fixture('berserker_headbutt', upgraded);
    const chosen = state.discardPile[1].uid;
    let after = play(state);
    expect(after.enemy.hp).toBe(upgraded ? 488 : 491);
    expect(getEnemies(after)[1].hp).toBe(500);
    expect(after.pendingChoice).toMatchObject({ mode: 'topdeck', sourceZone: 'discardPile', amount: 1 });
    after = finishChoice(after, [chosen]);
    expect(after.drawPile.at(-1)?.uid).toBe(chosen);
    expect(after.discardPile.some((card) => card.uid === chosen)).toBe(false);
    const next = reduceCombat(roundTrip(after), { type: 'endTurn' });
    expect(next.hand[0].uid).toBe(chosen);
  });

  it('true grit changes random exhaust to a saved player choice on upgrade', () => {
    const state = fixture('berserker_true_grit', upgraded);
    let after = play(state);
    expect(after.player.block).toBe(upgraded ? 9 : 7);
    if (upgraded) {
      expect(after.pendingChoice).toMatchObject({ mode: 'exhaust', amount: 1 });
      const selected = after.hand[2].uid;
      after = finishChoice(after, [selected]);
      expect(after.exhaustPile.map((card) => card.uid)).toEqual([selected]);
    } else {
      expect(after.pendingChoice).toBeUndefined();
      expect(after.exhaustPile).toHaveLength(1);
      expect(play(state)).toEqual(after);
    }
    expect(after.hand).toHaveLength(3);
  });

  it('uppercut damages before applying both distinct debuffs', () => {
    const after = play(fixture('berserker_uppercut', upgraded));
    expect(after.enemy.hp).toBe(487);
    expect([after.enemy.weak, after.enemy.vulnerable]).toEqual(upgraded ? [2, 2] : [1, 1]);
    expect([getEnemies(after)[1].weak, getEnemies(after)[1].vulnerable]).toEqual([0, 0]);
  });

  it('disarming strike suppresses one enemy attack and then restores its original strength', () => {
    const state = fixture('berserker_disarm_strike', upgraded);
    state.enemy.strength = 2;
    const after = play(state);
    expect(after.enemy.hp).toBe(upgraded ? 480 : 485);
    expect(after.enemy.strength).toBe(upgraded ? -13 : -8);
    const next = reduceCombat(roundTrip(after), { type: 'endTurn' });
    expect(next.enemy.strength).toBe(2);
    // First enemy does zero damage; the candle's unmodified four damage remains.
    expect(next.player.hp).toBe(76);
  });

  it('brand pays HP before the choice and gains strength only after the chosen exhaust', () => {
    const state = fixture('berserker_brand', upgraded);
    const first = play(state);
    expect(first.player.hp).toBe(79);
    expect(first.player.strength).toBe(0);
    expect(first.pendingChoice).toMatchObject({ mode: 'exhaust', amount: 1 });
    const after = finishChoice(first, [first.hand[1].uid]);
    expect(after.player.hp).toBe(79);
    expect(after.player.strength).toBe(upgraded ? 2 : 1);
    expect(after.exhaustPile.map((card) => card.uid)).toEqual([first.hand[1].uid]);
    expect(reduceCombat(after, { type: 'chooseCards', cardIds: [first.hand[1].uid] })).toBe(after);
  });

  it('piercing wail reduces every enemy below zero for one enemy turn, then expires', () => {
    const first = play(fixture('assassin_piercing_wail', upgraded));
    expect(getEnemies(first).map((enemy) => enemy.strength)).toEqual(upgraded ? [-8, -8] : [-6, -6]);
    expect(first.exhaustPile.some((card) => card.uid === 'tested')).toBe(true);
    const next = reduceCombat(roundTrip(first), { type: 'endTurn' });
    expect(next.player.hp).toBe(80);
    expect(getEnemies(next).map((enemy) => enemy.strength)).toEqual([0, 0]);
  });

  it('predator schedules two additional draws exactly for the next turn', () => {
    const first = play(fixture('assassin_predator', upgraded));
    expect(first.enemy.hp).toBe(upgraded ? 480 : 485);
    expect(first.hand).toHaveLength(4);
    let next = reduceCombat(roundTrip(first), { type: 'endTurn' });
    expect(next.hand).toHaveLength(7);
    expect(next.scheduledEffects ?? []).toHaveLength(0);
    next = reduceCombat(roundTrip(next), { type: 'endTurn' });
    expect(next.hand).toHaveLength(5);
  });

  it('hidden arsenal waits for two discards before generating the two correctly upgraded knives', () => {
    const first = play(fixture('assassin_hidden_arsenal', upgraded));
    expect(first.pendingChoice).toMatchObject({ mode: 'discard', amount: 2 });
    expect(first.hand.filter((card) => card.cardId === 'token_knife')).toHaveLength(0);
    const selected = first.hand.slice(1, 3).map((card) => card.uid);
    const after = finishChoice(first, selected);
    const knives = after.hand.filter((card) => card.cardId === 'token_knife');
    expect(knives).toHaveLength(2);
    expect(knives.every((card) => card.upgraded === upgraded)).toBe(true);
    expect(selected.every((uid) => after.discardPile.some((card) => card.uid === uid))).toBe(true);
    expect(after.generatedCards?.filter((card) => card.cardId === 'token_knife')).toHaveLength(2);
    roundTrip(after);
  });

  it('leg sweep applies weak to only the selected enemy and grants the stated block', () => {
    const after = play(fixture('assassin_leg_sweep', upgraded));
    expect(after.enemy.weak).toBe(upgraded ? 3 : 2);
    expect(getEnemies(after)[1].weak).toBe(0);
    expect(after.player.block).toBe(upgraded ? 14 : 11);
  });

  it('infinite blades generates one knife on subsequent turns, not immediately', () => {
    let state = play(fixture('assassin_infinite_blades', upgraded));
    expect(state.hand.filter((card) => card.cardId === 'token_knife')).toHaveLength(0);
    expect(state.powers.some((card) => card.uid === 'tested')).toBe(true);
    state = reduceCombat(roundTrip(state), { type: 'endTurn' });
    expect(state.hand.filter((card) => card.cardId === 'token_knife')).toHaveLength(1);
    state = reduceCombat(roundTrip(state), { type: 'endTurn' });
    expect(state.hand.filter((card) => card.cardId === 'token_knife')).toHaveLength(1);
  });

  it('assassinate deals damage before vulnerable and exhausts itself', () => {
    const after = play(fixture('assassin_assassinate', upgraded));
    expect(after.enemy.hp).toBe(upgraded ? 487 : 490);
    expect(after.enemy.vulnerable).toBe(upgraded ? 2 : 1);
    expect(after.exhaustPile.some((card) => card.uid === 'tested')).toBe(true);
  });

  it('stone armor gains plate, whose end-turn block and hit-based decay match the existing plate engine', () => {
    const first = play(fixture('berserker_stone_armor', upgraded));
    expect(first.player.block).toBe(0);
    expect(first.plate).toBe(upgraded ? 6 : 4);
    const next = reduceCombat(roundTrip(first), { type: 'endTurn' });
    expect(next.player.hp).toBe(upgraded ? 77 : 75);
    expect(next.plate).toBe(upgraded ? 5 : 2);
    roundTrip(next);
  });

  it('anticipation increases subsequent card block for this turn without leaking into the next turn', () => {
    let first = play(fixture('assassin_anticipation', upgraded));
    const bonus = upgraded ? 3 : 2;
    expect(first.dexterity).toBe(bonus);
    const guard = first.hand[0];
    first = reduceCombat(first, { type: 'playCard', cardId: guard.uid });
    expect(first.player.block).toBe(5 + bonus);
    const next = reduceCombat(roundTrip(first), { type: 'endTurn' });
    expect(next.dexterity).toBe(0);
    expect(next.turnModifiers).toBeUndefined();
    roundTrip(next);
  });

  it('footwork increases card block for the entire battle and persists through turn changes', () => {
    const first = play(fixture('assassin_footwork', upgraded));
    const bonus = upgraded ? 3 : 2;
    expect(first.dexterity).toBe(bonus);
    expect(first.powers.some((card) => card.uid === 'tested')).toBe(true);
    let next = reduceCombat(roundTrip(first), { type: 'endTurn' });
    expect(next.dexterity).toBe(bonus);
    const guard = next.hand[0];
    next = reduceCombat(next, { type: 'playCard', cardId: guard.uid });
    expect(next.player.block).toBe(5 + bonus);
    roundTrip(next);
  });
});

describe('martial card edge cases', () => {
  it('an empty discard skips headbutt selection without pretending to draw a card', () => {
    const state = fixture('berserker_headbutt', false);
    state.drawPile.push(...state.discardPile); state.discardPile = [];
    const after = play(state);
    expect(after.pendingChoice).toBeUndefined();
    expect(after.hand).toHaveLength(4);
    roundTrip(after);
  });

  it('an empty hand skips exhaust safely, while lethal brand stops before strength', () => {
    const state = fixture('berserker_true_grit', true);
    state.drawPile.push(...state.hand.splice(1));
    const after = play(state);
    expect(after.player.block).toBe(9);
    expect(after.pendingChoice).toBeUndefined();
    const brand = fixture('berserker_brand', true); brand.player.hp = 1;
    const dead = play(brand);
    expect(dead.phase).toBe('defeat');
    expect(dead.pendingChoice).toBeUndefined();
    expect(dead.player.strength).toBe(0);
    expect(dead.exhaustPile).toHaveLength(0);
    roundTrip(dead);
  });

  it('the upgraded infinite-blades power is actually innate when shuffling a full opening deck', () => {
    const state = createCombat('innate-stone-knives', 'grit_scout', { classId: 'assassin', relicIds: [],
      deck: [
        ...Array.from({ length: 15 }, (_, index) => ({ uid: `basic-${index}`, cardId: 'assassin_guard', upgraded: false })),
        { uid: 'innate-power', cardId: 'assassin_infinite_blades', upgraded: true },
      ],
    });
    expect(state.hand.some((card) => card.uid === 'innate-power')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import catalog from '../data/sourceCards.generated.json';
import { CARD_DEFINITIONS } from '../data/cards';
import { ART_EXPANSION_PHASE4_CARDS } from '../data/artExpansionPhase4Cards';
import { canPlayCard, createCombat, getCardCost, getEnemies, reduceCombat } from '../engine';
import { drawInto } from '../engine/actions/draw';
import { getCardPool } from '../engine/cardPools';
import { deserializeGame, isValidCombatState, serializeGame } from '../engine/persistence';
import { captureCombatTransition } from '../presentation/trace';
import { getCardRuntimeInfo } from '../presentation/cardRuntime';
import type { CardInstance, ClassId, CombatState } from '../types/game';

const definitions = ART_EXPANSION_PHASE4_CARDS;
const variants = [false, true] as const;
function fixture(id: string, upgraded: boolean, fillerCount = 24): CombatState {
  const definition = CARD_DEFINITIONS[id];
  expect(definition, `Missing real registry entry ${id}`).toBeDefined();
  const classId = definition.classId as ClassId;
  const deck: CardInstance[] = [{ uid: 'tested', cardId: id, upgraded }, ...Array.from({ length: fillerCount }, (_, index) => ({ uid: `filler-${index}`, cardId: `${classId}_guard`, upgraded: false }))];
  const state = createCombat('art-phase4-cards', ['grit_scout', 'candle_moth', 'lost_bell'], { classId, deck, relicIds: [] });
  state.hand = state.deck.slice(0, 5); state.drawPile = state.deck.slice(5);
  state.discardPile = []; state.exhaustPile = []; state.powers = [];
  state.energy = 8;
  for (const enemy of getEnemies(state)) { enemy.hp = enemy.maxHp = 500; enemy.block = 0; }
  return state;
}
function load(state: CombatState): CombatState {
  expect(isValidCombatState(state)).toBe(true);
  const restored = deserializeGame(serializeGame(state));
  expect(restored).toEqual(state);
  return restored!;
}
const play = (state: CombatState, uid = 'tested') => reduceCombat(state, { type: 'playCard', cardId: uid });
function change(state: CombatState, uid: string, cardId: string, upgraded = false): void {
  expect(CARD_DEFINITIONS[cardId]).toBeDefined();
  for (const card of [...state.deck, ...state.hand, ...state.drawPile, ...state.discardPile, ...state.exhaustPile])
    if (card.uid === uid) { card.cardId = cardId; card.upgraded = upgraded; }
}
function move(state: CombatState, uid: string, to: 'hand' | 'drawPile' | 'discardPile'): void {
  for (const from of ['hand', 'drawPile', 'discardPile'] as const) {
    const index = state[from].findIndex((card) => card.uid === uid);
    if (index >= 0) { state[to].push(...state[from].splice(index, 1)); return; }
  }
  throw new Error(`Missing physical card ${uid}`);
}
function inventoryUids(state: CombatState): string[] {
  return [...state.hand, ...state.drawPile, ...state.discardPile, ...state.exhaustPile, ...state.powers].map((card) => card.uid).sort();
}

describe('the second fifteen source-backed cards are real, distinct additions', () => {
  it('registers three new cards per job with separate immutable source identities', () => {
    expect(definitions).toHaveLength(15);
    expect(new Set(definitions.map((card) => card.id)).size).toBe(15);
    for (const classId of ['berserker', 'assassin', 'oracle', 'necromancer', 'machinist'])
      expect(definitions.filter((card) => card.classId === classId)).toHaveLength(3);
    for (const definition of definitions) {
      expect(CARD_DEFINITIONS[definition.id]).toBe(definition);
      expect(Object.values(CARD_DEFINITIONS).filter((card) => card.sourceCardId === definition.sourceCardId)).toHaveLength(1);
      expect(definition.metadataProvisional).toBe(true);
      expect(definition.effects.length).toBeGreaterThan(0); expect(definition.upgradedEffects.length).toBeGreaterThan(0);
    }
  });
  it.each(definitions)('$id preserves printed normal/upgraded costs and source ownership', (definition) => {
    const source = catalog.cards.find((card) => card.sourceId === definition.sourceCardId)!;
    expect(source).toBeDefined(); expect(source.sourceClass).toBe(definition.classId);
    expect(definition.cost).toBe(Number(source.normal.costRaw));
    expect(definition.upgradedCost).toBe(Number(source.upgraded.costRaw));
    for (const classId of ['berserker', 'assassin', 'oracle', 'necromancer', 'machinist'] as const)
      expect(getCardPool(classId, 'combat').includes(definition.id)).toBe(classId === definition.classId);
    expect(getCardPool(definition.classId as ClassId, 'shop')).toContain(definition.id);
    expect(getCardPool(definition.classId as ClassId, 'event')).toContain(definition.id);
  });
});

for (const upgraded of variants) describe(`Phase4 independent effect contracts / upgraded=${upgraded}`, () => {
  it('perfect strike counts each physical strike once, including the played card and excluding nonstrikes', () => {
    const state = fixture('berserker_perfect_strike', upgraded);
    change(state, 'filler-0', 'berserker_strike'); change(state, 'filler-5', 'berserker_twin');
    // perfect strike + basic strike + twin strike are three source-name strike cards.
    const result = play(load(state));
    expect(500 - result.enemy.hp).toBe(upgraded ? 15 : 12);
    expect(inventoryUids(result)).toEqual(inventoryUids(state));
    expect(result.energy).toBe(6); load(result);
  });
  it('rampage accumulates only on the same instance, survives reload and leaves another copy unchanged', () => {
    let state = fixture('berserker_rampage', upgraded);
    change(state, 'filler-0', 'berserker_rampage', upgraded);
    state = play(load(state));
    expect(500 - state.enemy.hp).toBe(9);
    expect(state.instanceDamageBonuses?.tested).toBe(upgraded ? 9 : 5);
    expect(state.instanceDamageBonuses?.['filler-0']).toBeUndefined();
    const sameCopy = state.discardPile.find((card) => card.uid === 'tested')!;
    const previewBefore = serializeGame(state);
    expect(getCardRuntimeInfo(sameCopy, state)?.facts.find((fact) => fact.key === '0:damage')?.amount).toBe(upgraded ? 18 : 14);
    expect(getCardRuntimeInfo(state.hand.find((card) => card.uid === 'filler-0')!, state)?.facts.find((fact) => fact.key === '0:damage')?.amount).toBe(9);
    expect(serializeGame(state)).toBe(previewBefore);
    state = play(load(state), 'filler-0');
    expect(500 - state.enemy.hp).toBe(18);
    move(state, 'tested', 'hand');
    state = play(load(state));
    expect(500 - state.enemy.hp).toBe(upgraded ? 36 : 32);
    expect(state.instanceDamageBonuses?.tested).toBe(upgraded ? 18 : 10); load(state);
  });
  it('battle trance draws first, then blocks further draws and clears that restriction next turn', () => {
    const state = fixture('berserker_battle_trance', upgraded);
    const result = play(load(state));
    expect(result.hand).toHaveLength(upgraded ? 8 : 7);
    expect(result.drawBlocked).toBe(true);
    const beforeDraw = structuredClone(result); drawInto(result, 6);
    expect(result.hand).toEqual(beforeDraw.hand); expect(result.drawPile).toEqual(beforeDraw.drawPile);
    expect(result.rngState).toBe(beforeDraw.rngState);
    const next = reduceCombat(load(result), { type: 'endTurn' });
    expect(next.drawBlocked).not.toBe(true); expect(next.hand).toHaveLength(5);
    expect(next.turnMetrics?.drawn).toBe(5); load(next);
  });
  it('memento scales from actual explicit discards, not the played card entering the discard pile', () => {
    let state = fixture('assassin_memento_mori', upgraded);
    change(state, 'filler-0', 'assassin_hidden_arsenal');
    state = play(load(state), 'filler-0');
    expect(state.pendingChoice?.mode).toBe('discard');
    state = reduceCombat(load(state), { type: 'chooseCards', cardIds: ['filler-1', 'filler-2'] });
    expect(state.turnMetrics?.discarded).toBe(2);
    state = play(load(state));
    expect(500 - state.enemy.hp).toBe(upgraded ? 21 : 17);
    expect(state.turnMetrics?.discarded).toBe(2); load(state);
  });
  it('bouncing flask rolls each poison application, reproduces its seed and uses per-application relic bonuses', () => {
    const state = fixture('assassin_bouncing_flask', upgraded);
    const result = play(load(state));
    expect(getEnemies(result).reduce((sum, enemy) => sum + enemy.poison, 0)).toBe(upgraded ? 12 : 9);
    expect(result).toEqual(play(state));
    expect(result.rngState).not.toBe(state.rngState);
    expect(getEnemies(result).map((enemy) => enemy.hp)).toEqual([500, 500, 500]); load(result);
    const withRelic = structuredClone(state); withRelic.relicIds = ['ref_snecko_skull'];
    const boosted = play(load(withRelic));
    expect(getEnemies(boosted).reduce((sum, enemy) => sum + enemy.poison, 0)).toBe(upgraded ? 16 : 12); load(boosted);
  });
  it('grand finale has a real play prohibition while a single draw card remains, then hits every enemy once', () => {
    const state = fixture('assassin_grand_finale', upgraded);
    expect(canPlayCard(state, 'tested')).toBe(false); expect(play(state)).toBe(state);
    state.discardPile.push(...state.drawPile); state.drawPile = [];
    const captured = captureCombatTransition(state, () => play(load(state)));
    expect(getEnemies(captured.result).map((enemy) => enemy.hp)).toEqual(Array(3).fill(upgraded ? 425 : 440));
    expect(captured.result.energy).toBe(8); load(captured.result);
  });
  it('shining strike returns the same played instance to the true draw-pile top instead of making a copy', () => {
    const state = fixture('oracle_shining_strike', upgraded);
    state.classResources!.stars = 5; state.classResources!.starsGainedThisTurn = 1;
    const result = play(load(state));
    expect(500 - result.enemy.hp).toBe(upgraded ? 11 : 8);
    expect(result.classResources).toMatchObject({ stars: 7, starsGainedThisTurn: 3 });
    expect(result.drawPile.at(-1)?.uid).toBe('tested');
    expect(result.discardPile.some((card) => card.uid === 'tested')).toBe(false);
    expect(inventoryUids(result)).toEqual(inventoryUids(state));
    const restored = load(result); drawInto(restored, 1);
    expect(restored.hand.at(-1)?.uid).toBe('tested'); load(restored);
  });
  it('spectrum shift generates a normal colorless card on later turns, without adding it to the permanent deck', () => {
    const state = fixture('oracle_spectrum_shift', upgraded);
    const result = play(load(state));
    expect(result.energy).toBe(upgraded ? 7 : 6);
    expect(result.generatedCards ?? []).toHaveLength(0);
    const next = reduceCombat(load(result), { type: 'endTurn' });
    expect(next.generatedCards).toHaveLength(1);
    const generated = next.generatedCards![0];
    expect(next.hand.some((card) => card.uid === generated.uid)).toBe(true);
    expect(getCardPool('oracle', 'event', { includeOwnClass: false })).toContain(generated.cardId);
    expect(CARD_DEFINITIONS[generated.cardId].tokenOnly).not.toBe(true);
    expect(CARD_DEFINITIONS[generated.cardId].acquisition).not.toBe('blessingOnly');
    expect(next.deck).toEqual(state.deck); expect(next.turnMetrics?.drawn).toBe(5); load(next);
  });
  it('monologue buffs subsequent cards only and removes all temporary strength before enemy attacks', () => {
    let state = fixture('oracle_monologue', upgraded);
    change(state, 'filler-1', 'oracle_strike');
    state = play(load(state)); expect(state.player.strength).toBe(0);
    state = play(load(state), 'filler-0'); expect(state.player.strength).toBe(1);
    state = play(load(state), 'filler-1'); expect(state.player.strength).toBe(2);
    expect(500 - state.enemy.hp).toBe(8);
    const restored = load(state);
    const captured = captureCombatTransition(restored, () => reduceCombat(restored, { type: 'endTurn' }));
    const enemyAttack = captured.cues.find((cue) => cue.kind === 'attack' && cue.targetId === 'player');
    expect(enemyAttack?.frame.player.strength).toBe(0);
    expect(captured.result.player.strength).toBe(0);
    expect(captured.result.powerStacks?.strengthOnCardTemporary ?? 0).toBe(0); load(captured.result);
  });
  it('death march counts the opening five draws and additional real draws, without treating generation as draw', () => {
    const state = fixture('necromancer_death_march', upgraded);
    expect(state.turnMetrics?.drawn).toBe(5);
    drawInto(state, 2); expect(state.turnMetrics?.drawn).toBe(7);
    const result = play(load(state));
    expect(500 - result.enemy.hp).toBe(upgraded ? 37 : 29); load(result);
  });
  it('underworld pull scales a single hit from played ethereal history, then applies normal attack modifiers', () => {
    const state = fixture('necromancer_underworld_pull', upgraded);
    state.battleMetrics = { etherealPlayed: 3 };
    state.player.strength = 2; state.player.weak = 1; state.enemy.vulnerable = 1;
    const captured = captureCombatTransition(state, () => play(state));
    expect(500 - captured.result.enemy.hp).toBe(upgraded ? 25 : 19);
    expect(captured.cues.filter((cue) => cue.kind === 'impact' && cue.targetId === 'grit_scout-0')).toHaveLength(1);
    expect(captured.result.battleMetrics?.etherealPlayed).toBe(3); load(captured.result);
  });
  it('door to death repeats block gains independently after a real doom application', () => {
    let state = fixture('necromancer_door_to_death', upgraded);
    change(state, 'filler-0', 'necromancer_no_escape');
    state = play(load(state), 'filler-0'); expect(state.turnMetrics!.doomApplied).toBeGreaterThan(0);
    state.dexterity = 2;
    const captured = captureCombatTransition(state, () => play(state));
    expect(captured.result.player.block).toBe(upgraded ? 27 : 24);
    expect(captured.cues.filter((cue) => cue.kind === 'block' && cue.targetId === 'player')).toHaveLength(3); load(captured.result);
  });
  it('spiral drill counts actually paid energy, including the preceding cards, and not Chemical X effect bonuses', () => {
    let state = fixture('machinist_spiral_drill', upgraded);
    change(state, 'filler-0', 'berserker_whirlwind');
    state.relicIds = ['ref_chemical_x']; state.energy = 3;
    state = play(load(state), 'filler-0'); expect(state.energy).toBe(0);
    expect(state.turnMetrics?.energySpent).toBe(3);
    const hp = state.enemy.hp;
    const result = play(load(state));
    expect(hp - result.enemy.hp).toBe(upgraded ? 15 : 9);
    expect(result.turnMetrics?.energySpent).toBe(3); load(result);
  });
  it('sever refunds energy only when that attack kills its target, including after enemy block', () => {
    const damage = upgraded ? 32 : 24;
    const state = fixture('machinist_sever', upgraded); state.enemy.hp = damage;
    const killed = play(load(state));
    expect(killed.enemy.hp).toBe(0); expect(killed.energy).toBe(8); load(killed);
    const blocked = fixture('machinist_sever', upgraded); blocked.enemy.hp = damage; blocked.enemy.block = 2;
    const survived = play(load(blocked));
    expect(survived.enemy.hp).toBe(2); expect(survived.energy).toBe(5); load(survived);
  });
  it('all for one retrieves zero-cost cards only, excludes X, and conserves every card', () => {
    const state = fixture('machinist_all_for_one', upgraded);
    change(state, 'filler-5', 'assassin_deflect'); change(state, 'filler-6', 'berserker_whirlwind');
    move(state, 'filler-5', 'discardPile'); move(state, 'filler-6', 'discardPile'); move(state, 'filler-7', 'discardPile');
    const beforeUids = inventoryUids(state);
    const result = play(load(state));
    expect(500 - result.enemy.hp).toBe(upgraded ? 14 : 10);
    expect(result.hand.some((card) => card.uid === 'filler-5')).toBe(true);
    expect(result.hand.some((card) => ['filler-6', 'filler-7'].includes(card.uid))).toBe(false);
    expect(inventoryUids(result)).toEqual(beforeUids); load(result);
  });
});

it('zero-reference aggregate attacks retain the existing base-zero strength rule', () => {
  for (const id of ['necromancer_underworld_pull', 'machinist_spiral_drill']) {
    const state = fixture(id, false); state.player.strength = 3;
    state.battleMetrics = { etherealPlayed: 0 }; state.turnMetrics = { skillsPlayed: 0, drawn: 0, discarded: 0, doomApplied: 0, energySpent: 0 };
    const result = play(load(state)); expect(500 - result.enemy.hp).toBe(3); load(result);
  }
});

it('all for one respects the hand limit and leaves overflow candidates in discard', () => {
  const state = fixture('machinist_all_for_one', true, 58);
  state.hand = state.deck.slice(0, 50); state.drawPile = state.deck.slice(50);
  change(state, 'filler-50', 'assassin_deflect'); change(state, 'filler-51', 'assassin_preparation');
  move(state, 'filler-50', 'discardPile'); move(state, 'filler-51', 'discardPile');
  const beforeUids = inventoryUids(state);
  const previewBefore = serializeGame(state);
  expect(getCardRuntimeInfo(state.hand[0], state)?.facts.find((fact) => fact.key === '1:moveMatching')?.amount).toBe(1);
  expect(serializeGame(state)).toBe(previewBefore);
  const result = play(load(state));
  expect(result.hand).toHaveLength(50);
  expect(result.discardPile.filter((card) => ['filler-50', 'filler-51'].includes(card.uid))).toHaveLength(1);
  expect(inventoryUids(result)).toEqual(beforeUids); load(result);
});

it('monologue upgrade retains itself when held, while the normal card is discarded', () => {
  for (const upgraded of variants) {
    const state = fixture('oracle_monologue', upgraded);
    const after = reduceCombat(load(state), { type: 'endTurn' });
    // Empty the next normal draw above the source so retention is distinguished from a redraw.
    expect(after.hand.some((card) => card.uid === 'tested')).toBe(upgraded);
    load(after);
  }
});

it('runtime descriptions use the same live metrics and never mutate state, RNG, or counters', () => {
  for (const id of ['berserker_perfect_strike', 'assassin_memento_mori', 'necromancer_death_march', 'necromancer_underworld_pull', 'machinist_spiral_drill']) {
    const state = fixture(id, true);
    state.battleMetrics = { etherealPlayed: 3 }; state.turnMetrics = { skillsPlayed: 0, drawn: 7, discarded: 2, doomApplied: 10, energySpent: 3 };
    const before = serializeGame(state);
    const facts = getCardRuntimeInfo(state.hand[0], state);
    expect(facts?.facts.length, id).toBeGreaterThan(0);
    expect(serializeGame(state)).toBe(before);
    const actual = play(state);
    expect(facts!.facts.some((fact) => fact.amount === 500 - actual.enemy.hp), id).toBe(true);
  }
});

it('a normal positive-cost card with insufficient energy never charges, increments metrics, or moves cards', () => {
  for (const definition of definitions.filter((card) => card.cost > 0)) {
    const state = fixture(definition.id, false); state.energy = definition.cost - 1;
    expect(getCardCost(state.hand[0], state)).toBe(definition.cost);
    expect(canPlayCard(state, 'tested')).toBe(false); expect(play(state)).toBe(state);
  }
});

it.each(variants)('counts played ethereal at its current upgrade state, but not unused automatic exhaust (upgraded=%s)', (upgraded) => {
  let state = fixture('necromancer_underworld_pull', upgraded);
  change(state, 'filler-0', 'blessing_apparition', false);
  change(state, 'filler-1', 'blessing_apparition', true);
  change(state, 'filler-2', 'necromancer_exhausting_hand', true);
  state = play(load(state), 'filler-0');
  state = play(load(state), 'filler-1');
  expect(state.battleMetrics?.etherealPlayed).toBe(1);
  const attacked = play(load(state));
  expect(500 - attacked.enemy.hp).toBe(upgraded ? 7 : 5);
  expect(attacked.battleMetrics?.etherealPlayed).toBe(1);
  const next = reduceCombat(load(attacked), { type: 'endTurn' });
  expect(next.exhaustPile.some((card) => card.uid === 'filler-2')).toBe(true);
  expect(next.battleMetrics?.etherealPlayed).toBe(1);
  load(next);
});

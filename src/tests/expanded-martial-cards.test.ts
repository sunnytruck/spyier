import { describe, expect, it } from 'vitest';
import catalog from '../data/sourceCards.generated.json';
import { CARD_DEFINITIONS } from '../data/cards';
import { EXPANDED_MARTIAL_CARDS } from '../data/expandedMartialCards';
import { createCombat, getCardCost, getEnemies, reduceCombat } from '../engine';
import { deserializeGame, isValidCombatState, serializeGame } from '../engine/persistence';
import { captureCombatTransition } from '../presentation/trace';
import type { CardDefinition, CardInstance, CombatState } from '../types/game';

interface Expected {
  damage?: [number, number];
  allDamage?: [number, number];
  totalDamage?: [number, number];
  hits?: [number, number];
  block?: [number, number];
  hp?: [number, number];
  weak?: [number, number];
  vulnerable?: [number, number];
  allWeak?: [number, number];
  allVulnerable?: [number, number];
  poison?: [number, number];
  energyGain?: [number, number];
  nextEnergy?: [number, number];
  nextBlock?: [number, number];
  strength?: [number, number];
  thorns?: [number, number];
  blockOnAttack?: [number, number];
  energyOnTurn?: [number, number];
  finalHand?: [number, number];
  randomExhaust?: boolean;
}

/** Independent expectations from the TXT, with fixtures stated below. */
const expected: Record<string, Expected> = {
  berserker_bash: { damage: [8, 10], vulnerable: [2, 3] },
  berserker_thunderclap: { allDamage: [4, 7], allVulnerable: [1, 1] },
  berserker_blood_path: { hp: [1, 1], allDamage: [9, 13] },
  berserker_shiver: { vulnerable: [3, 4] },
  berserker_blood_wall: { hp: [2, 2], block: [16, 20] },
  berserker_taunt: { block: [7, 8], vulnerable: [1, 2] },
  berserker_skull_crush: { damage: [32, 42] },
  berserker_shatter: { damage: [20, 30], vulnerable: [5, 7] },
  berserker_boomerang: { totalDamage: [9, 12], hits: [3, 4] },
  berserker_whirlwind: { allDamage: [15, 24], hits: [6, 6] },
  berserker_ash_strike: { damage: [12, 14] },
  berserker_bully: { damage: [12, 15] },
  berserker_dismantle: { damage: [24, 30], hits: [2, 2] },
  berserker_char: { damage: [18, 24], randomExhaust: true },
  berserker_setup_strike: { damage: [7, 9], strength: [2, 3] },
  berserker_flame_barrier: { block: [12, 16], thorns: [4, 6] },
  berserker_rage: { blockOnAttack: [3, 5] },
  berserker_bonfire: { energyOnTurn: [1, 2] },
  assassin_neutralize: { damage: [3, 4], weak: [1, 2] },
  assassin_dagger_spray: { allDamage: [8, 12], hits: [4, 4] },
  assassin_sneak_attack: { damage: [8, 10], weak: [1, 2] },
  assassin_deflect: { block: [4, 7] },
  assassin_serpent_bite: { poison: [11, 14] },
  assassin_backstab: { damage: [11, 15] },
  assassin_dash: { block: [10, 13], damage: [10, 13] },
  assassin_oppress: { damage: [11, 17], weak: [3, 5] },
  assassin_skewer: { damage: [24, 33], hits: [3, 3] },
  assassin_focused_blade: { damage: [7, 10] },
  assassin_bubble: { poison: [13, 16] },
  assassin_expertise: { finalHand: [6, 7] },
  assassin_mirage: { block: [11, 11] },
  assassin_dodge_roll: { block: [4, 6], nextBlock: [4, 6] },
  assassin_gamble: { finalHand: [3, 3] },
  colorless_production: { energyGain: [2, 2] },
  colorless_bird_charge: { damage: [14, 18] },
  colorless_peck: { damage: [6, 8], hits: [3, 4] },
  colorless_exterminate: { allDamage: [12, 16], hits: [8, 8] },
  colorless_trample: { damage: [10, 12], vulnerable: [2, 3] },
  colorless_foresight: { nextEnergy: [2, 3] },
  colorless_caltrops: { thorns: [3, 5] },
  colorless_glow: { energyGain: [2, 3] },
  colorless_shockwave: { allWeak: [3, 5], allVulnerable: [3, 5] },
  colorless_mind_blast: { damage: [7, 7] },
  colorless_stack: { block: [4, 7] },
  colorless_entrench: { block: [14, 14] },
};

function fixture(definition: CardDefinition, upgraded: boolean): CombatState {
  const state = createCombat(`martial-${definition.id}`, ['grit_scout', 'candle_moth'], {
    classId: definition.classId === 'assassin' ? 'assassin' : 'berserker',
    maxHp: 80,
  });
  const card = { uid: 'tested', cardId: definition.id, upgraded };
  const filler: CardInstance[] = Array.from({ length: 16 }, (_, index) => ({ uid: `filler-${index}`, cardId: 'stone_strike', upgraded: false }));
  state.hand = [card, ...filler.slice(0, 3)];
  state.drawPile = filler.slice(3, 10); // 7
  state.discardPile = filler.slice(10, 14); // 4
  state.exhaustPile = filler.slice(14); // 2
  state.deck = [card, ...filler];
  state.powers = [];
  state.energy = 3;
  state.player.block = definition.id === 'colorless_entrench' ? 7 : 0;
  getEnemies(state).forEach((enemy, index) => {
    enemy.hp = 500;
    enemy.maxHp = 500;
    enemy.block = 0;
    enemy.poison = index === 0 ? 4 : 7;
  });
  if (['berserker_bully', 'berserker_dismantle'].includes(definition.id)) state.enemy.vulnerable = 2;
  return state;
}

const cases = EXPANDED_MARTIAL_CARDS.flatMap((definition) => [false, true].map((upgraded) => ({ definition, upgraded, label: `${definition.id}${upgraded ? '+' : ''}` })));

describe('45 source-backed martial cards, both normal and upgraded', () => {
  it('has exactly 45 new collectible definitions and complete independent behavior expectations', () => {
    expect(EXPANDED_MARTIAL_CARDS).toHaveLength(45);
    expect(Object.keys(expected).sort()).toEqual(EXPANDED_MARTIAL_CARDS.map((card) => card.id).sort());
    expect(new Set(EXPANDED_MARTIAL_CARDS.map((card) => card.id)).size).toBe(45);
    expect(new Set(EXPANDED_MARTIAL_CARDS.map((card) => card.sourceCardId)).size).toBe(45);
    expect(EXPANDED_MARTIAL_CARDS.filter((card) => card.classId === 'berserker')).toHaveLength(18);
    expect(EXPANDED_MARTIAL_CARDS.filter((card) => card.classId === 'assassin')).toHaveLength(15);
    expect(EXPANDED_MARTIAL_CARDS.filter((card) => card.classId === 'colorless')).toHaveLength(12);
  });

  it.each(cases)('$label resolves the TXT values, secondary effects and actual upgrade cost', ({ definition, upgraded }) => {
    expect(CARD_DEFINITIONS[definition.id]).toEqual(definition);
    const source = catalog.cards.find((entry) => entry.sourceId === definition.sourceCardId)!;
    expect(source).toBeDefined();
    expect(source.sourceClass).toBe(definition.classId);
    expect(source.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    const rawCost = upgraded ? source.upgraded.costRaw : source.normal.costRaw;
    expect(definition.xCost ? 'X' : String(upgraded ? definition.upgradedCost : definition.cost)).toBe(rawCost);
    expect(definition.metadataProvisional).toBe(true);
    expect(definition.tokenOnly).not.toBe(true);
    expect(definition.rewardEligible).not.toBe(false);
    const state = fixture(definition, upgraded);
    const before = JSON.stringify(state);
    const { result, cues } = captureCombatTransition(state, () => reduceCombat(state, { type: 'playCard', cardId: 'tested' }));
    expect(result).not.toBe(state);
    expect(JSON.stringify(state)).toBe(before);
    const want = expected[definition.id];
    const version = Number(upgraded);
    if (want.damage) {
      expect(500 - result.enemy.hp).toBe(want.damage[version]);
      expect(getEnemies(result)[1].hp).toBe(500);
    }
    if (want.allDamage) expect(getEnemies(result).map((enemy) => 500 - enemy.hp)).toEqual([want.allDamage[version], want.allDamage[version]]);
    if (want.totalDamage) expect(getEnemies(result).reduce((total, enemy) => total + 500 - enemy.hp, 0)).toBe(want.totalDamage[version]);
    if (want.hits) expect(cues.filter((cue) => cue.kind === 'impact' && cue.targetId !== 'player')).toHaveLength(want.hits[version]);
    if (want.block) expect(result.player.block).toBe(want.block[version]);
    if (want.hp) expect(80 - result.player.hp).toBe(want.hp[version]);
    if (want.weak) expect(result.enemy.weak).toBe(want.weak[version]);
    if (want.vulnerable) expect(result.enemy.vulnerable).toBe(want.vulnerable[version]);
    if (want.allWeak) expect(getEnemies(result).map((enemy) => enemy.weak)).toEqual([want.allWeak[version], want.allWeak[version]]);
    if (want.allVulnerable) expect(getEnemies(result).map((enemy) => enemy.vulnerable)).toEqual([want.allVulnerable[version], want.allVulnerable[version]]);
    if (want.poison) expect(result.enemy.poison).toBe(want.poison[version]);
    expect(result.energy).toBe(3 - getCardCost(state.hand[0], state) + (want.energyGain?.[version] ?? 0));
    if (want.strength) expect(result.player.strength).toBe(want.strength[version]);
    if (want.thorns) expect(result.powerStacks?.thorns).toBe(want.thorns[version]);
    if (want.blockOnAttack) expect(result.powerStacks?.blockOnAttack).toBe(want.blockOnAttack[version]);
    if (want.energyOnTurn) expect(result.powerStacks?.energyOnTurn).toBe(want.energyOnTurn[version]);
    if (want.finalHand) expect(result.hand).toHaveLength(want.finalHand[version]);
    if (want.randomExhaust) {
      expect(result.hand).toHaveLength(2);
      expect(result.exhaustPile).toHaveLength(3);
    }
    if (want.nextEnergy || want.energyOnTurn || want.nextBlock || want.strength || want.blockOnAttack || want.thorns) {
      // Saved next-turn/temporary mechanics must resolve identically after loading.
      const restored = deserializeGame(serializeGame(result));
      expect(restored).not.toBeNull();
      const next = reduceCombat(restored!, { type: 'endTurn' });
      expect(next).toEqual(reduceCombat(result, { type: 'endTurn' }));
      if (want.nextEnergy) expect(next.energy).toBe(3 + want.nextEnergy[version]);
      if (want.energyOnTurn) expect(next.energy).toBe(3 + want.energyOnTurn[version]);
      if (want.nextBlock) expect(next.player.block).toBe(want.nextBlock[version]);
      if (want.strength) expect(next.player.strength).toBe(0);
      if (want.blockOnAttack) expect(next.powerStacks?.blockOnAttack ?? 0).toBe(0);
      if (definition.id === 'berserker_flame_barrier') expect(next.powerStacks?.thorns ?? 0).toBe(0);
      if (definition.id === 'colorless_caltrops') expect(next.powerStacks?.thorns).toBe(want.thorns![version]);
    }
    if (definition.type === 'power') expect(result.powers.some((card) => card.uid === 'tested')).toBe(true);
    else {
      const exhaust = upgraded ? definition.upgradedExhaust ?? definition.exhaust : definition.exhaust;
      expect(result[exhaust ? 'exhaustPile' : 'discardPile'].some((card) => card.uid === 'tested')).toBe(true);
    }
    expect(isValidCombatState(result)).toBe(true);
    expect(deserializeGame(serializeGame(result))).toEqual(result);
    expect(reduceCombat(state, { type: 'playCard', cardId: 'tested' })).toEqual(result);
  });

  it.each([false, true])('checks failed poison conditions, one-hit dismantle, empty X and damage floor (%s)', (upgraded) => {
    const byId = (id: string) => EXPANDED_MARTIAL_CARDS.find((card) => card.id === id)!;
    const bubble = fixture(byId('assassin_bubble'), upgraded);
    bubble.enemy.poison = 0;
    expect(reduceCombat(bubble, { type: 'playCard', cardId: 'tested' }).enemy.poison).toBe(0);
    const dismantle = fixture(byId('berserker_dismantle'), upgraded);
    dismantle.enemy.vulnerable = 0;
    expect(500 - reduceCombat(dismantle, { type: 'playCard', cardId: 'tested' }).enemy.hp).toBe(upgraded ? 10 : 8);
    const x = fixture(byId('berserker_whirlwind'), upgraded);
    x.energy = 0;
    expect(getEnemies(reduceCombat(x, { type: 'playCard', cardId: 'tested' })).every((enemy) => enemy.hp === 500)).toBe(true);
    const blade = fixture(byId('assassin_focused_blade'), upgraded);
    blade.hand.push(...blade.drawPile);
    blade.drawPile = [];
    expect(reduceCombat(blade, { type: 'playCard', cardId: 'tested' }).enemy.hp).toBe(500);
  });

  it.each([false, true])('temporary barriers retaliate each enemy hit and rage only rewards subsequent attacks (%s)', (upgraded) => {
    const byId = (id: string) => EXPANDED_MARTIAL_CARDS.find((card) => card.id === id)!;
    const barrier = fixture(byId('berserker_flame_barrier'), upgraded);
    getEnemies(barrier).forEach((enemy) => {
      enemy.poison = 0;
      enemy.intent = { kind: 'attack', label: '二連打', description: '3ダメージを2回。', damage: 3, hits: 2 };
    });
    const activated = reduceCombat(barrier, { type: 'playCard', cardId: 'tested' });
    const next = reduceCombat(activated, { type: 'endTurn' });
    expect(getEnemies(next).map((enemy) => 500 - enemy.hp)).toEqual([upgraded ? 12 : 8, upgraded ? 12 : 8]);
    expect(next.powerStacks?.thorns ?? 0).toBe(0);
    const rage = fixture(byId('berserker_rage'), upgraded);
    const prepared = reduceCombat(rage, { type: 'playCard', cardId: 'tested' });
    expect(prepared.player.block).toBe(0);
    expect(reduceCombat(prepared, { type: 'playCard', cardId: prepared.hand[0].uid }).player.block).toBe(upgraded ? 5 : 3);
  });

  it('temporary effects expire without deleting pre-existing permanent strength or thorns', () => {
    const byId = (id: string) => EXPANDED_MARTIAL_CARDS.find((card) => card.id === id)!;
    const strength = fixture(byId('berserker_setup_strike'), false);
    strength.player.strength = 4;
    const empowered = reduceCombat(strength, { type: 'playCard', cardId: 'tested' });
    expect(empowered.player.strength).toBe(6);
    expect(reduceCombat(empowered, { type: 'endTurn' }).player.strength).toBe(4);
    const thorns = fixture(byId('berserker_flame_barrier'), false);
    thorns.powerStacks = { thorns: 3 };
    const protectedState = reduceCombat(thorns, { type: 'playCard', cardId: 'tested' });
    expect(protectedState.powerStacks!.thorns).toBe(7);
    expect(reduceCombat(protectedState, { type: 'endTurn' }).powerStacks!.thorns).toBe(3);
  });

  it('scheduled block resolves exactly once after a save/load, then leaves no repeat reward', () => {
    const state = fixture(EXPANDED_MARTIAL_CARDS.find((card) => card.id === 'assassin_dodge_roll')!, true);
    const prepared = reduceCombat(state, { type: 'playCard', cardId: 'tested' });
    const first = reduceCombat(deserializeGame(serializeGame(prepared))!, { type: 'endTurn' });
    expect(first.player.block).toBe(6);
    expect(first.scheduledEffects ?? []).toEqual([]);
    const second = reduceCombat(deserializeGame(serializeGame(first))!, { type: 'endTurn' });
    expect(second.player.block).toBe(0);
    expect(second.scheduledEffects ?? []).toEqual([]);
  });

  it('random-hit and random-exhaust cards advance only their cloned seeded RNG and replay identically', () => {
    for (const id of ['berserker_boomerang', 'berserker_char']) {
      const state = fixture(EXPANDED_MARTIAL_CARDS.find((card) => card.id === id)!, false);
      const rng = state.rngState;
      const result = reduceCombat(state, { type: 'playCard', cardId: 'tested' });
      expect(result.rngState).not.toBe(rng);
      expect(state.rngState).toBe(rng);
      expect(reduceCombat(deserializeGame(serializeGame(state))!, { type: 'playCard', cardId: 'tested' })).toEqual(result);
    }
  });
});

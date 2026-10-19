import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import { EXPANDED_MYSTIC_CARDS } from '../data/expandedMysticCards';
import source from '../data/sourceCards.generated.json';
import { createCombat, getCardCost, getEnemies, reduceCombat } from '../engine';
import { deserializeGame, serializeGame } from '../engine/persistence';
import type { CombatAction, CombatState } from '../types/game';

const UPGRADE_CASES = [false, true] as const;
const variant = <T,>(pair: readonly [T, T], upgraded: boolean): T => pair[Number(upgraded)];
const definition = (id: string) => CARD_DEFINITIONS[id];

function fixture(id: string, upgraded: boolean): CombatState {
  const card = definition(id);
  if (!card) throw new Error(`Unregistered card: ${id}`);
  const state = createCombat('expanded-mystic-exact-effects', ['grit_scout', 'grit_scout'], { classId: card.classId === 'colorless' ? undefined : card.classId });
  const played = { uid: 'mystic-played', cardId: id, upgraded };
  const filler = Array.from({ length: 36 }, (_, index) => ({ uid: `mystic-filler-${index}`, cardId: 'still_guard', upgraded: false }));
  state.hand = [played, ...filler.slice(0, 4)];
  state.drawPile = filler.slice(4, 32);
  state.discardPile = filler.slice(32);
  state.exhaustPile = [];
  state.powers = [];
  state.deck = [played, ...filler];
  state.generatedCards = [];
  state.energy = 10;
  state.cardsPlayedThisTurn = 0;
  state.player.strength = 0;
  state.player.block = 0;
  state.player.weak = 0;
  state.jitto = 0;
  state.classResources!.ostyHp = 5;
  state.classResources!.orbs = [];
  state.classResources!.focus = 0;
  for (const enemy of getEnemies(state)) {
    Object.assign(enemy, { hp: 2000, maxHp: 2000, block: 0, strength: 0, weak: 0, vulnerable: 0, poison: 0, doom: 0 });
    enemy.intent = { kind: 'defend', label: '静観', description: '検証用の静観。', block: 0 };
  }
  return state;
}

function play(state: CombatState): CombatState {
  return reduceCombat(state, { type: 'playCard', cardId: 'mystic-played' });
}

function finishChoices(state: CombatState): CombatState {
  let current = state;
  while (current.pendingChoice) {
    const choice = current.pendingChoice;
    const cardIds = current[choice.sourceZone ?? 'hand'].slice(0, choice.amount).map((card) => card.uid);
    current = reduceCombat(current, { type: 'chooseCards', cardIds });
  }
  return current;
}

function idleTurn(state: CombatState): CombatState {
  for (const enemy of getEnemies(state)) enemy.intent = { kind: 'defend', label: '静観', description: '検証用の静観。', block: 0 };
  return reduceCombat(state, { type: 'endTurn' });
}

interface Expected {
  id: string;
  damage?: readonly [number, number];
  allDamage?: boolean;
  block?: readonly [number, number];
  weak?: readonly [number, number];
  vulnerable?: readonly [number, number];
  allStatuses?: boolean;
  playerStrength?: readonly [number, number];
  enemyStrength?: readonly [number, number];
  summon?: readonly [number, number];
  doom?: readonly [number, number];
  stars?: readonly [number, number];
  extraDraw?: readonly [number, number];
  nextEnergy?: readonly [number, number];
  energyGain?: readonly [number, number];
  focus?: readonly [number, number];
  copied?: boolean;
  souls?: readonly [number, number, number];
  upgradedSouls?: readonly [number, number, number];
}

// Independent expected outcomes, rather than resolving/inspecting a definition's own effects.
const SIMPLE_CASES: Expected[] = [
  { id: 'oracle_falling_star', damage: [8, 12], weak: [1, 1], vulnerable: [1, 1] },
  { id: 'oracle_stellar_wave', damage: [14, 18], allDamage: true },
  { id: 'oracle_know_your_place', weak: [1, 1], vulnerable: [1, 1] },
  { id: 'oracle_star_cloak', block: [7, 10] },
  { id: 'oracle_gamma_blast', damage: [13, 18], weak: [2, 2], vulnerable: [2, 2] },
  { id: 'oracle_annihilate', damage: [30, 40] },
  { id: 'oracle_hegemony', damage: [15, 18], nextEnergy: [2, 3] },
  { id: 'oracle_royal_gamble', stars: [9, 9] },
  { id: 'oracle_resonance', playerStrength: [1, 2], enemyStrength: [-1, -1], allStatuses: true },
  { id: 'oracle_comet', damage: [33, 44], weak: [3, 3], vulnerable: [3, 3] },
  { id: 'oracle_seven_stars', damage: [49, 49], allDamage: true },
  { id: 'oracle_meteor_shower', damage: [14, 21], allDamage: true, weak: [2, 2], vulnerable: [2, 2], allStatuses: true },
  { id: 'necromancer_dread', damage: [7, 8], vulnerable: [1, 2] },
  { id: 'necromancer_defiance', block: [6, 9], weak: [1, 1] },
  { id: 'necromancer_provoke', summon: [4, 5], block: [7, 9] },
  { id: 'necromancer_high_five', damage: [11, 13], vulnerable: [2, 3], allStatuses: true },
  { id: 'necromancer_split_soul', damage: [13, 18], souls: [1, 1, 1] },
  { id: 'necromancer_entomb', damage: [52, 63] },
  { id: 'necromancer_fester', weak: [2, 3], vulnerable: [2, 3] },
  { id: 'necromancer_analyze', extraDraw: [3, 4] },
  { id: 'necromancer_delay', block: [11, 13], nextEnergy: [1, 2] },
  { id: 'necromancer_deathbringer', doom: [21, 26], weak: [1, 1], allStatuses: true },
  { id: 'necromancer_bone_army', summon: [6, 8] },
  { id: 'necromancer_common_fate', playerStrength: [-2, -2], enemyStrength: [-2, -3] },
  { id: 'necromancer_immortality', block: [7, 9], copied: true },
  { id: 'necromancer_beyond_glimpse', souls: [3, 0, 0], upgradedSouls: [4, 0, 0] },
  { id: 'necromancer_resurrection', summon: [20, 25] },
  { id: 'machinist_beam_cell', damage: [3, 4], vulnerable: [1, 2] },
  { id: 'machinist_boot', block: [10, 13] },
  { id: 'machinist_hyperbeam', damage: [26, 34], allDamage: true, focus: [-3, -3] },
  { id: 'machinist_supercritical', energyGain: [4, 6] },
];

const COMPLEX_IDS = [
  'oracle_guiding_star', 'oracle_hidden_wealth', 'oracle_glimmer', 'oracle_glittering_torrent',
  'oracle_photon_cut', 'oracle_faint_light', 'oracle_cosmic_indifference', 'oracle_heavenly_drill',
  'necromancer_prayer', 'necromancer_domain', 'necromancer_eradicate', 'necromancer_grave_blast',
  'necromancer_harvest', 'necromancer_deadline',
  'machinist_compile', 'machinist_salvage', 'machinist_ice_lance', 'machinist_quadcast', 'machinist_barrage',
  'machinist_chill', 'machinist_double_energy', 'machinist_multicast', 'machinist_eye_poke',
  'machinist_ftl', 'machinist_machine_learning', 'machinist_hologram', 'machinist_synchrony', 'machinist_pulverize',
];

describe('source-backed mystic expansion completeness', () => {
  it('registers exactly 59 unique collectible references and tests every card outcome', () => {
    expect(EXPANDED_MYSTIC_CARDS).toHaveLength(59);
    expect(new Set(EXPANDED_MYSTIC_CARDS.map((card) => card.id)).size).toBe(59);
    expect(new Set(EXPANDED_MYSTIC_CARDS.map((card) => card.sourceCardId)).size).toBe(59);
    expect([...SIMPLE_CASES.map((item) => item.id), ...COMPLEX_IDS].sort()).toEqual(EXPANDED_MYSTIC_CARDS.map((card) => card.id).sort());
    for (const card of EXPANDED_MYSTIC_CARDS) {
      expect(CARD_DEFINITIONS[card.id]).toBe(card);
      expect(card.tokenOnly).not.toBe(true);
      expect(card.rewardEligible).not.toBe(false);
    }
  });

  it.each(EXPANDED_MYSTIC_CARDS)('$id uses the exact source costs and explicitly provisional metadata', (card) => {
    const reference = source.cards.find((item) => item.id === card.sourceCardId)!;
    expect(reference).toBeDefined();
    expect(reference.sourceClass).toBe(card.classId);
    expect(card.cost).toBe(reference.normal.costRaw === 'X' ? 0 : Number(reference.normal.costRaw));
    expect(card.upgradedCost).toBe(reference.upgraded.costRaw === 'X' ? 0 : Number(reference.upgraded.costRaw));
    expect(card.xCost).toBe(reference.normal.costRaw === 'X');
    expect(card.metadataProvisional).toBe(true);
    expect(card.effects.length).toBeGreaterThan(0);
    expect(card.upgradedEffects.length).toBeGreaterThan(0);
    expect(Number.isFinite(card.cost)).toBe(true);
    expect(Number.isFinite(card.upgradedCost)).toBe(true);
  });
});

describe.each(UPGRADE_CASES)('mystic exact card outcomes (upgraded=%s)', (upgraded) => {
  it.each(EXPANDED_MYSTIC_CARDS)('$id restores its played/pending/scheduled state and continues identically', (card) => {
    const before = fixture(card.id, upgraded);
    before.classResources!.orbs = ['lightning', 'frost'];
    const after = play(before);
    const restored = deserializeGame(serializeGame(after));
    expect(restored).not.toBeNull();
    expect(restored).toEqual(after);
    const action: CombatAction = after.pendingChoice
      ? { type: 'chooseCards', cardIds: after[after.pendingChoice.sourceZone ?? 'hand'].slice(0, after.pendingChoice.amount).map((held) => held.uid) }
      : { type: 'endTurn' };
    const continued = reduceCombat(after, action);
    expect(reduceCombat(restored!, action)).toEqual(continued);
    expect(deserializeGame(serializeGame(continued))).toEqual(continued);
  });

  it.each(SIMPLE_CASES)('$id applies every printed numeric effect', (expected) => {
    const state = fixture(expected.id, upgraded);
    const input = structuredClone(state);
    const card = state.hand[0];
    const after = play(state);
    const enemies = getEnemies(after);
    expect(after.energy).toBe(10 - getCardCost(card, state) + (expected.energyGain ? variant(expected.energyGain, upgraded) : 0));
    expect(after.enemy.hp).toBe(2000 - (expected.damage ? variant(expected.damage, upgraded) : 0));
    expect(enemies[1].hp).toBe(2000 - (expected.allDamage && expected.damage ? variant(expected.damage, upgraded) : 0));
    expect(after.player.block).toBe(expected.block ? variant(expected.block, upgraded) : 0);
    expect(after.player.strength).toBe(expected.playerStrength ? variant(expected.playerStrength, upgraded) : 0);
    expect(after.classResources!.ostyHp).toBe(5 + (expected.summon ? variant(expected.summon, upgraded) : 0));
    expect(after.classResources!.stars).toBe(expected.stars ? variant(expected.stars, upgraded) : 0);
    expect(after.classResources!.starsGainedThisTurn).toBe(expected.stars ? variant(expected.stars, upgraded) : 0);
    expect(after.classResources!.focus).toBe(expected.focus ? variant(expected.focus, upgraded) : 0);
    expect(after.classResources!.nextTurnEnergy).toBe(expected.nextEnergy ? variant(expected.nextEnergy, upgraded) : 0);
    expect(after.hand.length).toBe(4 + (expected.extraDraw ? variant(expected.extraDraw, upgraded) : 0) + (expected.souls?.[1] ?? 0));
    for (const [index, enemy] of enemies.entries()) {
      const affected = index === 0 || expected.allStatuses;
      expect(enemy.weak).toBe(affected && expected.weak ? variant(expected.weak, upgraded) : 0);
      expect(enemy.vulnerable).toBe(affected && expected.vulnerable ? variant(expected.vulnerable, upgraded) : 0);
      expect(enemy.strength).toBe(affected && expected.enemyStrength ? variant(expected.enemyStrength, upgraded) : 0);
      expect(enemy.doom).toBe(affected && expected.doom ? variant(expected.doom, upgraded) : 0);
    }
    if (expected.souls) {
      const souls = upgraded ? expected.upgradedSouls ?? expected.souls : expected.souls;
      for (const [index, zone] of (['drawPile', 'hand', 'discardPile'] as const).entries())
        expect(after[zone].filter((held) => held.cardId === 'token_soul')).toHaveLength(souls[index]);
    }
    if (expected.copied) {
      expect(after.generatedCards).toHaveLength(1);
      expect(after.generatedCards![0]).toMatchObject({ cardId: expected.id, upgraded });
      expect(after.discardPile.filter((held) => held.cardId === expected.id)).toHaveLength(2);
    }
    const def = definition(expected.id);
    const exhausted = upgraded ? def.upgradedExhaust ?? def.exhaust : def.exhaust;
    expect(after[exhausted ? 'exhaustPile' : def.type === 'power' ? 'powers' : 'discardPile'].some((held) => held.uid === card.uid)).toBe(true);
    expect(after.deck).toEqual(state.deck);
    expect(state).toEqual(input);
  });

  it('oracle_guiding_star deals exact damage and draws only on the next turn', () => {
    const before = fixture('oracle_guiding_star', upgraded);
    const after = play(before);
    expect(after.enemy.hp).toBe(2000 - (upgraded ? 13 : 12));
    expect(after.hand).toHaveLength(4);
    expect(idleTurn(after).hand).toHaveLength(5 + (upgraded ? 3 : 2));
  });

  it('oracle_hidden_wealth gains each star once without spending accumulated stars', () => {
    const before = fixture('oracle_hidden_wealth', upgraded);
    before.classResources!.stars = 7;
    const played = play(before);
    expect(played.classResources).toMatchObject({ stars: 8, starsGainedThisTurn: 1 });
    const next = idleTurn(played);
    expect(next.classResources).toMatchObject({ stars: upgraded ? 12 : 11, starsGainedThisTurn: upgraded ? 4 : 3 });
    expect(idleTurn(next).classResources!.stars).toBe(next.classResources!.stars);
  });

  it('oracle_glimmer combines immediate and next-turn draw with its exact star variant', () => {
    const played = play(fixture('oracle_glimmer', upgraded));
    expect(played.hand).toHaveLength(5);
    expect(played.classResources!.stars).toBe(upgraded ? 2 : 1);
    const next = idleTurn(played);
    expect(next.hand).toHaveLength(6);
    expect(next.classResources!.starsGainedThisTurn).toBe(0);
  });

  it('oracle_glittering_torrent keeps the delayed block after the ordinary block reset', () => {
    const played = play(fixture('oracle_glittering_torrent', upgraded));
    expect(played.player.block).toBe(upgraded ? 13 : 11);
    expect(idleTurn(played).player.block).toBe(upgraded ? 7 : 5);
  });

  it.each(['oracle_photon_cut', 'oracle_faint_light', 'oracle_cosmic_indifference'])('%s topdecks the chosen existing card without duplication', (id) => {
    const before = fixture(id, upgraded);
    const played = play(before);
    const fromDiscard = id === 'oracle_cosmic_indifference';
    expect(played.pendingChoice).toMatchObject({ mode: 'topdeck', amount: 1 });
    expect(played.pendingChoice!.sourceZone ?? 'hand').toBe(fromDiscard ? 'discardPile' : 'hand');
    const extraDraw = id === 'oracle_photon_cut' ? upgraded ? 2 : 1 : id === 'oracle_faint_light' ? upgraded ? 4 : 3 : 0;
    expect(played.hand).toHaveLength(4 + extraDraw);
    expect(played.enemy.hp).toBe(2000 - (id === 'oracle_photon_cut' ? upgraded ? 13 : 10 : 0));
    expect(played.player.block).toBe(fromDiscard ? upgraded ? 9 : 6 : 0);
    const selected = played[fromDiscard ? 'discardPile' : 'hand'][1];
    const after = reduceCombat(played, { type: 'chooseCards', cardIds: [selected.uid] });
    expect(after.drawPile.at(-1)?.uid).toBe(selected.uid);
    expect(after[fromDiscard ? 'discardPile' : 'hand'].some((card) => card.uid === selected.uid)).toBe(false);
    expect(after.pendingChoice).toBeUndefined();
    expect(after.deck).toEqual(before.deck);
  });

  it.each([0, 1, 3, 4, 5])('oracle_heavenly_drill uses paid X=%i and doubles only at four', (energy) => {
    const before = fixture('oracle_heavenly_drill', upgraded);
    before.energy = energy;
    const after = play(before);
    expect(after.energy).toBe(0);
    expect(after.enemy.hp).toBe(2000 - (upgraded ? 10 : 8) * energy * (energy >= 4 ? 2 : 1));
  });

  it('necromancer_prayer waits one turn and does not repeat its summon or energy', () => {
    const played = play(fixture('necromancer_prayer', upgraded));
    expect(played.classResources!.ostyHp).toBe(5);
    const next = idleTurn(played);
    expect(next.classResources!.ostyHp).toBe(upgraded ? 8 : 7);
    expect(next.energy).toBe(upgraded ? 6 : 5);
    const following = idleTurn(next);
    expect(following.classResources!.ostyHp).toBe(next.classResources!.ostyHp);
    expect(following.energy).toBe(3);
  });

  it('necromancer_domain grants an energy and extra draw on every following turn', () => {
    const before = fixture('necromancer_domain', upgraded);
    const played = play(before);
    expect(played.energy).toBe(upgraded ? 8 : 7);
    expect(played.powers.some((card) => card.uid === 'mystic-played')).toBe(true);
    expect(played.hand).toHaveLength(4);
    const next = idleTurn(played);
    expect(next.energy).toBe(4);
    expect(next.hand).toHaveLength(6);
    const following = idleTurn(next);
    expect(following.energy).toBe(4);
    expect(following.hand).toHaveLength(6);
  });

  it.each([0, 1, 3])('necromancer_eradicate hits exactly X=%i times and does not consume stars', (energy) => {
    const before = fixture('necromancer_eradicate', upgraded);
    before.energy = energy;
    before.classResources!.stars = 6;
    const after = play(before);
    expect(after.energy).toBe(0);
    expect(after.enemy.hp).toBe(2000 - energy * (upgraded ? 14 : 11));
    expect(after.classResources!.stars).toBe(6);
  });

  it.each(['necromancer_grave_blast', 'necromancer_harvest', 'machinist_hologram'])('%s retrieves the selected discard instances before settling the played card', (id) => {
    const before = fixture(id, upgraded);
    const played = play(before);
    const count = id === 'necromancer_harvest' ? 3 : 1;
    expect(played.pendingChoice).toMatchObject({ mode: 'retrieve', sourceZone: 'discardPile', amount: count });
    expect(played.enemy.hp).toBe(2000 - (id === 'necromancer_grave_blast' ? upgraded ? 6 : 4 : 0));
    expect(played.player.block).toBe(id === 'machinist_hologram' ? upgraded ? 5 : 3 : 0);
    const ids = played.discardPile.slice(0, count).map((card) => card.uid);
    const after = reduceCombat(played, { type: 'chooseCards', cardIds: ids });
    expect(after.hand).toHaveLength(4 + count);
    for (const uid of ids) {
      expect(after.hand.some((card) => card.uid === uid)).toBe(true);
      expect(after.discardPile.some((card) => card.uid === uid)).toBe(false);
    }
    expect(after[!upgraded || id === 'necromancer_harvest' ? 'exhaustPile' : 'discardPile'].some((card) => card.uid === 'mystic-played')).toBe(true);
    expect(after.deck).toEqual(before.deck);
  });

  it('necromancer_deadline scales from the selected enemy doom and applies attack modifiers once', () => {
    const before = fixture('necromancer_deadline', upgraded);
    before.enemy.doom = 17;
    before.enemy.block = 2;
    before.player.strength = 3;
    const after = play(before);
    expect(after.enemy.hp).toBe(1982);
    expect(after.exhaustPile.some((card) => card.uid === 'mystic-played')).toBe(true);
    expect(getEnemies(after)[1].hp).toBe(2000);
  });

  it('machinist_compile draws once per distinct held orb type, not once per slot', () => {
    const before = fixture('machinist_compile', upgraded);
    before.classResources!.orbs = ['lightning', 'frost', 'frost'];
    const after = play(before);
    expect(after.enemy.hp).toBe(2000 - (upgraded ? 10 : 7));
    expect(after.hand).toHaveLength(6);
    expect(after.classResources!.orbs).toEqual(before.classResources!.orbs);
  });

  it('machinist_salvage requires a chosen exhaust before scheduling exact next-turn energy', () => {
    const played = play(fixture('machinist_salvage', upgraded));
    expect(played.pendingChoice).toMatchObject({ mode: 'exhaust', amount: 1 });
    expect(played.classResources!.nextTurnEnergy).toBe(0);
    const selected = played.hand[1].uid;
    const after = reduceCombat(played, { type: 'chooseCards', cardIds: [selected] });
    expect(after.exhaustPile.some((card) => card.uid === selected)).toBe(true);
    expect(after.classResources!.nextTurnEnergy).toBe(upgraded ? 3 : 2);
  });

  it('machinist_ice_lance deals exact damage and fills three frost slots', () => {
    const played = play(fixture('machinist_ice_lance', upgraded));
    expect(played.enemy.hp).toBe(2000 - (upgraded ? 24 : 19));
    expect(played.classResources!.orbs).toEqual(['frost', 'frost', 'frost']);
  });

  it('machinist_quadcast evokes the same rightmost orb four times and removes it once', () => {
    const before = fixture('machinist_quadcast', upgraded);
    before.classResources!.orbs = ['lightning', 'frost'];
    before.classResources!.focus = 2;
    const played = play(before);
    expect(played.player.block).toBe(28);
    expect(played.classResources!.orbs).toEqual(['lightning']);
    expect(played.energy).toBe(upgraded ? 10 : 9);
  });

  it.each([0, 1, 3])('machinist_barrage hits once per held orb (count=%i)', (count) => {
    const before = fixture('machinist_barrage', upgraded);
    before.classResources!.orbs = Array.from({ length: count }, () => 'frost');
    const after = play(before);
    expect(after.enemy.hp).toBe(2000 - count * (upgraded ? 7 : 5));
  });

  it('machinist_chill counts living enemies and removes exhaust only on upgrade', () => {
    const before = fixture('machinist_chill', upgraded);
    const played = play(before);
    expect(played.classResources!.orbs).toEqual(['frost', 'frost']);
    expect(played[upgraded ? 'discardPile' : 'exhaustPile'].some((card) => card.uid === 'mystic-played')).toBe(true);
  });

  it('machinist_double_energy doubles the remaining energy after paying the correct variant cost', () => {
    const before = fixture('machinist_double_energy', upgraded);
    before.energy = 3;
    const played = play(before);
    expect(played.energy).toBe(upgraded ? 6 : 4);
    expect(played.exhaustPile.some((card) => card.uid === 'mystic-played')).toBe(true);
  });

  it.each([0, 1, 3])('machinist_multicast evokes the rightmost orb X=%i plus upgrade bonus', (energy) => {
    const before = fixture('machinist_multicast', upgraded);
    before.energy = energy;
    before.classResources!.orbs = ['lightning', 'frost'];
    const played = play(before);
    expect(played.energy).toBe(0);
    expect(played.player.block).toBe(5 * (energy + Number(upgraded)));
    expect(played.classResources!.orbs).toEqual(['lightning']);
  });

  it.each([false, true])('machinist_eye_poke applies weakness only to attacking intent (%s)', (attacking) => {
    const before = fixture('machinist_eye_poke', upgraded);
    if (attacking) before.enemy.intent = { kind: 'attack', damage: 7, label: '攻撃', description: '7ダメージ。' };
    const after = play(before);
    expect(after.enemy.hp).toBe(2000 - (upgraded ? 4 : 3));
    expect(after.enemy.weak).toBe(attacking ? upgraded ? 2 : 1 : 0);
  });

  it.each([0, 1, 2, 3, 4])('machinist_ftl checks the count including its own play (prior=%i)', (previousCards) => {
    const before = fixture('machinist_ftl', upgraded);
    before.cardsPlayedThisTurn = previousCards;
    const after = play(before);
    expect(after.enemy.hp).toBe(2000 - (upgraded ? 6 : 5));
    expect(after.hand).toHaveLength(4 + Number(previousCards + 1 < (upgraded ? 4 : 3)));
  });

  it('machinist_machine_learning adds one draw every following turn', () => {
    const played = play(fixture('machinist_machine_learning', upgraded));
    expect(played.powers.some((card) => card.uid === 'mystic-played')).toBe(true);
    expect(played.hand).toHaveLength(4);
    const next = idleTurn(played);
    expect(next.hand).toHaveLength(6);
    expect(idleTurn(next).hand).toHaveLength(6);
  });

  it('machinist_synchrony scales temporary focus by distinct types and expires after passive orbs', () => {
    const before = fixture('machinist_synchrony', upgraded);
    before.classResources!.focus = 1;
    before.classResources!.orbs = ['frost', 'frost', 'lightning'];
    const played = play(before);
    expect(played.classResources).toMatchObject({ focus: 5, temporaryFocus: 4 });
    const next = idleTurn(played);
    expect(next.classResources).toMatchObject({ focus: 1, temporaryFocus: 0 });
    expect(played[upgraded ? 'discardPile' : 'exhaustPile'].some((card) => card.uid === 'mystic-played')).toBe(true);
  });

  it('machinist_pulverize hits every enemy and evokes every held orb exactly once', () => {
    const before = fixture('machinist_pulverize', upgraded);
    before.classResources!.orbs = ['frost', 'frost', 'frost'];
    const played = play(before);
    expect(getEnemies(played).map((enemy) => enemy.hp)).toEqual([2000 - (upgraded ? 15 : 11), 2000 - (upgraded ? 15 : 11)]);
    expect(played.player.block).toBe(15);
    expect(played.classResources!.orbs).toEqual([]);
  });
});

describe('mystic edge cases and upgrade metadata', () => {
  it('upgraded machine learning is genuinely innate, while the normal card is not forced into the opening hand', () => {
    const base = { uid: 'opening-learning', cardId: 'machinist_machine_learning', upgraded: false };
    const filler = Array.from({ length: 15 }, (_, index) => ({ uid: `opening-${index}`, cardId: 'machinist_guard', upgraded: false }));
    const seed = Array.from({ length: 20 }, (_, index) => `innate-${index}`).find((value) => !createCombat(value, 'grit_scout', { classId: 'machinist', deck: [base, ...filler] }).hand.some((card) => card.uid === base.uid))!;
    expect(seed).toBeDefined();
    const upgraded = createCombat(seed, 'grit_scout', { classId: 'machinist', deck: [{ ...base, upgraded: true }, ...filler] });
    expect(upgraded.hand.some((card) => card.uid === base.uid)).toBe(true);
  });

  it('empty discard retrieval skips the choice and still settles the card once', () => {
    const before = fixture('necromancer_grave_blast', false);
    before.discardPile = [];
    const after = play(before);
    expect(after.pendingChoice).toBeUndefined();
    expect(after.enemy.hp).toBe(1996);
    expect(after.exhaustPile.map((card) => card.uid)).toEqual(['mystic-played']);
    expect(reduceCombat(after, { type: 'playCard', cardId: 'mystic-played' })).toBe(after);
  });

  it('a summon attack without an active companion does no damage, while its independent debuff still resolves', () => {
    const before = fixture('necromancer_high_five', true);
    before.classResources!.ostyHp = 0;
    const after = play(before);
    expect(after.enemy.hp).toBe(2000);
    expect(getEnemies(after).every((enemy) => enemy.vulnerable === 3)).toBe(true);
  });

  it('an oracle multihit recalculates strength, weakness, vulnerability and block for each hit', () => {
    const before = fixture('oracle_seven_stars', false);
    before.player.strength = 2;
    before.player.weak = 1;
    before.enemy.vulnerable = 1;
    before.enemy.block = 5;
    const after = play(before);
    expect(after.enemy.hp).toBe(2000 - (7 * Math.floor(9 * .75 * 1.5) - 5));
  });

  it('a short discard retrieves every available card once without fabricating missing cards', () => {
    const before = fixture('necromancer_harvest', true);
    before.discardPile = before.discardPile.slice(0, 2);
    const after = finishChoices(play(before));
    expect(after.hand).toHaveLength(6);
    expect(after.generatedCards).toEqual([]);
  });
});

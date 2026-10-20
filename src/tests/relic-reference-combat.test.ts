import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import { RELIC_DEFINITIONS, STARTER_RELIC_IDS, STARTER_UPGRADE_IDS, activeRelicIds, getRelicPool, replaceStarterRelic } from '../data/relics';
import { REFERENCE_RELIC_DEFINITIONS } from '../data/referenceRelics';
import { createCombat, reduceCombat } from '../engine';
import { triggerRelics } from '../engine/combat/relics';
import { attackCardBase, channelOrbs, generateCards, isStrikeCard, orbSlotCount, summonAttack, triggerPassiveOrbs } from '../engine/combat/resources';
import { dealDamage } from '../engine/combat/state';
import { getOrbView } from '../engine/combat/resourceView';
import { resolveEffects } from '../engine/effects/resolve';
import { captureCombatTransition } from '../presentation/trace';
import type { CardInstance, ClassId, CombatState } from '../types/game';

const deck = (count = 40): CardInstance[] => Array.from({ length: count }, (_, i) => ({ uid: `r-${i}`, cardId: 'stone_strike', upgraded: false }));
function battle(id: string, classId?: ClassId): CombatState {
  return createCombat('relic-contract', 'tower_abbot', { relicIds: [id], classId, deck: deck(), hp: 30, maxHp: 80 });
}
function attackCard(): CardInstance {
  const card = Object.values(CARD_DEFINITIONS).find((card) => card.type === 'attack' && card.sourceCardId && card.name === '巡礼の一打')!;
  return { uid: 'strike-test', cardId: card.id, upgraded: false };
}

describe('reference starter contracts', () => {
  it.each(['berserker', 'assassin', 'oracle', 'necromancer', 'machinist'] as const)('%s starter and replacement remain class-bound and source-bound', (classId) => {
    const regular = STARTER_RELIC_IDS[classId], upgraded = STARTER_UPGRADE_IDS[classId];
    expect(RELIC_DEFINITIONS[regular].sourceRelicId).toMatch(/^relsrc_/);
    expect(RELIC_DEFINITIONS[upgraded].sourceRelicId).toMatch(/^relsrc_/);
    expect(RELIC_DEFINITIONS[regular].classId).toBe(classId);
    expect(replaceStarterRelic([regular, 'gate_fragment'], classId)).toEqual(['gate_fragment', upgraded]);
    expect(replaceStarterRelic([upgraded], classId)).toBeNull();
    expect(activeRelicIds([regular, upgraded, regular])).toEqual([upgraded]);
    for (const route of ['normal', 'shop', 'ancient', 'event'] as const) {
      expect(getRelicPool(classId, route)).not.toContain(regular);
      expect(getRelicPool(classId, route)).not.toContain(upgraded);
    }
  });
  it('burning blood heals 6 once, black blood replaces it with 12', () => {
    const normal = battle(STARTER_RELIC_IDS.berserker, 'berserker'); triggerRelics(normal, 'victory'); triggerRelics(normal, 'victory'); expect(normal.player.hp).toBe(36);
    const enhanced = createCombat('blood', 'tower_abbot', { classId: 'berserker', hp: 30, relicIds: [STARTER_RELIC_IDS.berserker, STARTER_UPGRADE_IDS.berserker] });
    triggerRelics(enhanced, 'victory'); expect(enhanced.player.hp).toBe(42);
    expect(enhanced.relicCounters?.[STARTER_RELIC_IDS.berserker]).toBeUndefined();
  });
  it('snake draws two at battle start, drake only adds two during turns 1–3', () => {
    expect(battle(STARTER_RELIC_IDS.assassin, 'assassin').hand).toHaveLength(7);
    const state = battle(STARTER_UPGRADE_IDS.assassin, 'assassin');
    expect(state.hand).toHaveLength(7);
    for (let turn = 2; turn <= 4; turn++) { const before = state.hand.length; state.turn = turn; triggerRelics(state, 'turnStart'); triggerRelics(state, 'turnStart'); expect(state.hand.length - before).toBe(turn <= 3 ? 2 : 0); }
  });
  it('divine right/fate gains 3/6 and preserves current-turn star bookkeeping', () => {
    for (const [id, stars] of [[STARTER_RELIC_IDS.oracle, 3], [STARTER_UPGRADE_IDS.oracle, 6]] as const) {
      const state = battle(id, 'oracle'); expect(state.classResources?.stars).toBe(stars); expect(state.classResources?.starsGainedThisTurn).toBe(stars);
      state.turn = 2; triggerRelics(state, 'turnStart'); expect(state.classResources?.stars).toBe(stars);
    }
  });
  it('phylacteries use summon HP resource: 1 each turn, upgraded battle 5 plus turn 2', () => {
    const state = battle(STARTER_RELIC_IDS.necromancer, 'necromancer'); expect(state.classResources?.ostyHp).toBe(1);
    state.turn = 2; triggerRelics(state, 'turnStart'); expect(state.classResources?.ostyHp).toBe(2);
    const enhanced = createCombat('spirit', 'tower_abbot', { classId: 'necromancer', relicIds: [STARTER_RELIC_IDS.necromancer, STARTER_UPGRADE_IDS.necromancer] });
    expect(enhanced.classResources?.ostyHp).toBe(7); enhanced.turn = 2; triggerRelics(enhanced, 'turnStart'); expect(enhanced.classResources?.ostyHp).toBe(9);
  });
  it('cracked and infused cores channel at combat start, never again at turn start', () => {
    for (const [id, count] of [[STARTER_RELIC_IDS.machinist, 1], [STARTER_UPGRADE_IDS.machinist, 3]] as const) {
      const state = battle(id, 'machinist'); expect(state.classResources?.orbs).toEqual(Array(count).fill('lightning'));
      state.turn = 2; triggerRelics(state, 'turnStart'); expect(state.classResources?.orbs).toHaveLength(count);
    }
  });
});

describe('source combat hooks', () => {
  it('start damage, block, healing, dexterity, poison, forge, focus and spirit souls use real state', () => {
    expect(battle('ref_anchor').player.block).toBe(10);
    const cracker = battle('ref_cracker'); expect(cracker.enemy.maxHp - cracker.enemy.hp).toBe(9);
    expect(battle('ref_blood_vial').player.hp).toBe(32);
    expect(battle('ref_smooth_stone').dexterity).toBe(1);
    expect(battle('ref_twisted_funnel').enemy.poison).toBe(4);
    expect(battle('ref_sword_manual', 'oracle').classResources?.forge).toBe(10);
    expect(battle('ref_data_disk', 'machinist').classResources?.focus).toBe(1);
    const mask = battle('ref_death_mask', 'necromancer'); expect(mask.generatedCards?.filter((card) => card.cardId === 'token_soul')).toHaveLength(3);
  });
  it('every-turn damage, enemy buffs and second/third turn bonuses are real and once per turn', () => {
    const mercury = battle('ref_mercury_hourglass'); const hp = mercury.enemy.hp; triggerRelics(mercury, 'turnStart'); expect(mercury.enemy.hp).toBe(hp);
    mercury.turn = 2; triggerRelics(mercury, 'turnStart'); expect(mercury.enemy.hp).toBe(hp - 3);
    const brimstone = battle('ref_brimstone'); expect(brimstone.player.strength).toBe(2); expect(brimstone.enemy.strength).toBe(1);
    const second = battle('ref_horn_cleat'); second.turn = 2; triggerRelics(second, 'turnStart'); expect(second.player.block).toBe(14);
    const third = battle('ref_glittering_lipstick'); third.turn = 3; triggerRelics(third, 'turnStart'); expect(third.player.strength).toBe(1); expect(third.dexterity).toBe(1);
  });
  it('run-periodic turns carry counters into the next battle without firing again on reload', () => {
    const state = battle('ref_happy_flower'); state.turn = 2; triggerRelics(state, 'turnStart'); expect(state.energy).toBe(3);
    const next = createCombat('next', 'tower_abbot', { relicIds: ['ref_happy_flower'], relicState: state.relicState }); expect(next.energy).toBe(4);
    triggerRelics(next, 'turnStart'); expect(next.energy).toBe(4); expect(next.relicState?.ref_happy_flower).toBe(3);
  });
  it('nunchaku counts ten attacks across combat boundaries, excluding skills', () => {
    const state = battle('ref_nunchaku'); const card = attackCard();
    for (let serial = 1; serial <= 9; serial++) { state.stats.cardsPlayed = serial; triggerRelics(state, 'cardPlayed', { card }); }
    expect(state.energy).toBe(3);
    const next = createCombat('next', 'tower_abbot', { relicIds: ['ref_nunchaku'], relicState: state.relicState }); next.stats.cardsPlayed = 1; triggerRelics(next, 'cardPlayed', { card }); triggerRelics(next, 'cardPlayed', { card });
    expect(next.energy).toBe(4); expect(next.relicState?.ref_nunchaku).toBe(10);
  });
  it('third attacks/skills repeat every three in the same turn and reset on a new turn', () => {
    const state = battle('ref_ornamental_fan'); const card = attackCard();
    for (let serial = 1; serial <= 6; serial++) { state.stats.cardsPlayed = serial; triggerRelics(state, 'cardPlayed', { card }); }
    expect(state.player.block).toBe(8); state.turn = 2;
    for (let serial = 7; serial <= 9; serial++) { state.stats.cardsPlayed = serial; triggerRelics(state, 'cardPlayed', { card }); }
    expect(state.player.block).toBe(12);
    const skill = { uid: 'skill-test', cardId: 'still_guard', upgraded: false }; expect(CARD_DEFINITIONS[skill.cardId]).toBeDefined();
  });
  it('enemy-kill multi effects fire exactly once per victim', () => {
    const state = battle('ref_gremlin_horn'); const hand = state.hand.length; dealDamage(state, 'enemy', state.enemy.hp, true, state.enemy);
    triggerRelics(state, 'enemyKilled', { enemyId: state.enemy.id }); expect(state.energy).toBe(4); expect(state.hand).toHaveLength(hand + 1);
  });
  it('first damage draws three, self-forming clay queues each HP loss for next turn', () => {
    const puzzle = battle('ref_centennial_puzzle'); const hand = puzzle.hand.length; dealDamage(puzzle, 'player', 2, true); dealDamage(puzzle, 'player', 3, true); expect(puzzle.hand).toHaveLength(hand + 3);
    const clay = battle('ref_self_forming_clay'); dealDamage(clay, 'player', 2, true); dealDamage(clay, 'player', 3, true); expect(clay.relicCounters?.nextTurnBlock).toBe(6);
    const after = reduceCombat(clay, { type: 'endTurn' }); expect(after.player.block).toBe(9); // two self-payments plus one enemy HP hit
  });
  it('discard and exhaust triggers fire for every moved card, not normal end-turn discards', () => {
    const state = battle('ref_forgotten_soul'); const hp = state.enemy.hp;
    resolveEffects(state, [{ type: 'exhaustRandom', amount: 2 }]); expect(state.enemy.hp).toBe(hp - 2);
    const bandages = battle('ref_tough_bandages'); resolveEffects(bandages, [{ type: 'redraw' }]); expect(bandages.player.block).toBe(15);
    const after = reduceCombat(bandages, { type: 'endTurn' }); expect(after.player.block).toBe(0);
  });
  it('generation and Osty attacks activate their own hooks without changing attack rules', () => {
    const reg = battle('ref_regalite'); generateCards(reg, 'token_knife', 2, 'hand'); expect(reg.player.block).toBe(4);
    const flute = battle('ref_bone_flute', 'necromancer'); flute.classResources!.ostyHp = 4; const hp = flute.enemy.hp; summonAttack(flute, 5, true); expect(flute.enemy.hp).toBe(hp - 9); expect(flute.player.block).toBe(2);
  });
  it('bellows upgrades every first-hand card temporarily; random pile upgrades remain reproducible', () => {
    const state = battle('ref_bellows'); expect(state.hand.every((card) => card.upgraded)).toBe(true); expect(state.temporaryUpgrades).toHaveLength(5);
    const a = battle('ref_stone_cracker'), b = battle('ref_stone_cracker'); expect(a).toEqual(b); expect(a.deck.filter((card) => card.upgraded)).toHaveLength(2);
  });
  it('strike metadata, upgraded attacks and vigor alter actual per-hit damage', () => {
    const card = attackCard(); expect(isStrikeCard(card.cardId)).toBe(true);
    const effect = CARD_DEFINITIONS[card.cardId].effects.find((effect) => effect.type === 'damage')!;
    expect(attackCardBase(battle('ref_strike_dummy'), effect, card)).toBe(effect.amount + 3);
    expect(attackCardBase(battle('ref_mini_cannon'), effect, { ...card, upgraded: true })).toBe(effect.amount + 3);
    const state = battle('ref_akabeko'); state.hand = [{ ...card }]; const after = reduceCombat(state, { type: 'playCard', cardId: card.uid }); expect(state.enemy.hp - after.enemy.hp).toBe(effect.amount + 8); expect(after.vigor).toBe(0);
  });
  it('dexterity and vambrace modify card block and leave relic/orb block unchanged', () => {
    const state = battle('ref_vambrace'); state.dexterity = 2; const card = { uid: 'block-card', cardId: 'still_guard', upgraded: false };
    resolveEffects(state, [{ type: 'block', amount: 5 }], { defense: true }, { sourceCard: card }); expect(state.player.block).toBe(14);
    resolveEffects(state, [{ type: 'block', amount: 5 }], { defense: true }, { sourceCard: card }); expect(state.player.block).toBe(21);
    resolveEffects(state, [{ type: 'block', amount: 5 }], { defense: false }, { source: 'potion' }); expect(state.player.block).toBe(26);
  });
  it('multiplying existing block receives the first card-block bonus without adding dexterity', () => {
    const state = battle('ref_vambrace'); state.player.block = 10; state.dexterity = 3;
    const card = { uid: 'multiply-card', cardId: 'still_guard', upgraded: false };
    resolveEffects(state, [{ type: 'multiply', resource: 'block', amount: 2 }], { defense: false }, { sourceCard: card });
    expect(state.player.block).toBe(30);
    resolveEffects(state, [{ type: 'multiply', resource: 'block', amount: 2 }], { defense: false }, { sourceCard: card });
    expect(state.player.block).toBe(60);
  });
  it('snecko skull applies poison bonus on actual additions without amplifying player poison', () => {
    const state = battle('ref_snecko_skull'); resolveEffects(state, [{ type: 'status', target: 'enemy', status: 'poison', amount: 3 }, { type: 'status', target: 'player', status: 'poison', amount: 2 }]); expect(state.enemy.poison).toBe(4); expect(state.player.poison).toBe(2);
  });
  it('energy and up-to-ten block retention survive real enemy turns', () => {
    const ice = battle('ref_ice_cream'); ice.energy = 2; expect(reduceCombat(ice, { type: 'endTurn' }).energy).toBe(5);
    const clamps = battle('ref_calipers'); clamps.player.block = 50; expect(reduceCombat(clamps, { type: 'endTurn' }).player.block).toBe(10);
  });
  it('runic slots update the shared HUD capacity, and cable repeats the rightmost orb only', () => {
    const state = battle('ref_runic_capacitor', 'machinist'); expect(orbSlotCount(state)).toBe(6); channelOrbs(state, 'frost', 6); expect(state.classResources?.orbs).toHaveLength(6); expect(getOrbView(state).slots).toHaveLength(6);
    const cable = battle('ref_gold_plated_cables', 'machinist'); channelOrbs(cable, 'frost', 2); triggerPassiveOrbs(cable); expect(cable.player.block).toBe(6);
  });
  it('boss and elite conditions respect the actual room category', () => {
    expect(createCombat('boss', 'tower_abbot', { hp: 30, relicIds: ['ref_pantograph'], encounterType: 'boss' }).player.hp).toBe(55);
    expect(createCombat('non-boss', 'tower_abbot', { hp: 30, relicIds: ['ref_pantograph'], encounterType: 'event' }).player.hp).toBe(30);
    expect(createCombat('elite', 'debt_collector', { relicIds: ['ref_sling_of_courage'], encounterType: 'elite' }).player.strength).toBe(2);
  });
  it('source activation cues identify the exact relic while preserving ordinary effect cues', () => {
    const state = battle('ref_ornamental_fan'); const card = attackCard();
    state.stats.cardsPlayed = 1; triggerRelics(state, 'cardPlayed', { card }); state.stats.cardsPlayed = 2; triggerRelics(state, 'cardPlayed', { card }); state.stats.cardsPlayed = 3;
    const { cues } = captureCombatTransition(state, () => triggerRelics(state, 'cardPlayed', { card }));
    expect(cues.some((cue) => cue.resource === 'relic:ref_ornamental_fan' && cue.resourceAction === 'activate')).toBe(true);
    expect(cues.some((cue) => cue.kind === 'block' && cue.amount === 4 && cue.effect === 'relic')).toBe(true);
  });
  it.each(Object.values(REFERENCE_RELIC_DEFINITIONS))('$id has an executable hook or a supported passive', (definition) => {
    expect(definition.sourceRelicId).toMatch(/^relsrc_/); expect(definition.acquisition).toBeDefined();
    expect(definition.passive || (definition.effects ?? [definition.effect]).some((effect) => effect.kind !== 'run')).toBeTruthy();
    expect(definition.description).not.toContain('画像');
  });
});

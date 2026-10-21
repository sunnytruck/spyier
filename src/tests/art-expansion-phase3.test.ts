import { describe, expect, it } from 'vitest';
import catalog from '../data/sourceCards.generated.json';
import { CARD_DEFINITIONS } from '../data/cards';
import { ART_EXPANSION_PHASE3_CARDS } from '../data/artExpansionPhase3Cards';
import { createCombat, getEnemies, getEnemyKey, reduceCombat } from '../engine';
import { getCardPool } from '../engine/cardPools';
import { isNormalAcquisitionCard } from '../engine/cardAcquisition';
import { deserializeGame, serializeGame } from '../engine/persistence';
import { generateCards } from '../engine/combat/resources';
import { getSummonView } from '../engine/combat/resourceView';
import { resolveEffects } from '../engine/effects/resolve';
import { nextRandom } from '../engine/random';
import { getCardRuntimeInfo } from '../presentation/cardRuntime';
import type { CardInstance, ClassId, CombatState } from '../types/game';

const versions = [false, true];
function fixture(cardId: string, upgraded: boolean, multi = false): CombatState {
  const definition = CARD_DEFINITIONS[cardId];
  if (!definition) throw new Error(`Unregistered Phase 3 card: ${cardId}`);
  const classId = definition.classId as ClassId;
  const deck: CardInstance[] = [
    { uid: 'phase3-played', cardId, upgraded },
    ...Array.from({ length: 18 }, (_, index) => ({ uid: `phase3-filler-${index}`, cardId: `${classId}_guard`, upgraded: false })),
  ];
  const state = createCombat('art-phase3-contract', multi ? ['grit_scout', 'candle_moth'] : 'grit_scout', { classId, deck, relicIds: [] });
  state.hand = [{ ...deck[0] }];
  state.drawPile = deck.slice(1).map((card) => ({ ...card }));
  state.discardPile = []; state.exhaustPile = []; state.powers = [];
  state.energy = 30;
  for (const enemy of getEnemies(state)) { enemy.hp = enemy.maxHp = 500; enemy.block = 0; }
  return state;
}
const play = (state: CombatState, targetId?: string) => reduceCombat(state, { type: 'playCard', cardId: 'phase3-played', ...(targetId ? { targetId } : {}) });
const addGuards = (state: CombatState, amount: number) => state.hand.push(...state.drawPile.splice(-amount));
function exhaustGenerated(state: CombatState, cardId: string, amount: number): void {
  const cards = generateCards(state, cardId, amount, 'hand');
  const uids = new Set(cards.map((card) => card.uid));
  state.hand = state.hand.filter((card) => !uids.has(card.uid));
  state.exhaustPile.push(...cards);
}

describe('Phase 3: fifteen new source-backed cards, not alternate names for existing IDs', () => {
  it('registers exactly three distinct cards for each of the five professions', () => {
    expect(ART_EXPANSION_PHASE3_CARDS).toHaveLength(15);
    expect(new Set(ART_EXPANSION_PHASE3_CARDS.map((card) => card.id)).size).toBe(15);
    expect(new Set(ART_EXPANSION_PHASE3_CARDS.map((card) => card.name)).size).toBe(15);
    for (const classId of ['berserker', 'assassin', 'oracle', 'necromancer', 'machinist'])
      expect(ART_EXPANSION_PHASE3_CARDS.filter((card) => card.classId === classId)).toHaveLength(3);
  });
  for (const definition of ART_EXPANSION_PHASE3_CARDS) {
    it(`${definition.id} has one stable source binding and only its own acquisition pool`, () => {
      expect(CARD_DEFINITIONS[definition.id]).toEqual(definition);
      expect(Object.values(CARD_DEFINITIONS).filter((card) => card.sourceCardId === definition.sourceCardId)).toHaveLength(1);
      expect(definition.metadataProvisional).toBe(true);
      expect(isNormalAcquisitionCard(definition)).toBe(true);
      for (const classId of ['berserker', 'assassin', 'oracle', 'necromancer', 'machinist'] as const) {
        expect(getCardPool(classId, 'combat').includes(definition.id)).toBe(classId === definition.classId);
        expect(getCardPool(classId, 'shop').includes(definition.id)).toBe(classId === definition.classId);
      }
    });
    it.each(versions)(`${definition.id} (upgraded=%s) uses the source cost and survives an exact save round trip`, (upgraded) => {
      const source = catalog.cards.find((card) => card.sourceId === definition.sourceCardId)!;
      expect(source).toBeDefined();
      const printed = upgraded ? source.upgraded : source.normal;
      expect(Number(printed.costRaw)).toBe(upgraded ? definition.upgradedCost ?? definition.cost : definition.cost);
      const state = fixture(definition.id, upgraded);
      const before = serializeGame(state);
      const next = play(state);
      expect(next).not.toBe(state);
      expect(next.energy).toBe(30 - Number(printed.costRaw));
      expect(serializeGame(state)).toBe(before);
      const raw = serializeGame(next);
      expect(deserializeGame(raw)).not.toBeNull();
      expect(serializeGame(deserializeGame(raw)!)).toBe(raw);
    });
  }
});

describe.each(versions)('Phase 3 independent battle expectations (upgraded=%s)', (upgraded) => {
  it('molten fist deals its initial vulnerable hit, then doubles only vulnerable and exhausts', () => {
    const state = fixture('berserker_molten_fist', upgraded);
    state.enemy.vulnerable = 2; state.enemy.weak = 3; state.enemy.poison = 4;
    const next = play(state);
    expect(next.enemy.hp).toBe(upgraded ? 479 : 485);
    expect(next.enemy.vulnerable).toBe(4); expect(next.enemy.weak).toBe(3); expect(next.enemy.poison).toBe(4);
    expect(next.exhaustPile.map((card) => card.uid)).toContain('phase3-played');
  });
  it('intimidation uses the selected enemy after adding vulnerable, rather than another enemy', () => {
    const state = fixture('berserker_intimidation', upgraded, true);
    const enemies = getEnemies(state); enemies[0].vulnerable = 20; enemies[1].vulnerable = 2;
    const next = play(state, getEnemyKey(enemies[1]));
    expect(getEnemies(next)[0].vulnerable).toBe(20);
    expect(getEnemies(next)[1].vulnerable).toBe(upgraded ? 4 : 3);
    expect(next.player.strength).toBe(upgraded ? 4 : 3);
    expect(next.exhaustPile).toHaveLength(1);
  });
  it('barricade retains the unconsumed block across successive turns', () => {
    const state = fixture('berserker_barricade', upgraded);
    state.player.block = 30;
    let next = reduceCombat(play(state), { type: 'endTurn' });
    expect(next.player.block).toBe(25); // Scout's first attack is five.
    next = reduceCombat(next, { type: 'endTurn' });
    expect(next.player.block).toBe(25); // The scout defends on its second turn.
    expect(next.powerStacks?.retainBlock).toBe(1);
  });
  it('flechettes counts skills only, calculates modifiers per hit, and consumes block over those hits', () => {
    const state = fixture('assassin_flechettes', upgraded);
    addGuards(state, 2);
    generateCards(state, 'token_knife', 1, 'hand');
    generateCards(state, 'assassin_footwork', 1, 'hand');
    state.player.strength = 2; state.player.weak = 1;
    state.enemy.vulnerable = 1; state.enemy.block = 6;
    const next = play(state);
    expect(500 - next.enemy.hp).toBe(upgraded ? 14 : 8);
    expect(next.enemy.block).toBe(0);
  });
  it('flechettes with no skills makes zero hits, even when the player has strength', () => {
    const state = fixture('assassin_flechettes', upgraded); state.player.strength = 50;
    expect(play(state).enemy.hp).toBe(500);
  });
  it.each([4, 5])('follow-up checks the other hand at resolution and hits every enemy (other cards=%d)', (count) => {
    const state = fixture('assassin_follow_up', upgraded, true); addGuards(state, count);
    const enemies = getEnemies(state); enemies[0].block = 3;
    const amount = (upgraded ? 9 : 7) * (count === 5 ? 2 : 1);
    const next = play(state);
    expect(getEnemies(next).map((enemy) => 500 - enemy.hp)).toEqual([amount - 3, amount]);
  });
  it('blur retains block once without accidentally becoming permanent barricade', () => {
    const state = fixture('assassin_blur', upgraded); state.player.block = 8;
    let next = reduceCombat(play(state), { type: 'endTurn' });
    expect(next.player.block).toBe(upgraded ? 11 : 8);
    next = reduceCombat(next, { type: 'endTurn' });
    expect(next.player.block).toBe(0);
  });
  it('moonlight wave counts earlier skill plays but does not count power or attack cards as skills', () => {
    let state = fixture('oracle_moonlight_wave', upgraded);
    addGuards(state, 2);
    for (const card of state.hand.slice(1)) state = reduceCombat(state, { type: 'playCard', cardId: card.uid });
    const next = play(state);
    expect(next.turnMetrics?.skillsPlayed).toBe(2);
    expect(next.enemy.hp).toBe(upgraded ? 490 : 492);
  });
  it('supermassive counts created inventory even after cards have been discarded or exhausted', () => {
    const state = fixture('oracle_supermassive', upgraded);
    generateCards(state, 'token_soul', 2, 'discardPile'); exhaustGenerated(state, 'token_knife', 1);
    const before = serializeGame(state);
    const preview = getCardRuntimeInfo(state.hand[0], state);
    expect(preview?.facts.some((fact) => fact.amount === (upgraded ? 17 : 14))).toBe(true);
    expect(serializeGame(state)).toBe(before);
    expect(play(state).enemy.hp).toBe(upgraded ? 483 : 486);
  });
  it('knockout awards five stars on the last enemy kill, never on a blocked nonlethal hit', () => {
    const state = fixture('oracle_knockout', upgraded); state.enemy.hp = upgraded ? 38 : 30;
    const before = serializeGame(state);
    const won = play(state);
    expect(won.phase).toBe('victory'); expect(won.classResources?.stars).toBe(5); expect(won.classResources?.starsGainedThisTurn).toBe(5);
    expect(deserializeGame(serializeGame(won))).toEqual(won);
    const blocked = deserializeGame(before)!; blocked.enemy.block = 1;
    const alive = play(blocked);
    expect(alive.enemy.hp).toBe(1); expect(alive.classResources?.stars).toBe(0);
  });
  it('countdown randomly targets one living enemy at the next turn start and is reproducible after reload', () => {
    const state = play(fixture('necromancer_countdown', upgraded, true));
    const index = Math.floor(nextRandom(state.rngState).value * 2);
    const raw = serializeGame(state); const restored = deserializeGame(raw)!;
    const next = reduceCombat(state, { type: 'endTurn' });
    expect(getEnemies(next).map((enemy) => enemy.doom ?? 0)).toEqual(index === 0 ? [upgraded ? 9 : 6, 0] : [0, upgraded ? 9 : 6]);
    expect(reduceCombat(restored, { type: 'endTurn' })).toEqual(next);
  });
  it('bone upgrade buffs separate summon attacks without taking player strength/weak/vulnerable', () => {
    const state = play(fixture('necromancer_bone_upgrade', upgraded));
    resolveEffects(state, [{ type: 'summon', amount: 3 }]);
    state.player.strength = 99; state.player.weak = 2; state.enemy.vulnerable = 2;
    resolveEffects(state, [{ type: 'summonDamage', amount: 5 }]);
    expect(state.enemy.hp).toBe(upgraded ? 489 : 491);
    expect(state.classResources?.ostyHp).toBe(3);
  });
  it('bone-upgraded summon command previews match the HUD and real hit, without changing the save', () => {
    let state = play(fixture('necromancer_bone_upgrade', upgraded));
    const [command] = generateCards(state, 'necromancer_unleash', 1, 'hand', upgraded);
    state.player.strength = 99; state.player.weak = 2;
    state.enemy.vulnerable = 2; state.enemy.block = 3;
    const absent = getCardRuntimeInfo(command, state);
    expect(absent?.facts.find((fact) => fact.key.endsWith(':summonDamage'))?.amount).toBe(0);
    expect(getSummonView(state).commands.find((entry) => entry.cardUid === command.uid)?.amount).toBe(0);
    resolveEffects(state, [{ type: 'summon', amount: 3 }]);
    const saved = serializeGame(state);
    const expectedBeforeBlock = upgraded ? 18 : 13; // command 9/6 + HP 3 + bone 6/4
    const preview = getCardRuntimeInfo(command, state);
    expect(preview?.facts.find((fact) => fact.key.endsWith(':summonDamage'))?.amount).toBe(expectedBeforeBlock);
    expect(getSummonView(state).commands.find((entry) => entry.cardUid === command.uid)?.amount).toBe(expectedBeforeBlock);
    expect(serializeGame(state)).toBe(saved);
    state = reduceCombat(state, { type: 'playCard', cardId: command.uid });
    expect(500 - state.enemy.hp).toBe(expectedBeforeBlock - 3);
    expect(deserializeGame(serializeGame(state))).toEqual(state);
  });
  it('intimidation preview reads the selected enemy after its own vulnerable application', () => {
    const state = fixture('berserker_intimidation', upgraded, true);
    const enemies = getEnemies(state); enemies[0].vulnerable = 20; enemies[1].vulnerable = 2;
    state.selectedEnemyId = getEnemyKey(enemies[1]);
    const before = serializeGame(state);
    const expected = upgraded ? 4 : 3;
    const preview = getCardRuntimeInfo(state.hand[0], state);
    expect(preview?.facts.some((fact) => fact.summary.includes('筋力') && fact.amount === expected)).toBe(true);
    expect(serializeGame(state)).toBe(before);
    expect(play(state).player.strength).toBe(expected);
  });
  it('a lethal-card preview shows a conditional reward without granting live stars or advancing RNG', () => {
    const state = fixture('oracle_knockout', upgraded); state.enemy.hp = 1;
    const before = serializeGame(state);
    const preview = getCardRuntimeInfo(state.hand[0], state);
    expect(preview?.facts.some((fact) => fact.detail.includes('倒した敵ごとに星＋5'))).toBe(true);
    expect(state.classResources?.stars).toBe(0);
    expect(serializeGame(state)).toBe(before);
    expect(play(state).classResources?.stars).toBe(5);
  });
  it('soul storm counts only exhausted souls, not discarded souls or other exhausted tokens', () => {
    const state = fixture('necromancer_soul_storm', upgraded);
    exhaustGenerated(state, 'token_soul', 2); exhaustGenerated(state, 'token_knife', 1);
    generateCards(state, 'token_soul', 3, 'discardPile');
    state.player.strength = 1; state.enemy.vulnerable = 1;
    expect(play(state).enemy.hp).toBe(upgraded ? 476 : 479);
  });
  it('subroutine starts after being played and grants energy to later powers only', () => {
    let state = play(fixture('machinist_subroutine', upgraded));
    expect(state.energy).toBe(upgraded ? 30 : 29);
    const [power] = generateCards(state, 'machinist_capacitor', 1, 'hand');
    state = reduceCombat(state, { type: 'playCard', cardId: power.uid });
    expect(state.energy).toBe(upgraded ? 30 : 29); // cost 1, gain 1
    expect(state.orbSlotBonus).toBe(2);
    const [skill] = generateCards(state, 'machinist_guard', 1, 'hand');
    state = reduceCombat(state, { type: 'playCard', cardId: skill.uid });
    expect(state.energy).toBe(upgraded ? 29 : 28);
  });
  it('storm triggers on a subsequent power, producing the printed number of lightning orbs', () => {
    let state = play(fixture('machinist_storm', upgraded));
    expect(state.classResources?.orbs).toEqual([]);
    const [power] = generateCards(state, 'machinist_capacitor', 1, 'hand');
    state = reduceCombat(state, { type: 'playCard', cardId: power.uid });
    expect(state.classResources?.orbs).toEqual(upgraded ? ['lightning', 'lightning'] : ['lightning']);
  });
  it('loop activates only the rightmost frost at the start and keeps the ordered orb inventory', () => {
    const state = play(fixture('machinist_loop', upgraded));
    state.classResources!.orbs = ['lightning', 'frost']; state.classResources!.focus = 1;
    const next = reduceCombat(state, { type: 'endTurn' });
    expect(next.player.block).toBe(upgraded ? 6 : 3);
    expect(next.enemy.hp).toBe(496);
    expect(next.classResources?.orbs).toEqual(['lightning', 'frost']);
  });
  it('loop with lightning at the right end adds its passive attacks without evoking either orb', () => {
    const state = play(fixture('machinist_loop', upgraded));
    state.classResources!.orbs = ['frost', 'lightning']; state.classResources!.focus = 1;
    const next = reduceCombat(state, { type: 'endTurn' });
    expect(next.enemy.hp).toBe(upgraded ? 488 : 492);
    expect(next.player.block).toBe(0);
    expect(next.classResources?.orbs).toEqual(['frost', 'lightning']);
  });
  it('a lethal turn-start loop stops before opening draws and preserves the remaining card inventory', () => {
    const state = play(fixture('machinist_loop', upgraded));
    state.classResources!.orbs = ['lightning'];
    state.enemy.hp = 6; // end-turn passive leaves 3 HP; the first start-turn passive is lethal
    const pile = state.drawPile.map((card) => card.uid);
    const next = reduceCombat(state, { type: 'endTurn' });
    expect(next.phase).toBe('victory');
    expect(next.hand).toHaveLength(0);
    expect(next.drawPile.map((card) => card.uid)).toEqual(pile);
    expect(next.turnMetrics?.drawn).toBe(0);
    expect(deserializeGame(serializeGame(next))).toEqual(next);
  });
});

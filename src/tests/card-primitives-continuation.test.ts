import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import { createCombat, getEnemies, getEnemyKey, reduceCombat } from '../engine';
import { isNormalAcquisitionCard } from '../engine/cardAcquisition';
import { channelOrbs, orbSlotCount, resources } from '../engine/combat/resources';
import { combatValue, scaledEffectAmount } from '../engine/combat/values';
import { resolveEffects } from '../engine/effects/resolve';
import { deserializeGame, serializeGame } from '../engine/persistence';
import { captureCombatTransition } from '../presentation/trace';
import type { CardInstance, ClassId, CombatState } from '../types/game';

function fixture(cardId = 'stone_strike', multiple = false): CombatState {
  const definition = CARD_DEFINITIONS[cardId];
  const classId = definition.classId && definition.classId !== 'colorless' ? definition.classId as ClassId : undefined;
  const source: CardInstance = { uid: 'primitive-source', cardId, upgraded: false };
  const filler = Array.from({ length: 24 }, (_, index) => ({ uid: `primitive-${index}`, cardId: 'still_guard', upgraded: false }));
  const state = createCombat('card-primitive-continuation', multiple ? ['grit_scout', 'candle_moth'] : 'grit_scout', {
    classId, deck: [source, ...filler], relicIds: [],
  });
  state.hand = [source, ...filler.slice(0, 4)];
  state.discardPile = filler.slice(4, 12);
  state.drawPile = filler.slice(12);
  state.exhaustPile = [];
  state.energy = 20;
  resources(state);
  for (const enemy of getEnemies(state)) {
    enemy.hp = enemy.maxHp = 1000;
    enemy.intent = { kind: 'attack', label: '空振り', description: '0ダメージ。', damage: 0 };
  }
  return state;
}

const play = (state: CombatState) => reduceCombat(state, { type: 'playCard', cardId: 'primitive-source' });
const load = (state: CombatState) => deserializeGame(serializeGame(state))!;

describe('new composable card primitives', () => {
  it('temporary dexterity survives loading, increases card block, and removes only its own delta', () => {
    const state = fixture('assassin_anticipation');
    state.dexterity = 4;
    const active = play(state);
    expect(active.dexterity).toBe(6);
    resolveEffects(active, [{ type: 'dexterity', amount: 1 }]);
    const restored = load(active);
    expect(restored).toEqual(active);
    const guarded = reduceCombat(restored, { type: 'playCard', cardId: 'primitive-0' });
    expect(guarded.player.block).toBe(15);
    const next = reduceCombat(load(guarded), { type: 'endTurn' });
    expect(next.dexterity).toBe(5);
    expect(next.turnModifiers).toBeUndefined();
    expect(reduceCombat(load(next), { type: 'endTurn' }).dexterity).toBe(5);
  });

  it('vigor applies to every hit of the next attack, is not spent by a skill, and is consumed once', () => {
    const state = fixture('berserker_twin');
    resolveEffects(state, [{ type: 'vigor', amount: 4 }]);
    const guarded = reduceCombat(state, { type: 'playCard', cardId: 'primitive-0' });
    expect(guarded.vigor).toBe(4);
    const attacked = play(guarded);
    expect(attacked.enemy.hp).toBe(982);
    expect(attacked.vigor).toBe(0);
    expect(load(attacked)).toEqual(attacked);
  });

  it('plate blocks at end of turn and loses stacks per unblocked enemy attack hit', () => {
    const state = fixture('berserker_stone_armor');
    const active = play(state);
    expect(active.plate).toBe(4);
    active.enemy.intent = { kind: 'attack', label: '三連打', description: '3×3。', damage: 3, hits: 3 };
    const next = reduceCombat(load(active), { type: 'endTurn' });
    expect(next.player.hp).toBe(75);
    expect(next.plate).toBe(2);
    expect(load(next)).toEqual(next);
  });

  it('random upgrades sample only eligible instances in the authored zone without replacement', () => {
    const state = fixture();
    state.discardPile[0].upgraded = true;
    state.deck.find((card) => card.uid === state.discardPile[0].uid)!.upgraded = true;
    const curse: CardInstance = { uid: 'primitive-curse', cardId: 'stone_doubt', upgraded: false };
    state.deck.push({ ...curse }); state.discardPile.push(curse);
    const eligible = state.discardPile.filter((card) => !card.upgraded && card.cardId !== 'stone_doubt').map((card) => card.uid);
    const beforeOtherZones = JSON.stringify([state.hand, state.drawPile, state.exhaustPile]);
    const repeated = structuredClone(state);
    for (const battle of [state, repeated]) resolveEffects(battle, [{ type: 'upgradeRandom', from: 'discardPile', amount: 50 }]);
    expect(state).toEqual(repeated);
    expect(state.temporaryUpgrades?.sort()).toEqual(eligible.sort());
    expect(state.discardPile.find((card) => card.cardId === 'stone_doubt')!.upgraded).toBe(false);
    expect(JSON.stringify([state.hand, state.drawPile, state.exhaustPile])).toBe(beforeOtherZones);
    expect(state.deck.filter((card) => eligible.includes(card.uid)).every((card) => card.upgraded)).toBe(true);
    expect(load(state)).toEqual(state);
  });

  it('random upgrades with no eligible cards neither consume RNG nor create upgrade records', () => {
    const state = fixture();
    state.discardPile.forEach((card) => { card.upgraded = true; });
    const before = structuredClone(state);
    resolveEffects(state, [{ type: 'upgradeRandom', from: 'discardPile', amount: 3 }]);
    expect(state).toEqual(before);
  });

  it.each([undefined, 'oracle'] as const)('random colorless generation excludes blessing and token pools for class %s and preserves hand capacity', (classId) => {
    const state = fixture();
    state.classId = classId;
    const repeated = structuredClone(state);
    for (const battle of [state, repeated]) resolveEffects(battle, [{ type: 'generateRandom', pool: 'colorless', amount: 60, destination: 'hand', upgraded: true }]);
    expect(state).toEqual(repeated);
    expect(state.generatedCards).toHaveLength(60);
    expect(state.generatedCards!.every((card) => card.upgraded)).toBe(true);
    for (const card of state.generatedCards!) {
      const definition = CARD_DEFINITIONS[card.cardId];
      expect(definition.classId).toBe('colorless');
      expect(isNormalAcquisitionCard(definition)).toBe(true);
    }
    expect(state.hand).toHaveLength(50);
    expect(state.discardPile).toHaveLength(23);
    expect(load(state)).toEqual(state);
  });

  it('raw enemy HP loss ignores block and attack modifiers, targets only the selected enemy, and handles lethal damage', () => {
    const state = fixture('stone_strike', true);
    const target = getEnemies(state)[1];
    target.block = 90; target.vulnerable = 5;
    state.player.strength = 70; state.player.weak = 4; state.vigor = 100;
    const captured = captureCombatTransition(state, () => resolveEffects(state, [{ type: 'loseEnemyHp', amount: 3 }], undefined, { targetId: getEnemyKey(target) }));
    expect(getEnemies(state).map((enemy) => enemy.hp)).toEqual([1000, 997]);
    expect(target.block).toBe(90);
    expect(state.vigor).toBe(100);
    expect(captured.cues.find((cue) => cue.kind === 'impact')).toMatchObject({ amount: 3, targetId: getEnemyKey(target) });
    resolveEffects(state, [{ type: 'loseEnemyHp', amount: 997 }], undefined, { targetId: getEnemyKey(target) });
    expect(target.hp).toBe(0);
    expect(state.phase).toBe('player');
    resolveEffects(state, [{ type: 'loseEnemyHp', amount: 1000 }]);
    expect(state.phase).toBe('victory');
    expect(state.stats.damageDealt).toBe(2000);
  });

  it('draw-pile exhaust choices survive reload and resume settlement once', () => {
    const active = play(fixture('necromancer_purification'));
    expect(active.pendingChoice).toMatchObject({ mode: 'exhaust', sourceZone: 'drawPile', amount: 1 });
    const selected = active.drawPile[1].uid;
    const restored = load(active);
    expect(restored).toEqual(active);
    const action = { type: 'chooseCards' as const, cardIds: [selected] };
    const after = reduceCombat(restored, action);
    expect(after.pendingChoice).toBeUndefined();
    expect(after.exhaustPile.map((card) => card.uid)).toEqual([selected]);
    expect(after.drawPile.some((card) => card.uid === selected)).toBe(false);
    expect(after.classResources!.ostyHp).toBe(3);
    expect(after.discardPile.some((card) => card.uid === 'primitive-source')).toBe(true);
    expect(load(after)).toEqual(after);
    expect(reduceCombat(after, action)).toBe(after);
    expect(reduceCombat(load(after), action)).toEqual(after);
  });

  it.each([[0, 10], [9, 10], [10, 15], [19, 15], [20, 20]])('grouped scaling uses complete groups before multiplication: doom %i => added %i', (doom, added) => {
    const state = fixture(); state.enemy.doom = doom;
    const effect = { type: 'doom' as const, amount: 10, bonusPer: { value: 'enemyDoom' as const, multiplier: 5, divisor: 10 } };
    expect(scaledEffectAmount(state, effect, state.enemy)).toBe(added);
    resolveEffects(state, [effect]);
    expect(state.enemy.doom).toBe(doom + added);
  });

  it('debuff-kind scaling counts negative strength and stun once each, independent of their magnitudes', () => {
    const state = fixture();
    state.enemy.weak = 2; state.enemy.vulnerable = 3; state.enemy.poison = 40;
    state.enemy.doom = 70; state.enemy.stun = 4; state.enemy.strength = -9;
    expect(combatValue(state, 'enemyDebuffs')).toBe(6);
    state.enemy.strength = 9; state.enemy.stun = 0;
    expect(combatValue(state, 'enemyDebuffs')).toBe(4);
  });

  it('orb slots persist, accept generated orbs beyond the original capacity, and keep the existing rightmost overflow rule', () => {
    const state = fixture();
    state.classResources!.orbs = ['frost', 'lightning', 'frost'];
    resolveEffects(state, [{ type: 'orbSlots', amount: 2 }]);
    expect(orbSlotCount(state)).toBe(5);
    channelOrbs(state, 'lightning', 2);
    expect(state.classResources!.orbs).toEqual(['frost', 'lightning', 'frost', 'lightning', 'lightning']);
    expect(state.enemy.hp).toBe(1000);
    channelOrbs(state, 'frost', 1);
    expect(state.classResources!.orbs).toEqual(['frost', 'lightning', 'frost', 'lightning', 'frost']);
    expect(state.enemy.hp).toBe(992);
    expect(load(state)).toEqual(state);
  });

  it('selected lightning passive activation preserves all orbs, ignores frost, and receives focus without attack modifiers', () => {
    const state = fixture('stone_strike', true);
    state.classResources!.orbs = ['lightning', 'frost', 'lightning'];
    state.classResources!.focus = 2;
    state.player.strength = 50; state.player.weak = 10;
    const target = getEnemies(state)[1]; target.vulnerable = 8;
    const rng = state.rngState;
    resolveEffects(state, [{ type: 'passiveOrbs', orb: 'lightning', target: 'selected' }], undefined, { targetId: getEnemyKey(target) });
    expect(getEnemies(state).map((enemy) => enemy.hp)).toEqual([1000, 990]);
    expect(state.player.block).toBe(0);
    expect(state.classResources!.orbs).toEqual(['lightning', 'frost', 'lightning']);
    expect(state.rngState).toBe(rng);
    expect(load(state)).toEqual(state);
  });

  it.each([3, 4])('targeted orb activation never retargets after its chosen enemy dies at HP %i', (hp) => {
    const state = fixture('machinist_tesla_coil', true);
    const target = getEnemies(state)[1]; target.hp = hp;
    state.selectedEnemyId = getEnemyKey(target);
    state.classResources!.orbs = ['lightning', 'lightning'];
    const result = play(state);
    expect(getEnemies(result).map((enemy) => enemy.hp)).toEqual([1000, 0]);
    expect(result.classResources!.orbs).toEqual(['lightning', 'lightning']);
    expect(result.rngState).toBe(state.rngState);
    expect(load(result)).toEqual(result);
  });
});

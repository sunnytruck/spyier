import { describe, expect, it } from 'vitest';
import { createCombat, getEnemies, reduceCombat } from '../engine';
import { deserializeGame, serializeGame } from '../engine/persistence';
import { channelOrbs, evokeOrb, nextOrbEvokeIndex, orbEffectValue, orbSlotCount, triggerPassiveOrbs } from '../engine/combat/resources';
import { getEnemyResourceView, getHealthSpendView, getKnifeView, getOrbView, getStarView, getSummonView } from '../engine/combat/resourceView';
import { captureCombatTransition } from '../presentation/trace';
import type { CardInstance, ClassId, CombatState, OrbType } from '../types/game';

function fixture(cardId = 'machinist_zap', classId: ClassId = 'machinist', upgraded = false): CombatState {
  const card: CardInstance = { uid: 'chosen', cardId, upgraded };
  const state = createCombat('read-only-resource-views', ['grit_scout', 'candle_moth'], { deck: [card], classId });
  state.hand = [card];
  state.energy = 10;
  for (const enemy of getEnemies(state)) {
    enemy.hp = enemy.maxHp = 1000;
    enemy.block = 0;
  }
  return state;
}

describe('canonical orb rules and permanently visible slots', () => {
  it('shows three empty slots without adding class resources to a legacy save', () => {
    const state = createCombat('legacy-resource-display');
    const before = serializeGame(state);
    expect(getOrbView(state)).toEqual({
      count: 0, capacity: 3, focus: 0, temporaryFocus: 0, nextEvokeIndex: null,
      slots: Array.from({ length: 3 }, (_, index) => ({ index, type: null, passive: 0, evoke: 0, isNextEvoke: false })),
    });
    expect(nextOrbEvokeIndex([])).toBeNull();
    expect(orbSlotCount()).toBe(3);
    expect(serializeGame(state)).toBe(before);
    expect(state.classResources).toBeUndefined();
  });

  it.each([-20, -8, -3, -2, 0, 2, 7])('focus %s displays exactly the passive and evoke amounts the engine resolves', (focus) => {
    const state = fixture();
    state.classResources!.focus = focus;
    state.classResources!.orbs = ['frost', 'lightning'];
    const view = getOrbView(state);
    const passive = structuredClone(state);
    triggerPassiveOrbs(passive);
    expect(passive.player.block).toBe(view.slots[0].passive);
    expect(state.enemy.hp + getEnemies(state)[1].hp - getEnemies(passive).reduce((sum, enemy) => sum + enemy.hp, 0)).toBe(view.slots[1].passive);
    expect(view.slots.map((slot) => slot.isNextEvoke)).toEqual([false, true, false]);
    const evoked = structuredClone(state);
    evokeOrb(evoked, 2);
    expect(getEnemies(evoked).reduce((sum, enemy) => sum + enemy.hp, 0)).toBe(2000 - view.slots[1].evoke * 2);
    expect(evoked.classResources!.orbs).toEqual(['frost']);
    expect(orbEffectValue('frost', 'passive', focus)).toBe(view.slots[0].passive);
    expect(orbEffectValue('lightning', 'evoke', focus)).toBe(view.slots[1].evoke);
  });

  it.each([
    ['lightning', 'frost', 'lightning'],
    ['frost', 'lightning', 'frost'],
  ] as OrbType[][])('overflow releases the existing rightmost slot, leaving the first two in place: %j', (...orbs) => {
    const state = fixture();
    state.classResources!.orbs = orbs;
    const { cues } = captureCombatTransition(state, () => channelOrbs(state, 'frost', 1));
    expect(state.classResources!.orbs).toEqual([orbs[0], orbs[1], 'frost']);
    expect(cues.filter((cue) => cue.kind === 'resource').map((cue) => [cue.resourceAction, cue.orbMode, cue.orbIndex, cue.targetId])).toEqual([
      ['remove', 'evoke', 2, 'orb-2'],
      ['activate', 'evoke', 2, 'orb-2'],
      ['channel', 'channel', 2, 'orb-2'],
    ]);
    expect(getOrbView(state).nextEvokeIndex).toBe(2);
  });

  it('each passive has its own source index, including an inert frost orb at negative focus', () => {
    const state = fixture();
    state.classResources!.focus = -8;
    state.classResources!.orbs = ['lightning', 'frost', 'frost'];
    const { cues } = captureCombatTransition(state, () => triggerPassiveOrbs(state));
    const activations = cues.filter((cue) => cue.kind === 'resource');
    expect(activations.map((cue) => [cue.orbIndex, cue.orbMode, cue.sourceId, cue.amount])).toEqual([
      [0, 'passive', 'orb-0', 0], [1, 'passive', 'orb-1', 0], [2, 'passive', 'orb-2', 0],
    ]);
    expect(cues.filter((cue) => cue.kind === 'block')).toHaveLength(0);
    expect(cues.filter((cue) => cue.kind === 'impact')).toEqual([expect.objectContaining({ sourceId: 'orb-0', amount: 0, orbIndex: 0, orbMode: 'passive' })]);
    expect(state.player.block).toBe(0);
    expect(getEnemies(state).map((enemy) => enemy.hp)).toEqual([1000, 1000]);
  });

  it('repeated release keeps the popped orb index and emits one removal rather than consuming two slots', () => {
    const state = fixture();
    state.classResources!.orbs = ['lightning', 'frost'];
    const { cues } = captureCombatTransition(state, () => evokeOrb(state, 2));
    expect(cues.filter((cue) => cue.resourceAction === 'remove')).toHaveLength(1);
    expect(cues.filter((cue) => cue.kind === 'block').map((cue) => [cue.sourceId, cue.orbIndex, cue.amount])).toEqual([
      ['orb-1', 1, 5], ['orb-1', 1, 5],
    ]);
    expect(state.classResources!.orbs).toEqual(['lightning']);
    expect(state.player.block).toBe(10);
  });

  it('does not invent lightning activations or consume RNG when no enemy can be hit', () => {
    const state = fixture();
    getEnemies(state).forEach((enemy) => { enemy.hp = 0; });
    state.classResources!.orbs = ['lightning'];
    const rng = state.rngState;
    const { cues } = captureCombatTransition(state, () => triggerPassiveOrbs(state));
    expect(cues).toHaveLength(0);
    expect(state.rngState).toBe(rng);
  });
});

describe('resource projections use the existing battle rules', () => {
  it.each([false, true])('summon commands use current summon HP, not player attack modifiers (upgraded=%s)', (upgraded) => {
    const state = fixture('necromancer_unleash', 'necromancer', upgraded);
    state.classResources!.ostyHp = 7;
    state.player.strength = 100;
    state.player.weak = 2;
    state.enemy.vulnerable = 2;
    const before = getSummonView(state);
    expect(before).toMatchObject({ hp: 7, active: true, automaticAttack: false });
    expect(before.commands[0].amount).toBe((upgraded ? 9 : 6) + 7);
    const { result, cues } = captureCombatTransition(state, () => reduceCombat(state, { type: 'playCard', cardId: 'chosen' }));
    expect(state.enemy.hp - result.enemy.hp).toBe(before.commands[0].amount);
    expect(cues).toContainEqual(expect.objectContaining({ kind: 'attack', sourceId: 'osty', amount: before.commands[0].amount }));
    state.classResources!.ostyHp = 0;
    expect(getSummonView(state).commands[0].amount).toBe(0);
    expect(reduceCombat(state, { type: 'playCard', cardId: 'chosen' }).enemy.hp).toBe(state.enemy.hp);
  });

  it('shows exact star-burst input and sword cost without spending or fabricating star costs', () => {
    const state = fixture('oracle_star_burst', 'oracle');
    state.classResources!.stars = 17;
    state.classResources!.starsGainedThisTurn = 2;
    state.classResources!.forge = 8;
    const before = getStarView(state);
    expect(before).toMatchObject({ stars: 17, gainedThisTurn: 2, forge: 8, consumesStars: false });
    expect(before.sword).toMatchObject({ generated: false, cost: 2, baseDamage: 10, forgedBaseDamage: 18 });
    expect(before.burstCards[0]).toMatchObject({ factor: 3, baseDamage: 6, damagePerHit: 6 });
    const after = reduceCombat(state, { type: 'playCard', cardId: 'chosen' });
    expect(state.enemy.hp - after.enemy.hp).toBe(before.burstCards[0].damagePerHit);
    expect(after.classResources!.stars).toBe(17);
    state.classResources!.starsGainedThisTurn = 0;
    state.player.strength = 99;
    expect(getStarView(state).burstCards[0].damagePerHit).toBe(0);
    expect(reduceCombat(state, { type: 'playCard', cardId: 'chosen' }).enemy.hp).toBe(state.enemy.hp);
  });

  it.each([false, true])('a generated sword uses the actual normal/upgrade cost and shared forge damage (upgraded=%s)', (upgraded) => {
    const state = fixture('token_sword', 'oracle', upgraded);
    state.classResources!.forge = 13;
    state.player.strength = 3;
    state.player.weak = 1;
    state.enemy.vulnerable = 1;
    const view = getStarView(state).sword;
    expect(view).toMatchObject({ generated: true, cost: upgraded ? 1 : 2, forgedBaseDamage: 23 });
    const after = reduceCombat(state, { type: 'playCard', cardId: 'chosen' });
    expect(after.energy).toBe(state.energy - view.cost);
    expect(state.enemy.hp - after.enemy.hp).toBe(view.damagePerHit);
  });

  it('the sword stays present with its actual upgrade during the played-card frame outside all piles', () => {
    const state = fixture('token_sword', 'oracle', true);
    const captured = captureCombatTransition(state, () => reduceCombat(state, { type: 'playCard', cardId: 'chosen' }));
    const frame = captured.cues.find((cue) => cue.kind === 'cardPlay')!.frame;
    expect(frame.hand).toHaveLength(0);
    expect(frame.discardPile).toHaveLength(0);
    expect(getStarView(frame).sword).toMatchObject({ generated: true, cost: 1, card: { uid: 'chosen', upgraded: true } });
  });

  it.each([
    { hp: 10, poison: 3, doom: 7, poisonDamage: 3, hpAfterPoison: 7, doomTriggers: true, willAct: false },
    { hp: 10, poison: 3, doom: 6, poisonDamage: 3, hpAfterPoison: 7, doomTriggers: false, willAct: true },
    { hp: 3, poison: 8, doom: 99, poisonDamage: 3, hpAfterPoison: 0, doomTriggers: false, willAct: false },
    { hp: 0, poison: 8, doom: 99, poisonDamage: 0, hpAfterPoison: 0, doomTriggers: false, willAct: false },
  ])('poison then doom: $hp HP / $poison poison / $doom doom', (expected) => {
    const state = fixture();
    Object.assign(state.enemy, { hp: expected.hp, poison: expected.poison, doom: expected.doom, block: 500 });
    expect(getEnemyResourceView(state.enemy)).toMatchObject({
      poison: expected.poison, doom: expected.doom, poisonDamage: expected.poisonDamage,
      hpAfterPoison: expected.hpAfterPoison, doomTriggers: expected.doomTriggers, willAct: expected.willAct,
    });
    const after = reduceCombat(state, { type: 'endTurn' });
    expect(after.enemy.hp).toBe(expected.doomTriggers ? 0 : expected.hpAfterPoison);
  });

  it('knife bonuses, current hand count and direct HP costs come from actual effects', () => {
    const state = fixture('token_knife', 'assassin');
    state.powerStacks = { knifeDamage: 3 };
    state.player.strength = 2;
    const knife = getKnifeView(state);
    expect(knife).toMatchObject({ bonusDamage: 3, cardsInHand: 1, baseDamage: 7, damagePerHit: 9 });
    expect(state.enemy.hp - reduceCombat(state, { type: 'playCard', cardId: 'chosen' }).enemy.hp).toBe(knife.damagePerHit);
    const offering = { uid: 'offering', cardId: 'berserker_offering', upgraded: true };
    expect(getHealthSpendView(state, offering)).toEqual({ amount: 6, lethal: false });
    state.player.hp = 6;
    expect(getHealthSpendView(state, offering)).toEqual({ amount: 6, lethal: true });
    expect(getHealthSpendView(state, state.hand[0])).toEqual({ amount: 0, lethal: false });
  });

  it('all selectors preserve exact state/RNG/save bytes and can restore their projections after loading', () => {
    const state = fixture('oracle_star_burst', 'oracle');
    Object.assign(state.classResources!, { stars: 11, starsGainedThisTurn: 3, forge: 15, ostyHp: 9, focus: -2, temporaryFocus: 1, orbs: ['frost', 'lightning'] });
    const before = serializeGame(state);
    const projections = () => [getOrbView(state), getSummonView(state), getStarView(state), getKnifeView(state), getEnemyResourceView(state.enemy), getHealthSpendView(state, state.hand[0])];
    const views = projections();
    expect(serializeGame(state)).toBe(before);
    // Returned card copies can be rendered/modified locally without changing the saved instance.
    getStarView(state).sword.card.upgraded = true;
    expect(projections()).toEqual(views);
    const restored = deserializeGame(before)!;
    expect(restored).not.toBeNull();
    expect(getOrbView(restored)).toEqual(getOrbView(state));
    expect(getStarView(restored)).toEqual(getStarView(state));
    expect(getSummonView(restored)).toEqual(getSummonView(state));
    const captured = captureCombatTransition(state, () => reduceCombat(state, { type: 'endTurn' }));
    const plain = reduceCombat(state, { type: 'endTurn' });
    expect(serializeGame(captured.result)).toBe(serializeGame(plain));
    expect(captured.result.rngState).toBe(plain.rngState);
    expect(serializeGame(state)).toBe(before);
  });
});

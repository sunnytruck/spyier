import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import { CONTINUATION_ARCANE_CARDS } from '../data/continuationArcaneCards';
import source from '../data/sourceCards.generated.json';
import { canPlayCard, createCombat, getEnemies, getEnemyKey, reduceCombat } from '../engine';
import { getCardPool } from '../engine/cardPools';
import { getOrbView } from '../engine/combat/resourceView';
import { deserializeGame, serializeGame } from '../engine/persistence';
import { getCardRuntimeInfo } from '../presentation/cardRuntime';
import { cardTargetMode } from '../presentation/targeting';
import type { CardInstance, ClassId, CombatState } from '../types/game';

const PLAYED_UID = 'arcane-continuation-played';
function fixture(id: string, upgraded = false, multiple = false): CombatState {
  const card: CardInstance = { uid: PLAYED_UID, cardId: id, upgraded };
  const fillers = Array.from({ length: 60 }, (_, index): CardInstance => ({ uid: `arcane-filler-${index}`, cardId: 'still_guard', upgraded: false }));
  const state = createCombat('arcane-continuation', multiple ? ['grit_scout', 'grit_scout'] : 'grit_scout', {
    classId: CARD_DEFINITIONS[id].classId === 'colorless' ? 'machinist' : CARD_DEFINITIONS[id].classId as ClassId,
    relicIds: [], deck: [card, ...fillers],
  });
  state.hand = [card, ...fillers.slice(0, 4)];
  state.drawPile = fillers.slice(4);
  state.discardPile = [];
  state.exhaustPile = [];
  state.energy = 10;
  state.jitto = 0;
  state.player.block = 0;
  state.player.strength = 0;
  state.classResources!.orbs = [];
  state.classResources!.focus = 0;
  for (const enemy of getEnemies(state)) {
    Object.assign(enemy, { hp: 2000, maxHp: 2000, block: 0, strength: 0, weak: 0, vulnerable: 0, poison: 0, doom: 0 });
    enemy.intent = { kind: 'defend', label: '静観', description: '検証用の静観。', block: 0 };
  }
  return state;
}
const play = (state: CombatState, uid = PLAYED_UID) => reduceCombat(state, { type: 'playCard', cardId: uid });
function idleTurn(state: CombatState): CombatState {
  for (const enemy of getEnemies(state)) enemy.intent = { kind: 'defend', label: '静観', description: '検証用の静観。', block: 0 };
  return reduceCombat(state, { type: 'endTurn' });
}
function restore(state: CombatState): CombatState {
  const restored = deserializeGame(serializeGame(state));
  expect(restored).toEqual(state);
  return restored!;
}

describe('source-backed machinist and colorless continuation', () => {
  it('registers 16 unique cards, with six machinist cards and ten colorless cards', () => {
    expect(CONTINUATION_ARCANE_CARDS).toHaveLength(16);
    expect(CONTINUATION_ARCANE_CARDS.filter((card) => card.classId === 'machinist')).toHaveLength(6);
    expect(CONTINUATION_ARCANE_CARDS.filter((card) => card.classId === 'colorless')).toHaveLength(10);
    expect(new Set(CONTINUATION_ARCANE_CARDS.map((card) => card.id)).size).toBe(16);
    expect(new Set(CONTINUATION_ARCANE_CARDS.map((card) => card.sourceCardId)).size).toBe(16);
  });

  it.each(CONTINUATION_ARCANE_CARDS)('$id preserves source costs and one stable source mapping', (card) => {
    expect(CARD_DEFINITIONS[card.id]).toBe(card);
    expect(Object.values(CARD_DEFINITIONS).filter((entry) => entry.sourceCardId === card.sourceCardId)).toHaveLength(1);
    const reference = source.cards.find((entry) => entry.id === card.sourceCardId)!;
    expect(reference).toBeDefined();
    expect(reference.sourceClass).toBe(card.classId);
    expect(card.cost).toBe(reference.normal.costRaw === 'X' ? 0 : Number(reference.normal.costRaw));
    expect(card.upgradedCost).toBe(reference.upgraded.costRaw === 'X' ? 0 : Number(reference.upgraded.costRaw));
    expect(card.xCost).toBe(reference.normal.costRaw === 'X');
    expect(card.metadataProvisional).toBe(true);
    for (const classId of ['berserker', 'assassin', 'oracle', 'necromancer', 'machinist'] as const) {
      expect(getCardPool(classId, 'combat').includes(card.id)).toBe(card.classId === classId);
      expect(getCardPool(classId, 'shop').includes(card.id)).toBe(card.classId === 'colorless' || card.classId === classId);
      expect(getCardPool(classId, 'event').includes(card.id)).toBe(card.classId === 'colorless' || card.classId === classId);
    }
  });

  it.each(CONTINUATION_ARCANE_CARDS)('$id restores both variants and charges the printed energy exactly once', (card) => {
    for (const upgraded of [false, true]) {
      const initial = fixture(card.id, upgraded);
      const before = structuredClone(initial);
      const after = play(restore(initial));
      expect(initial).toEqual(before);
      expect(after.energy).toBe(card.xCost ? 0 : 10 - (upgraded ? card.upgradedCost! : card.cost));
      expect(play(after)).toBe(after);
      restore(after);
      if (after.pendingChoice) {
        const choice = after.pendingChoice;
        const selected = after[choice.sourceZone ?? 'hand'].slice(0, choice.amount).map((held) => held.uid);
        const action = { type: 'chooseCards' as const, cardIds: selected };
        const continued = reduceCombat(after, action);
        expect(reduceCombat(restore(after), action)).toEqual(continued);
        restore(continued);
      }
      if (!card.xCost && (upgraded ? card.upgradedCost! : card.cost) > 0) {
        const poor = fixture(card.id, upgraded);
        poor.energy = (upgraded ? card.upgradedCost! : card.cost) - 1;
        expect(canPlayCard(poor, PLAYED_UID)).toBe(false);
        expect(play(poor)).toBe(poor);
      }
    }
  });

  it.each(CONTINUATION_ARCANE_CARDS)('$id has read-only runtime facts for both variants', (card) => {
    for (const upgraded of [false, true]) {
      const state = fixture(card.id, upgraded);
      const before = structuredClone(state);
      const info = getCardRuntimeInfo(state.hand[0], state);
      expect(info?.facts.length).toBeGreaterThan(0);
      expect(state).toEqual(before);
      expect(getCardRuntimeInfo(state.hand[0], state)).toEqual(info);
    }
  });

  it('targets direct HP loss and selected passives by their effects, independently of card type', () => {
    for (const effects of [
      [{ type: 'loseEnemyHp' as const, amount: 10 }],
      [{ type: 'passiveOrbs' as const, orb: 'lightning' as const, target: 'selected' as const }],
    ]) {
      expect(cardTargetMode({ ...CARD_DEFINITIONS.still_guard, effects, upgradedEffects: effects })).toBe('enemy');
    }
    const effects = [{ type: 'passiveOrbs' as const, orb: 'lightning' as const }];
    expect(cardTargetMode({ ...CARD_DEFINITIONS.still_guard, effects, upgradedEffects: effects })).toBe('self');
  });
});

describe.each([false, true])('arcane exact printed effects, upgraded=%s', (upgraded) => {
  it('claw damage scales across all copies, including copies with a different upgrade state', () => {
    const initial = fixture('machinist_claw', upgraded);
    const second: CardInstance = { uid: 'second-claw', cardId: 'machinist_claw', upgraded: !upgraded };
    initial.deck.push(second);
    initial.hand.push(second);
    const first = play(initial);
    expect(first.enemy.hp).toBe(2000 - (upgraded ? 4 : 3));
    expect(first.cardDamageBonuses?.machinist_claw).toBe(upgraded ? 3 : 2);
    const result = play(restore(first), second.uid);
    expect(result.enemy.hp).toBe(2000 - (upgraded ? 4 : 3) - (upgraded ? 3 : 4) - (upgraded ? 3 : 2));
    expect(result.cardDamageBonuses?.machinist_claw).toBe(5);
    restore(result);
  });

  it('lightning rod channels exactly once on each of the next two starts, including a nested saved schedule', () => {
    const first = play(fixture('machinist_lightning_rod', upgraded));
    expect(first.player.block).toBe(upgraded ? 7 : 4);
    expect(first.classResources!.orbs).toEqual([]);
    const second = idleTurn(restore(first));
    expect(second.classResources!.orbs).toEqual(['lightning']);
    expect(second.scheduledEffects).toHaveLength(1);
    const third = idleTurn(restore(second));
    expect(third.classResources!.orbs).toEqual(['lightning', 'lightning']);
    expect(third.scheduledEffects).toBeUndefined();
    expect(idleTurn(restore(third)).classResources!.orbs).toEqual(['lightning', 'lightning']);
  });

  it('biased cognition grants focus now and loses one at every later start, preserving negative stacks and focus', () => {
    let state = play(fixture('machinist_biased_cognition', upgraded));
    expect(state.classResources!.focus).toBe(upgraded ? 5 : 4);
    expect(state.powerStacks?.focusOnTurn).toBe(-1);
    for (let turn = 1; turn <= 7; turn++) {
      state = idleTurn(restore(state));
      expect(state.classResources!.focus).toBe((upgraded ? 5 : 4) - turn);
    }
    expect(getOrbView(state).focus).toBe(upgraded ? -2 : -3);
  });

  it('capacitor expands the actual orb slots and HUD without changing held order or evoking early', () => {
    const initial = fixture('machinist_capacitor', upgraded);
    initial.classResources!.orbs = ['lightning', 'frost', 'lightning'];
    const first = play(initial);
    expect(getOrbView(first).capacity).toBe(upgraded ? 6 : 5);
    expect(getOrbView(first).slots.filter((slot) => slot.type === null)).toHaveLength(upgraded ? 3 : 2);
    const zap: CardInstance = { uid: 'arcane-extra-zap', cardId: 'machinist_zap', upgraded: false };
    first.deck.push(zap);
    first.hand.push(zap);
    const result = play(restore(first), zap.uid);
    expect(result.classResources!.orbs).toEqual(['lightning', 'frost', 'lightning', 'lightning']);
    expect(result.enemy.hp).toBe(2000);
    expect(getOrbView(restore(result)).capacity).toBe(upgraded ? 6 : 5);
  });

  it('multiple capacitors retain all of their slots and save beyond the former relic-only bonus limit', () => {
    let state = fixture('machinist_capacitor', upgraded);
    for (let index = 1; index < 8; index++) {
      const card = { uid: `extra-capacitor-${index}`, cardId: 'machinist_capacitor', upgraded };
      state.hand.push(card);
      state.deck.push(card);
    }
    for (const card of [...state.hand].filter((held) => held.cardId === 'machinist_capacitor')) state = play(state, card.uid);
    expect(state.orbSlotBonus).toBe(upgraded ? 24 : 16);
    expect(getOrbView(restore(state)).capacity).toBe(upgraded ? 27 : 19);
  });

  it('tesla coil sends every lightning passive to the selected target without consuming orbs or triggering frost', () => {
    const initial = fixture('machinist_tesla_coil', upgraded, true);
    initial.classResources!.orbs = ['lightning', 'frost', 'lightning'];
    initial.classResources!.focus = 2;
    initial.player.strength = 3;
    initial.player.weak = 1;
    const selected = getEnemies(initial)[1];
    selected.vulnerable = 1;
    initial.selectedEnemyId = getEnemyKey(selected);
    const result = play(initial);
    expect(getEnemies(result).map((enemy) => enemy.hp)).toEqual([2000, 2000 - (upgraded ? 10 : 6) - 10]);
    expect(result.classResources!.orbs).toEqual(['lightning', 'frost', 'lightning']);
    expect(result.player.block).toBe(0);
    expect(result.rngState).toBe(initial.rngState);
    restore(result);
  });

  it('tesla coil and its preview never redirect the selected passives after the initial attack kills that target', () => {
    const initial = fixture('machinist_tesla_coil', upgraded, true);
    initial.classResources!.orbs = ['lightning', 'lightning'];
    const target = getEnemies(initial)[1];
    target.hp = 1;
    initial.selectedEnemyId = getEnemyKey(target);
    const passive = getCardRuntimeInfo(initial.hand[0], initial)!.facts.find((fact) => fact.key.endsWith(':passiveOrbs'))!;
    expect(passive.amount).toBe(0);
    expect(passive.summary).toContain('対象不在・不発');
    expect(getEnemies(play(initial)).map((enemy) => enemy.hp)).toEqual([2000, 0]);
  });

  it('coolant evaluates distinct current orb types on each start rather than a snapshot or orb count', () => {
    const initial = fixture('machinist_coolant', upgraded);
    initial.classResources!.orbs = ['lightning', 'lightning', 'frost'];
    let state = play(initial);
    expect(state.player.block).toBe(0);
    state = idleTurn(restore(state));
    expect(state.player.block).toBe(upgraded ? 6 : 4);
    state.classResources!.orbs = ['lightning', 'lightning'];
    state = idleTurn(restore(state));
    expect(state.player.block).toBe(upgraded ? 3 : 2);
    state.classResources!.orbs = [];
    expect(idleTurn(restore(state)).player.block).toBe(0);
  });

  it('barrage spends X energy, rolls its seeded target per hit and handles zero energy', () => {
    const initial = fixture('colorless_barrage', upgraded, true);
    initial.energy = 3;
    const result = play(initial);
    expect(result.energy).toBe(0);
    expect(getEnemies(result).reduce((sum, enemy) => sum + 2000 - enemy.hp, 0)).toBe(upgraded ? 42 : 30);
    expect(play(restore(initial))).toEqual(result);
    const empty = fixture('colorless_barrage', upgraded, true);
    empty.energy = 0;
    expect(getEnemies(play(empty)).map((enemy) => enemy.hp)).toEqual([2000, 2000]);
    const blocked = fixture('colorless_barrage', upgraded);
    blocked.energy = 3;
    blocked.enemy.block = 5;
    expect(play(blocked).enemy.hp).toBe(2000 - (upgraded ? 42 : 30) + 5);
  });

  it('chemical X increases the displayed and resolved X effect without increasing the energy payment', () => {
    const initial = fixture('colorless_barrage', upgraded, true);
    initial.relicIds = ['ref_chemical_x'];
    initial.energy = 3;
    const before = structuredClone(initial);
    const info = getCardRuntimeInfo(initial.hand[0], initial)!;
    expect(info.facts.find((fact) => fact.key.endsWith(':damage'))?.summary).toContain(`×5回`);
    expect(initial).toEqual(before);
    const result = play(initial);
    expect(result.energy).toBe(0);
    expect(getEnemies(result).reduce((sum, enemy) => sum + 2000 - enemy.hp, 0)).toBe(upgraded ? 70 : 50);
  });

  it('pen nib runtime facts project the triggering attack without consuming the persistent counter', () => {
    const initial = fixture('machinist_claw', upgraded);
    initial.relicIds = ['ref_pen_nib'];
    initial.relicState = { 'attacks:ref_pen_nib': 9 };
    const before = structuredClone(initial);
    const info = getCardRuntimeInfo(initial.hand[0], initial)!;
    const damage = info.facts.find((fact) => fact.key.endsWith(':damage'))!;
    expect(damage.amount).toBe(upgraded ? 8 : 6);
    expect(initial).toEqual(before);
    const after = play(initial);
    expect(damage.amount).toBe(2000 - after.enemy.hp);
    expect(after.relicState?.['attacks:ref_pen_nib']).toBe(10);
  });

  it('dark shackles weakens only its target through the enemy attack and restores only its own delta', () => {
    const initial = fixture('colorless_dark_shackles', upgraded, true);
    const target = getEnemies(initial)[1];
    target.strength = 1;
    target.intent = { kind: 'attack', label: '検証打撃', description: '10ダメージ。', damage: 10 };
    initial.selectedEnemyId = getEnemyKey(target);
    const result = play(initial);
    expect(getEnemies(result).map((enemy) => enemy.strength)).toEqual([0, upgraded ? -14 : -8]);
    expect(result.exhaustPile.some((card) => card.uid === PLAYED_UID)).toBe(true);
    getEnemies(result)[1].strength -= 2;
    const next = reduceCombat(restore(result), { type: 'endTurn' });
    expect(next.player.hp).toBe(initial.player.hp);
    expect(getEnemies(next).map((enemy) => enemy.strength)).toEqual([0, -1]);
  });

  it('forethought draws two, suspends for a chosen topdeck and upgrades away only its exhaust', () => {
    const result = play(fixture('colorless_forethought', upgraded));
    expect(result.hand).toHaveLength(6);
    expect(result.pendingChoice?.mode).toBe('topdeck');
    const chosen = result.hand[0];
    const final = reduceCombat(restore(result), { type: 'chooseCards', cardIds: [chosen.uid] });
    expect(final.hand).toHaveLength(5);
    expect(final.drawPile.at(-1)?.uid).toBe(chosen.uid);
    expect(final.exhaustPile.some((card) => card.uid === PLAYED_UID)).toBe(!upgraded);
    expect(final.discardPile.some((card) => card.uid === PLAYED_UID)).toBe(upgraded);
    expect(reduceCombat(final, { type: 'chooseCards', cardIds: [chosen.uid] })).toBe(final);
    restore(final);
  });

  it('lacerate scales once per debuff kind, including negative strength and stun, then applies vulnerability', () => {
    expect(play(fixture('colorless_lacerate', upgraded)).enemy.hp).toBe(2000 - (upgraded ? 18 : 15));
    const initial = fixture('colorless_lacerate', upgraded);
    Object.assign(initial.enemy, { weak: 2, vulnerable: 1, poison: 3, doom: 4, strength: -2, stun: 1 });
    expect(play(initial).enemy.hp).toBe(2000 - (upgraded ? 99 : 67));
  });

  it('scrawl fills the existing hand limit, exhausts only itself and retains only when upgraded', () => {
    const initial = fixture('colorless_scrawl', upgraded);
    const result = play(initial);
    expect(result.hand).toHaveLength(50);
    expect(result.drawPile).toHaveLength(10);
    expect(result.exhaustPile.map((card) => card.uid)).toEqual([PLAYED_UID]);
    restore(result);
    const unused = idleTurn(fixture('colorless_scrawl', upgraded));
    expect(unused.hand.some((card) => card.uid === PLAYED_UID)).toBe(upgraded);
  });

  it('frenzy resolves two separately seeded hits with normal attack modifiers', () => {
    const initial = fixture('colorless_frenzy', upgraded, true);
    initial.player.strength = 2;
    initial.player.weak = 1;
    for (const enemy of getEnemies(initial)) enemy.vulnerable = 1;
    const result = play(initial);
    expect(getEnemies(result).reduce((sum, enemy) => sum + 2000 - enemy.hp, 0)).toBe(upgraded ? 24 : 20);
    expect(play(restore(initial))).toEqual(result);
  });

  it('food fight grants temporary strength without erasing permanent strength', () => {
    const initial = fixture('colorless_food_fight', upgraded);
    initial.player.strength = 2;
    const result = play(initial);
    expect(result.player.strength).toBe(upgraded ? 9 : 7);
    expect(idleTurn(restore(result)).player.strength).toBe(2);
  });

  it('circular barrier grants block now and at exactly two later starts, preserving schedules through load', () => {
    const amount = upgraded ? 7 : 5;
    let state = play(fixture('colorless_circular_barrier', upgraded));
    expect(state.player.block).toBe(amount);
    for (let turn = 0; turn < 2; turn++) {
      state = idleTurn(restore(state));
      expect(state.player.block).toBe(amount);
    }
    expect(state.scheduledEffects).toBeUndefined();
    expect(idleTurn(restore(state)).player.block).toBe(0);
  });

  it('valor grants permanent strength and dexterity that increases a later defensive card', () => {
    const state = play(fixture('colorless_valor', upgraded));
    const amount = upgraded ? 2 : 1;
    expect(state.player.strength).toBe(amount);
    expect(state.dexterity).toBe(amount);
    const defense = state.hand[0];
    const result = play(restore(state), defense.uid);
    expect(result.player.block).toBe(8 + amount);
    const next = idleTurn(restore(result));
    expect(next.player.strength).toBe(amount);
    expect(next.dexterity).toBe(amount);
  });

  it('immortal armor grants plate, blocks at turn end and loses one only for each damaging enemy hit', () => {
    const amount = upgraded ? 9 : 7;
    const state = play(fixture('colorless_immortal_armor', upgraded));
    expect(state.plate).toBe(amount);
    expect(state.player.block).toBe(0);
    state.enemy.intent = { kind: 'attack', label: '連撃', description: 'プレートを砕く。', damage: amount + 2, hits: 2 };
    const next = reduceCombat(restore(state), { type: 'endTurn' });
    expect(next.player.hp).toBe(state.player.hp - amount - 4);
    expect(next.plate).toBe(amount - 2);
    restore(next);
    const guarded = play(fixture('colorless_immortal_armor', upgraded));
    guarded.enemy.intent = { kind: 'attack', label: '小突く', description: '1ダメージ。', damage: 1 };
    expect(reduceCombat(guarded, { type: 'endTurn' }).plate).toBe(amount);
    const poisoned = play(fixture('colorless_immortal_armor', upgraded));
    poisoned.player.poison = 2;
    expect(idleTurn(poisoned).plate).toBe(amount);
  });
});

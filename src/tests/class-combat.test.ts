import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import catalog from '../data/sourceCards.generated.json';
import { canPlayCard, createCombat, getCardCost, getEnemies, predictEnemyDamage, reduceCombat } from '../engine';
import type { CardDefinition, CardInstance, ClassId, CombatState } from '../types/game';

function referenceCard(classId: ClassId | 'colorless', sourceName: string): CardDefinition {
  const source = catalog.cards.find((card) => card.sourceClass === classId && card.sourceName === sourceName);
  const definition = Object.values(CARD_DEFINITIONS).find((card) => card.sourceCardId === source?.id);
  if (!source || !definition) throw new Error(`Missing implemented reference: ${classId}/${sourceName}`);
  return definition;
}

function fixture(classId: ClassId, definition: CardDefinition, upgraded = false, multi = false): CombatState {
  const state = createCombat('class-mechanic-fixture', multi ? ['grit_scout', 'candle_moth'] : 'grit_scout', { classId });
  const played = { uid: 'fixture-played', cardId: definition.id, upgraded };
  const filler = Array.from({ length: 20 }, (_, index) => ({ uid: `fixture-fill-${index}`, cardId: 'still_guard', upgraded: false }));
  state.hand = [played, ...filler.slice(0, 3)];
  state.drawPile = filler.slice(3);
  state.discardPile = [];
  state.exhaustPile = [];
  state.powers = [];
  state.deck = [played, ...filler];
  state.energy = 20;
  for (const enemy of getEnemies(state)) {
    enemy.hp = 500;
    enemy.maxHp = 500;
    enemy.block = 0;
    enemy.intent = { kind: 'defend', label: '待機', description: 'テスト用の待機。', block: 0 };
  }
  return state;
}

function play(state: CombatState): CombatState {
  return reduceCombat(state, { type: 'playCard', cardId: 'fixture-played' });
}

function zoneCards(state: CombatState): CardInstance[] {
  return [...state.hand, ...state.drawPile, ...state.discardPile, ...state.exhaustPile, ...state.powers,
    ...(state.pendingChoice?.resume.sourceCard ? [state.pendingChoice.resume.sourceCard] : [])];
}

function expectConserved(state: CombatState): void {
  const cards = zoneCards(state);
  expect(new Set(cards.map((card) => card.uid)).size).toBe(cards.length);
  expect(cards.map((card) => card.uid).sort()).toEqual(
    [...state.deck, ...(state.generatedCards ?? [])].map((card) => card.uid).sort(),
  );
}

describe('five-class shared card mechanics', () => {
  it.each([false, true])('HP payment bypasses block and grants the exact offering reward (upgraded=%s)', (upgraded) => {
    const state = fixture('berserker', referenceCard('berserker', '供物'), upgraded);
    state.player.block = 100;
    state.energy = 0;
    const before = structuredClone(state);
    const after = play(state);
    expect(after.player.hp).toBe(state.player.hp - 6);
    expect(after.player.block).toBe(100);
    expect(after.energy).toBe(2);
    expect(after.hand).toHaveLength(3 + (upgraded ? 5 : 3));
    expect(after.exhaustPile.map((card) => card.uid)).toContain('fixture-played');
    expect(state).toEqual(before);
    expectConserved(after);
  });

  it.each([false, true])('anger copies preserve their upgrade state and remain battle-only (upgraded=%s)', (upgraded) => {
    const state = fixture('berserker', referenceCard('berserker', '怒り'), upgraded);
    const after = play(state);
    expect(after.enemy.hp).toBe(500 - (upgraded ? 8 : 6));
    expect(after.generatedCards).toHaveLength(1);
    expect(after.generatedCards![0]).toMatchObject({ cardId: state.hand[0].cardId, upgraded });
    expect(after.generatedCards![0].uid).not.toBe('fixture-played');
    expect(after.discardPile).toHaveLength(2);
    expect(after.deck).toEqual(state.deck);
    expectConserved(after);
  });

  it('a hand-selection effect pauses resolution and refuses every invalid or duplicate selection', () => {
    const state = fixture('berserker', referenceCard('berserker', '焦熱の契約'));
    const pending = play(state);
    expect(pending.pendingChoice).toMatchObject({ mode: 'exhaust', amount: 1 });
    expect(pending.hand).toHaveLength(3);
    expect(pending.drawPile).toHaveLength(17);
    expect(canPlayCard(pending, pending.hand[0].uid)).toBe(false);
    expect(reduceCombat(pending, { type: 'endTurn' })).toBe(pending);
    pending.potions = ['magma_flask', null, null];
    expect(reduceCombat(pending, { type: 'usePotion', slot: 0 })).toBe(pending);
    expect(reduceCombat(pending, { type: 'chooseCards', cardIds: [] })).toBe(pending);
    expect(reduceCombat(pending, { type: 'chooseCards', cardIds: ['missing'] })).toBe(pending);
    expect(reduceCombat(pending, { type: 'chooseCards', cardIds: [pending.hand[0].uid, pending.hand[0].uid] })).toBe(pending);
    expectConserved(pending);
    const selected = pending.hand[1].uid;
    const after = reduceCombat(pending, { type: 'chooseCards', cardIds: [selected] });
    expect(after.pendingChoice).toBeUndefined();
    expect(after.exhaustPile.map((card) => card.uid)).toContain(selected);
    expect(after.hand).toHaveLength(4);
    expect(after.discardPile.map((card) => card.uid)).toContain('fixture-played');
    expectConserved(after);
  });

  it.each([false, true])('survivor requires player-selected discard after blocking (upgraded=%s)', (upgraded) => {
    const state = fixture('assassin', referenceCard('assassin', 'サバイバー'), upgraded);
    const pending = play(state);
    expect(pending.player.block).toBe(upgraded ? 11 : 8);
    expect(pending.pendingChoice).toMatchObject({ mode: 'discard', amount: 1 });
    const selected = pending.hand[2].uid;
    const after = reduceCombat(pending, { type: 'chooseCards', cardIds: [selected] });
    expect(after.hand).toHaveLength(2);
    expect(after.discardPile.map((card) => card.uid)).toContain(selected);
    expectConserved(after);
  });

  it.each([false, true])('poison applies its exact amount and bypasses block at enemy-turn start (upgraded=%s)', (upgraded) => {
    const state = fixture('assassin', referenceCard('assassin', '致死毒'), upgraded);
    const applied = play(state);
    expect(applied.enemy.poison).toBe(upgraded ? 7 : 5);
    applied.enemy.block = 100;
    const after = reduceCombat(applied, { type: 'endTurn' });
    expect(after.enemy.hp).toBe(500 - (upgraded ? 7 : 5));
    expect(after.enemy.poison).toBe(upgraded ? 6 : 4);
  });

  it.each([false, true])('knife generation creates exact-count playable exhaust tokens (upgraded=%s)', (upgraded) => {
    const state = fixture('assassin', referenceCard('assassin', '剣の舞'), upgraded);
    const generated = play(state);
    expect(generated.generatedCards).toHaveLength(upgraded ? 4 : 3);
    const knife = generated.hand.find((card) => CARD_DEFINITIONS[card.cardId].tokenOnly)!;
    expect(knife).toBeDefined();
    const after = reduceCombat(generated, { type: 'playCard', cardId: knife.uid });
    expect(after.enemy.hp).toBeLessThan(generated.enemy.hp);
    expect(after.exhaustPile.map((card) => card.uid)).toContain(knife.uid);
    expectConserved(after);
  });

  it.each([false, true])('stars accumulate from explicit source amounts and reset only the turn counter (upgraded=%s)', (upgraded) => {
    const state = fixture('oracle', referenceCard('oracle', '畏敬'), upgraded);
    state.classResources!.stars = 5;
    const after = play(state);
    expect(after.classResources!.stars).toBe(5 + (upgraded ? 3 : 2));
    expect(after.classResources!.starsGainedThisTurn).toBe(upgraded ? 3 : 2);
    const next = reduceCombat(after, { type: 'endTurn' });
    expect(next.classResources!.stars).toBe(after.classResources!.stars);
    expect(next.classResources!.starsGainedThisTurn).toBe(0);
  });

  it.each([false, true])('forging strengthens one fetched blade instead of creating duplicates (upgraded=%s)', (upgraded) => {
    const state = fixture('oracle', referenceCard('oracle', '顕現'), upgraded);
    const forged = play(state);
    expect(forged.classResources!.forge).toBe(upgraded ? 11 : 8);
    const blade = forged.hand.find((card) => CARD_DEFINITIONS[card.cardId].tokenOnly)!;
    expect(blade).toBeDefined();
    const attacked = reduceCombat(forged, { type: 'playCard', cardId: blade.uid });
    expect(attacked.enemy.hp).toBeLessThan(forged.enemy.hp);
    const again = { ...attacked, hand: [...attacked.hand, attacked.discardPile.find((card) => card.uid === 'fixture-played')!], discardPile: attacked.discardPile.filter((card) => card.uid !== 'fixture-played') };
    const fetched = play(again);
    expect(fetched.generatedCards).toHaveLength(1);
    expect(fetched.hand.filter((card) => card.uid === blade.uid)).toHaveLength(1);
    expect(fetched.classResources!.forge).toBe(2 * (upgraded ? 11 : 8));
    expectConserved(fetched);
  });

  it.each([false, true])('summoning creates a bodyguard that absorbs attacks after block (upgraded=%s)', (upgraded) => {
    const state = fixture('necromancer', referenceCard('necromancer', 'ボディガード'), upgraded);
    const summoned = play(state);
    expect(summoned.classResources!.ostyHp).toBe(upgraded ? 7 : 5);
    summoned.player.block = 2;
    summoned.enemy.intent = { kind: 'attack', label: '試撃', description: '10ダメージ。', damage: 10 };
    const next = reduceCombat(summoned, { type: 'endTurn' });
    expect(next.classResources!.ostyHp).toBe(0);
    expect(next.player.hp).toBe(summoned.player.hp - (upgraded ? 1 : 3));
  });

  it.each([false, true])('Osty strikes use summon HP and do nothing when no summon exists (upgraded=%s)', (upgraded) => {
    const state = fixture('necromancer', referenceCard('necromancer', '解き放つ'), upgraded);
    expect(play(state).enemy.hp).toBe(500);
    state.classResources!.ostyHp = 7;
    const after = play(state);
    expect(after.enemy.hp).toBe(500 - 7 - (upgraded ? 9 : 6));
    expect(after.classResources!.ostyHp).toBe(7);
  });

  it.each([false, true])('doom is based on HP damage and kills at the exact HP threshold (upgraded=%s)', (upgraded) => {
    const state = fixture('necromancer', referenceCard('necromancer', '枯毒のストライク'), upgraded);
    state.enemy.block = 3;
    const after = play(state);
    const hpDamage = (upgraded ? 10 : 8) - 3;
    expect(after.enemy.hp).toBe(500 - hpDamage);
    expect(after.enemy.doom).toBe(hpDamage);
    after.enemy.hp = hpDamage;
    const finished = reduceCombat(after, { type: 'endTurn' });
    expect(finished.phase).toBe('victory');
    expect(finished.enemy.hp).toBe(0);
  });

  it.each([false, true])('souls are seeded generated cards with their own upgrade flag (upgraded=%s)', (upgraded) => {
    const state = fixture('necromancer', referenceCard('necromancer', '魂剥ぎ'), upgraded);
    const after = play(state);
    expect(after.enemy.hp).toBe(500 - (upgraded ? 11 : 9));
    expect(after.generatedCards).toHaveLength(1);
    expect(after.generatedCards![0].upgraded).toBe(upgraded);
    expect(after.drawPile.map((card) => card.uid)).toContain(after.generatedCards![0].uid);
    expect(after.rngState).not.toBe(state.rngState);
    expect(play(state)).toEqual(after);
    expectConserved(after);
  });

  it.each([false, true])('lightning generation and double evoke respect focus and upgraded costs (upgraded=%s)', (upgraded) => {
    const state = fixture('machinist', referenceCard('machinist', 'ザップ'), upgraded);
    state.energy = upgraded ? 0 : 1;
    expect(getCardCost(state.hand[0], state)).toBe(upgraded ? 0 : 1);
    const channeled = play(state);
    expect(channeled.classResources!.orbs).toEqual(['lightning']);
    expect(channeled.energy).toBe(0);
    const dual = fixture('machinist', referenceCard('machinist', 'デュアルキャスト'), upgraded);
    dual.classResources!.orbs = ['frost', 'lightning'];
    dual.classResources!.focus = 2;
    const after = play(dual);
    expect(after.classResources!.orbs).toEqual(['frost']);
    expect(after.enemy.hp).toBe(480);
  });

  it('temporary focus affects this turn passive orbs, then expires before the next turn', () => {
    const state = fixture('machinist', referenceCard('machinist', 'ホットフィックス'));
    state.classResources!.orbs = ['lightning', 'frost'];
    const focused = play(state);
    expect(focused.classResources!.focus).toBe(2);
    focused.enemy.intent = { kind: 'attack', label: '試撃', description: '10ダメージ。', damage: 10 };
    const after = reduceCombat(focused, { type: 'endTurn' });
    expect(after.enemy.hp).toBe(495);
    expect(after.player.hp).toBe(state.player.hp - 6);
    expect(after.classResources!.focus).toBe(0);
    expect(after.classResources!.temporaryFocus).toBe(0);
    expect(after.exhaustPile.map((card) => card.uid)).toContain('fixture-played');
    const upgraded = play(fixture('machinist', referenceCard('machinist', 'ホットフィックス'), true));
    expect(upgraded.exhaustPile).toHaveLength(0);
    expect(upgraded.discardPile.map((card) => card.uid)).toContain('fixture-played');
  });

  it.each([false, true])('X energy is captured before payment and still permits zero-energy casts (upgraded=%s)', (upgraded) => {
    const state = fixture('machinist', referenceCard('machinist', 'テンペスト'), upgraded);
    state.energy = 2;
    expect(getCardCost(state.hand[0], state)).toBe(2);
    const after = play(state);
    expect(after.energy).toBe(0);
    expect(after.classResources!.orbs).toHaveLength(upgraded ? 3 : 2);
    const empty = fixture('machinist', referenceCard('machinist', 'テンペスト'), upgraded);
    empty.energy = 0;
    expect(canPlayCard(empty, empty.hand[0].uid)).toBe(true);
    expect(play(empty).classResources!.orbs).toHaveLength(upgraded ? 1 : 0);
  });

  it('an all-enemy attack damages both opponents without ending combat after only one kill', () => {
    const state = fixture('machinist', referenceCard('machinist', 'ビーム一掃'), false, true);
    getEnemies(state)[0].hp = 1;
    const after = play(state);
    expect(getEnemies(after)[0].hp).toBe(0);
    expect(getEnemies(after)[1].hp).toBe(494);
    expect(after.phase).toBe('player');
    expect(after.hand).toHaveLength(4);
  });

  it('playing stars before the payoff changes damage, and an empty payoff cannot gain strength damage', () => {
    const state = fixture('oracle', referenceCard('oracle', '畏敬'));
    const burst = { uid: 'star-payoff', cardId: referenceCard('oracle', '輝きの奔流').id, upgraded: false };
    state.hand.push(burst);
    state.deck.push(burst);
    state.player.strength = 2;
    const earlyBurst = reduceCombat(state, { type: 'playCard', cardId: burst.uid });
    expect(earlyBurst.enemy.hp).toBe(500);
    const lateStars = play(earlyBurst);
    expect(lateStars.enemy.hp).toBe(500);
    const starsFirst = play(state);
    const lateBurst = reduceCombat(starsFirst, { type: 'playCard', cardId: burst.uid });
    expect(lateBurst.enemy.hp).toBe(492);
    expect(lateBurst.classResources!.stars).toBe(2);
    expect(lateStars.classResources!.stars).toBe(2);
  });

  it.each([false, true])('an unplayed ethereal card exhausts while a retained card stays in hand (upgraded=%s)', (upgraded) => {
    const ethereal = fixture('necromancer', referenceCard('necromancer', '冒涜'), upgraded);
    const after = reduceCombat(ethereal, { type: 'endTurn' });
    expect(after.exhaustPile.map((card) => card.uid)).toContain('fixture-played');
    expect(after.hand.map((card) => card.uid)).not.toContain('fixture-played');
    expectConserved(after);
    const retained = fixture('necromancer', referenceCard('necromancer', '種まき'), upgraded);
    const next = reduceCombat(retained, { type: 'endTurn' });
    expect(next.hand.map((card) => card.uid)).toContain('fixture-played');
    expect(next.hand).toHaveLength(6);
    expectConserved(next);
  });

  it('upgrade-only retain takes effect without granting retain to the normal card', () => {
    for (const upgraded of [false, true]) {
      const state = fixture('necromancer', referenceCard('necromancer', 'ウィスプ'), upgraded);
      const after = reduceCombat(state, { type: 'endTurn' });
      expect(after.hand.some((card) => card.uid === 'fixture-played')).toBe(upgraded);
      expect(after.discardPile.some((card) => card.uid === 'fixture-played')).toBe(!upgraded);
    }
  });

  it('innate cards are in the opening hand even when they begin at the end of a large deck', () => {
    const entrance = referenceCard('colorless', '劇的な入場');
    for (const upgraded of [false, true]) {
      const deck = [
        ...Array.from({ length: 20 }, (_, index) => ({ uid: `filler-${index}`, cardId: 'berserker_guard', upgraded: false })),
        { uid: 'innate-last', cardId: entrance.id, upgraded },
      ];
      const state = createCombat(`innate-${upgraded}`, 'grit_scout', { classId: 'berserker', deck });
      expect(state.hand).toHaveLength(5);
      expect(state.hand.map((card) => card.uid)).toContain('innate-last');
      expectConserved(state);
    }
  });

  it.each([false, true])('a persistent strength power triggers once at each later player turn (upgraded=%s)', (upgraded) => {
    const state = fixture('berserker', referenceCard('berserker', '悪魔化'), upgraded);
    const powered = play(state);
    expect(powered.player.strength).toBe(0);
    expect(powered.powers).toHaveLength(1);
    const next = reduceCombat(powered, { type: 'endTurn' });
    expect(next.player.strength).toBe(upgraded ? 3 : 2);
    const again = reduceCombat(next, { type: 'endTurn' });
    expect(again.player.strength).toBe(upgraded ? 6 : 4);
    expect(again.powers).toHaveLength(1);
  });

  it('knife damage powers affect generated knives and combine with strength exactly once', () => {
    const state = fixture('assassin', referenceCard('assassin', '精度上昇'));
    const dance = { uid: 'knife-dance', cardId: referenceCard('assassin', '剣の舞').id, upgraded: false };
    state.hand.push(dance);
    state.deck.push(dance);
    state.player.strength = 2;
    const prepared = play(state);
    const generated = reduceCombat(prepared, { type: 'playCard', cardId: dance.uid });
    const knife = generated.hand.find((card) => card.cardId === 'token_knife')!;
    const hit = reduceCombat(generated, { type: 'playCard', cardId: knife.uid });
    expect(hit.enemy.hp).toBe(490);
    expect(hit.exhaustPile.map((card) => card.uid)).toContain(knife.uid);
  });

  it('channeling a fourth orb evokes the rightmost once and preserves the other two', () => {
    const state = fixture('machinist', referenceCard('machinist', 'ザップ'));
    state.classResources!.orbs = ['frost', 'lightning', 'frost'];
    state.classResources!.focus = 1;
    const after = play(state);
    expect(after.classResources!.orbs).toEqual(['frost', 'lightning', 'lightning']);
    expect(after.player.block).toBe(6);
    expect(after.enemy.hp).toBe(500);
  });

  it('passive lightning targets are seeded and ignore the UI-selected attack target', () => {
    const state = fixture('machinist', referenceCard('machinist', 'ザップ'), false, true);
    state.classResources!.orbs = ['lightning', 'lightning', 'lightning'];
    state.classResources!.focus = 2;
    const after = reduceCombat(state, { type: 'endTurn' });
    expect(getEnemies(after).reduce((sum, enemy) => sum + (500 - enemy.hp), 0)).toBe(15);
    expect(reduceCombat(state, { type: 'endTurn' })).toEqual(after);
    const secondTarget = getEnemies(state)[1].instanceId!;
    const selected = reduceCombat(state, { type: 'selectEnemy', targetId: secondTarget });
    const alternate = reduceCombat(selected, { type: 'endTurn' });
    expect(getEnemies(alternate).map((enemy) => enemy.hp)).toEqual(getEnemies(after).map((enemy) => enemy.hp));
    expect(alternate.rngState).toBe(after.rngState);
  });

  it('lethal HP payment ends combat before granting energy or drawing cards', () => {
    const state = fixture('berserker', referenceCard('berserker', '供物'));
    state.player.hp = 5;
    state.player.block = 100;
    const after = play(state);
    expect(after.phase).toBe('defeat');
    expect(after.player.hp).toBe(0);
    expect(after.energy).toBe(state.energy);
    expect(after.hand).toHaveLength(3);
    expect(after.exhaustPile.map((card) => card.uid)).toContain('fixture-played');
    expectConserved(after);
  });

  it('poison followed by doom prevents the predicted enemy attack at the exact threshold', () => {
    const state = fixture('necromancer', referenceCard('necromancer', 'ボディガード'));
    state.enemy.hp = 10;
    state.enemy.poison = 3;
    state.enemy.doom = 7;
    state.enemy.intent = { kind: 'attack', label: '試撃', description: '10ダメージ。', damage: 10 };
    expect(predictEnemyDamage(state)).toBe(0);
    const after = reduceCombat(state, { type: 'endTurn' });
    expect(after.phase).toBe('victory');
    expect(after.player.hp).toBe(state.player.hp);
    const below = structuredClone(state);
    below.enemy.doom = 6;
    expect(predictEnemyDamage(below)).toBe(10);
    const survives = reduceCombat(below, { type: 'endTurn' });
    expect(survives.phase).toBe('player');
    expect(survives.enemy.hp).toBe(7);
    expect(survives.player.hp).toBe(state.player.hp - 10);
  });
});

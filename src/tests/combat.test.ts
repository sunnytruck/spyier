import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS, STARTER_DECK } from '../data/cards';
import {
  calculateDamage,
  canPlayCard,
  changeGauge,
  createCombat,
  drawCards,
  isDeified,
  predictEnemyDamage,
  reduceCombat,
  upgradeCard,
} from '../engine';
import type { CardInstance, CombatState } from '../types/game';

function fixture(
  handIds: string[] = ['stone_strike'],
  drawIds: string[] = [],
  discardIds: string[] = [],
): CombatState {
  const state = createCombat('engine-fixture');
  let serial = 0;
  const instances = (ids: string[]): CardInstance[] =>
    ids.map((cardId) => ({
      uid: `fixture-${serial++}`,
      cardId,
      upgraded: false,
    }));
  const hand = instances(handIds);
  const drawPile = instances(drawIds);
  const discardPile = instances(discardIds);
  return {
    ...state,
    enemy: { ...state.enemy, hp: 500, maxHp: 500 },
    hand,
    drawPile,
    discardPile,
    exhaustPile: [],
    powers: [],
    deck: [...hand, ...drawPile, ...discardPile],
  };
}

function play(state: CombatState, cardId: string): CombatState {
  const card = state.hand.find((candidate) => candidate.cardId === cardId);
  if (!card) throw new Error(`Test setup has no ${cardId} in hand`);
  return reduceCombat(state, { type: 'playCard', cardId: card.uid });
}

function passiveEnemy(state: CombatState): CombatState {
  return {
    ...state,
    enemy: {
      ...state.enemy,
      intent: { kind: 'defend', label: '待機', description: 'テスト用の待機。', block: 0 },
    },
  };
}

function zoneIds(state: CombatState): string[] {
  return [
    ...state.hand,
    ...state.drawPile,
    ...state.discardPile,
    ...state.exhaustPile,
    ...state.powers,
  ]
    .map((card) => card.uid)
    .sort();
}

describe('combat initialization and stable content', () => {
  it('starts at 80 HP with 3 energy, five cards, and a ten-card deck', () => {
    const state = createCombat('first-battle');
    expect(state.player.hp).toBe(80);
    expect(state.player.maxHp).toBe(80);
    expect(state.energy).toBe(3);
    expect(state.maxEnergy).toBe(3);
    expect(state.jitto).toBe(0);
    expect(state.turn).toBe(1);
    expect(state.phase).toBe('player');
    expect(state.hand).toHaveLength(5);
    expect(state.drawPile).toHaveLength(5);
    expect(state.deck).toHaveLength(10);
    expect(new Set(zoneIds(state)).size).toBe(10);
    expect(zoneIds(state)).toEqual(state.deck.map((card) => card.uid).sort());
  });

  it('has ten unique stable card IDs covering attacks, skills, and powers', () => {
    const definitions = Object.values(CARD_DEFINITIONS);
    expect(definitions.length).toBeGreaterThanOrEqual(10);
    expect(new Set(definitions.map((card) => card.id)).size).toBe(definitions.length);
    expect(new Set(definitions.map((card) => card.type))).toEqual(
      new Set(['attack', 'skill', 'power']),
    );
    for (const id of STARTER_DECK) expect(CARD_DEFINITIONS[id]?.id).toBe(id);
    for (const definition of definitions) {
      expect(CARD_DEFINITIONS[definition.id]).toBe(definition);
      if (definition.unplayable) {
        expect(definition.curse).toBe(true);
        expect(definition.unupgradable).toBe(true);
        expect(definition.rewardEligible).toBe(false);
      } else expect(definition.upgradedEffects.length).toBeGreaterThan(0);
    }
  });

  it('reproduces the complete initial state for an identical seed', () => {
    expect(createCombat('reproducible')).toEqual(createCombat('reproducible'));
    expect(createCombat('different-a').hand).not.toEqual(createCombat('different-b').hand);
  });
});

describe('card actions and immutable state', () => {
  it('pays the cost, resolves the card, and moves it to discard exactly once', () => {
    const before = fixture();
    const snapshot = structuredClone(before);
    const uid = before.hand[0].uid;
    expect(canPlayCard(before, uid)).toBe(true);
    const after = play(before, 'stone_strike');
    expect(after.energy).toBe(2);
    expect(after.enemy.hp).toBe(493);
    expect(after.jitto).toBe(5);
    expect(after.hand).toHaveLength(0);
    expect(after.discardPile.map((card) => card.uid)).toEqual([uid]);
    expect(after.cardsPlayedThisTurn).toBe(1);
    expect(after.stats.cardsPlayed).toBe(1);
    expect(before).toEqual(snapshot);
    expect(reduceCombat(after, { type: 'playCard', cardId: uid })).toEqual(after);
  });

  it('rejects an unaffordable card without consuming it or changing any state', () => {
    const before = fixture(['divine_fist']);
    before.energy = 1;
    expect(canPlayCard(before, before.hand[0].uid)).toBe(false);
    expect(play(before, 'divine_fist')).toEqual(before);
  });

  it('allows a zero-cost card at zero energy and applies its energy gain', () => {
    const before = fixture(['morning_chant']);
    before.energy = 0;
    expect(canPlayCard(before, before.hand[0].uid)).toBe(true);
    const after = play(before, 'morning_chant');
    expect(after.energy).toBe(1);
    expect(after.jitto).toBe(15);
  });

  it('rejects unknown card UIDs and cards outside the hand', () => {
    const before = fixture([], ['stone_strike']);
    expect(canPlayCard(before, 'missing')).toBe(false);
    expect(canPlayCard(before, before.drawPile[0].uid)).toBe(false);
    expect(reduceCombat(before, { type: 'playCard', cardId: before.drawPile[0].uid })).toEqual(
      before,
    );
    expect(reduceCombat(before, { type: 'playCard', cardId: 'missing' })).toEqual(before);
  });

  it.each(['victory', 'defeat'] as const)(
    'prevents all further combat transitions after %s',
    (phase) => {
      const state = fixture();
      state.phase = phase;
      expect(canPlayCard(state, state.hand[0].uid)).toBe(false);
      expect(play(state, 'stone_strike')).toEqual(state);
      expect(reduceCombat(state, { type: 'endTurn' })).toEqual(state);
    },
  );
});

describe('drawing, discarding, and deterministic reshuffles', () => {
  it('draws the remaining pile first, then shuffles the discard without losing cards', () => {
    const before = fixture([], ['stone_strike'], ['still_guard', 'poison_moss', 'morning_chant']);
    const snapshot = structuredClone(before);
    const after = drawCards(before, 4);
    expect(after.hand[0].cardId).toBe('stone_strike');
    expect(after.hand).toHaveLength(4);
    expect(after.drawPile).toHaveLength(0);
    expect(after.discardPile).toHaveLength(0);
    expect(zoneIds(after)).toEqual(zoneIds(before));
    expect(after.rngState).not.toBe(before.rngState);
    expect(drawCards(before, 4)).toEqual(after);
    expect(before).toEqual(snapshot);
  });

  it('stops safely when both draw and discard piles run out', () => {
    const before = fixture([], [], ['stone_strike']);
    const after = drawCards(before, 100);
    expect(after.hand).toHaveLength(1);
    expect(after.drawPile).toEqual([]);
    expect(after.discardPile).toEqual([]);
    const empty = fixture([]);
    expect(drawCards(empty, 5).hand).toEqual([]);
    expect(drawCards(empty, 0).hand).toEqual([]);
  });

  it('discards the unplayed hand, restores energy, and draws five on a new turn', () => {
    const before = createCombat('turn-draw');
    const allIds = zoneIds(before);
    before.energy = 0;
    const after = reduceCombat(before, { type: 'endTurn' });
    expect(after.turn).toBe(2);
    expect(after.energy).toBe(3);
    expect(after.hand).toHaveLength(5);
    expect(after.discardPile).toHaveLength(5);
    expect(after.cardsPlayedThisTurn).toBe(0);
    expect(zoneIds(after)).toEqual(allIds);
  });

  it('draw effects remove the used card before resolving a reshuffle', () => {
    const before = fixture(['deep_breath'], [], ['stone_strike', 'still_guard']);
    const after = play(before, 'deep_breath');
    expect(after.hand.map((card) => card.cardId).sort()).toEqual(['still_guard', 'stone_strike']);
    expect(after.discardPile.map((card) => card.cardId)).toEqual(['deep_breath']);
    expect(after.player.block).toBe(5);
    expect(after.energy).toBe(2);
  });
});

describe('damage, block, and statuses', () => {
  it('applies strength, weakness and vulnerability, flooring only after all multipliers', () => {
    const state = fixture();
    const attacker = { ...state.player, strength: 2, weak: 1 };
    const defender = { ...state.enemy, vulnerable: 1 };
    expect(calculateDamage(7, attacker, defender)).toBe(10);
    expect(calculateDamage(7, { ...attacker, weak: 0 }, { ...defender, vulnerable: 0 })).toBe(9);
    expect(calculateDamage(2, { ...attacker, strength: -10 }, defender)).toBe(0);
  });

  it('uses block before HP and retains unused block', () => {
    const partiallyBlocked = fixture();
    partiallyBlocked.enemy.block = 5;
    const after = play(partiallyBlocked, 'stone_strike');
    expect(after.enemy.hp).toBe(498);
    expect(after.enemy.block).toBe(0);

    const fullyBlocked = fixture();
    fullyBlocked.enemy.block = 10;
    const protectedEnemy = play(fullyBlocked, 'stone_strike');
    expect(protectedEnemy.enemy.hp).toBe(500);
    expect(protectedEnemy.enemy.block).toBe(3);
  });

  it('resolves each hit separately against block, strength, and status modifiers', () => {
    const blocked = fixture(['pebble_rain']);
    blocked.enemy.block = 4;
    const after = play(blocked, 'pebble_rain');
    expect(after.enemy.hp).toBe(495);
    expect(after.enemy.block).toBe(0);

    const modified = fixture(['pebble_rain']);
    modified.player.strength = 2;
    modified.player.weak = 1;
    modified.enemy.vulnerable = 1;
    expect(play(modified, 'pebble_rain').enemy.hp).toBe(485);
  });

  it('applies player strength and both enemy debuffs from reusable card effects', () => {
    const before = fixture(['stone_training', 'shared_screen', 'stone_strike']);
    const trained = play(before, 'stone_training');
    expect(trained.player.strength).toBe(2);
    expect(trained.player.block).toBe(4);
    const exposed = play(trained, 'shared_screen');
    expect(exposed.enemy.weak).toBe(2);
    expect(exposed.enemy.vulnerable).toBe(1);
    expect(play(exposed, 'stone_strike').enemy.hp).toBe(487);
  });

  it('ticks enemy poison at enemy turn start, bypasses block, and loses one stack', () => {
    let state = play(fixture(['poison_moss']), 'poison_moss');
    expect(state.enemy.poison).toBe(5);
    expect(state.enemy.hp).toBe(500);
    state = passiveEnemy(state);
    state.enemy.block = 100;
    state = reduceCombat(state, { type: 'endTurn' });
    expect(state.enemy.hp).toBe(495);
    expect(state.enemy.poison).toBe(4);
  });

  it('ticks player poison at player turn start and bypasses block', () => {
    const state = passiveEnemy(fixture([]));
    state.player.poison = 4;
    state.player.block = 100;
    const after = reduceCombat(state, { type: 'endTurn' });
    expect(after.player.hp).toBe(76);
    expect(after.player.poison).toBe(3);
  });

  it('expires enemy debuffs after the enemy action, preserving their final active attack', () => {
    const state = fixture([]);
    state.enemy.weak = 1;
    state.enemy.vulnerable = 1;
    const after = reduceCombat(state, { type: 'endTurn' });
    expect(after.player.hp).toBe(71);
    expect(after.enemy.weak).toBe(0);
    expect(after.enemy.vulnerable).toBe(0);
  });
});

describe('じっと gauge and divine cards', () => {
  it('clamps the gauge to 0–100 without mutating its input', () => {
    const before = fixture();
    const filled = changeGauge(before, 150);
    expect(filled.jitto).toBe(100);
    expect(isDeified(filled)).toBe(true);
    expect(before.jitto).toBe(0);
    const emptied = changeGauge(filled, -200);
    expect(emptied.jitto).toBe(0);
    expect(isDeified(emptied)).toBe(false);
    expect(filled.jitto).toBe(100);
  });

  it.each([
    [90, 30, 100, 10],
    [10, -30, 0, -10],
  ])(
    'reports the signed, clamped gauge change from %i by %i',
    (initial, delta, final, actualChange) => {
      const before = fixture();
      before.jitto = initial;
      const snapshot = structuredClone(before);
      const after = changeGauge(before, delta);
      expect(after.jitto).toBe(final);
      expect(after.events.at(-1)).toMatchObject({
        kind: 'gauge',
        target: 'player',
        amount: actualChange,
      });
      expect(before).toEqual(snapshot);
    },
  );

  it.each([
    [49, 8],
    [50, 10],
    [100, 10],
  ])('gives the defense-card bonus at gauge %i: %i block', (gauge, block) => {
    const state = fixture(['still_guard']);
    state.jitto = gauge;
    expect(play(state, 'still_guard').player.block).toBe(block);
  });

  it('does not gain gauge merely by ending the turn', () => {
    const state = fixture([]);
    state.jitto = 49;
    expect(reduceCombat(state, { type: 'endTurn' }).jitto).toBe(49);
  });

  it('activates at exactly 100 and resolves the divine bonus before consuming gauge', () => {
    const state = fixture(['morning_chant', 'divine_fist']);
    state.jitto = 85;
    const divine = play(state, 'morning_chant');
    expect(isDeified(divine)).toBe(true);
    const after = play(divine, 'divine_fist');
    expect(after.enemy.hp).toBe(474);
    expect(after.jitto).toBe(70);
    expect(isDeified(after)).toBe(false);
  });

  it('does not grant a divine bonus at gauge 99', () => {
    const state = fixture(['divine_fist']);
    state.jitto = 99;
    const after = play(state, 'divine_fist');
    expect(after.enemy.hp).toBe(488);
    expect(after.jitto).toBe(69);
    expect(isDeified(after)).toBe(false);
  });
});

describe('upgrades and powers', () => {
  it('upgrades a card once while preserving its stable identity and original object', () => {
    const original: CardInstance = { uid: 'upgrade-test', cardId: 'stone_strike', upgraded: false };
    const upgraded = upgradeCard(original);
    expect(original.upgraded).toBe(false);
    expect(upgraded).toEqual({ ...original, upgraded: true });
    expect(upgradeCard(upgraded)).toEqual(upgraded);

    const state = fixture(['stone_strike']);
    state.hand[0] = upgradeCard(state.hand[0]);
    const after = play(state, 'stone_strike');
    expect(after.enemy.hp).toBe(490);
    expect(after.jitto).toBe(8);
  });

  it('resolves the upgraded divine bonus and reduced gauge cost', () => {
    const state = fixture(['divine_fist']);
    state.hand[0] = upgradeCard(state.hand[0]);
    state.jitto = 100;
    const after = play(state, 'divine_fist');
    expect(after.enemy.hp).toBe(466);
    expect(after.jitto).toBe(75);
  });

  it('removes a power from the draw cycle and triggers it once per later player turn', () => {
    const state = fixture(['stillness']);
    const powered = play(state, 'stillness');
    expect(powered.stillness).toBe(3);
    expect(powered.player.block).toBe(0);
    expect(powered.powers).toHaveLength(1);
    expect(powered.hand).toHaveLength(0);
    expect(powered.discardPile).toHaveLength(0);
    const next = reduceCombat(passiveEnemy(powered), { type: 'endTurn' });
    expect(next.player.block).toBe(3);
    const again = reduceCombat(passiveEnemy(next), { type: 'endTurn' });
    expect(again.player.block).toBe(3);
    expect(again.stillness).toBe(3);
    expect(again.hand).toHaveLength(0);
    expect(again.powers).toHaveLength(1);
    expect(zoneIds(again)).toEqual(zoneIds(state));
  });

  it('uses the upgraded power amount exactly once', () => {
    const state = fixture(['stillness']);
    state.hand[0] = upgradeCard(state.hand[0]);
    const powered = play(state, 'stillness');
    expect(powered.stillness).toBe(5);
    expect(reduceCombat(passiveEnemy(powered), { type: 'endTurn' }).player.block).toBe(5);
  });
});

describe('enemy intents and combat results', () => {
  it.each([0, 1, 2])('predicts the actual next attack with player vulnerability %i', (duration) => {
    const state = fixture([]);
    state.enemy.strength = 2;
    state.enemy.weak = 1;
    state.player.vulnerable = duration;
    const predicted = predictEnemyDamage(state);
    const after = reduceCombat(state, { type: 'endTurn' });
    expect(after.player.hp).toBe(state.player.hp - predicted);
  });

  it('predicts no incoming attack when poison will kill the enemy first', () => {
    const state = fixture([]);
    state.enemy.hp = 5;
    state.enemy.poison = 5;
    expect(predictEnemyDamage(state)).toBe(0);
    expect(reduceCombat(state, { type: 'endTurn' }).player.hp).toBe(80);
  });

  it('executes the advertised attack including its hit count and status modifiers', () => {
    let state = fixture([]);
    for (let index = 0; index < 2; index++) {
      const intent = state.enemy.intent;
      expect(intent.kind).toBe('attack');
      state.player.block = 5;
      state.enemy.strength = 2;
      state.enemy.weak = 1;
      const hp = state.player.hp;
      const perHit = calculateDamage(intent.damage ?? 0, state.enemy, state.player);
      const expectedHp = hp - Math.max(0, perHit * (intent.hits ?? 1) - 5);
      state = reduceCombat(state, { type: 'endTurn' });
      expect(state.player.hp).toBe(expectedHp);
    }
    expect(state.enemy.intent.kind).toBe('buff');
    const block = state.enemy.intent.block;
    const strengthBefore = state.enemy.strength;
    const strengthGain = state.enemy.intent.strength ?? 0;
    state = reduceCombat(state, { type: 'endTurn' });
    expect(state.enemy.block).toBe(block);
    expect(state.enemy.strength).toBe(strengthBefore + strengthGain);
  });

  it('wins when an attack kills the enemy and prevents later enemy actions', () => {
    const state = fixture(['stone_strike']);
    state.enemy.hp = 4;
    const after = play(state, 'stone_strike');
    expect(after.enemy.hp).toBe(0);
    expect(after.phase).toBe('victory');
    expect(after.player.hp).toBe(80);
    expect(reduceCombat(after, { type: 'endTurn' })).toEqual(after);
  });

  it('stops multi-hit attacks on death and records only actual HP damage', () => {
    const state = fixture(['pebble_rain']);
    state.enemy.hp = 2;
    const after = play(state, 'pebble_rain');
    expect(after.phase).toBe('victory');
    expect(after.stats.damageDealt).toBe(2);
    expect(
      after.events.filter((event) => event.target === 'enemy' && event.kind === 'damage'),
    ).toHaveLength(1);
    expect(zoneIds(after)).toEqual(zoneIds(state));
  });

  it('does not execute the enemy intent after lethal enemy poison', () => {
    const state = fixture([]);
    state.enemy.hp = 3;
    state.enemy.poison = 5;
    state.player.hp = 1;
    const after = reduceCombat(state, { type: 'endTurn' });
    expect(after.enemy.hp).toBe(0);
    expect(after.player.hp).toBe(1);
    expect(after.phase).toBe('victory');
  });

  it('loses immediately on lethal enemy damage', () => {
    const state = fixture(['morning_chant']);
    state.player.hp = 1;
    const after = reduceCombat(state, { type: 'endTurn' });
    expect(after.player.hp).toBe(0);
    expect(after.phase).toBe('defeat');
    expect(reduceCombat(after, { type: 'endTurn' })).toEqual(after);
  });

  it('loses on lethal player poison at the next player turn start', () => {
    const state = passiveEnemy(fixture([]));
    state.player.hp = 2;
    state.player.poison = 3;
    const after = reduceCombat(state, { type: 'endTurn' });
    expect(after.player.hp).toBe(0);
    expect(after.phase).toBe('defeat');
  });

  it('supports a full reproducible battle won through the public action API', () => {
    const priorities = [
      'morning_chant',
      'stillness',
      'poison_moss',
      'stone_training',
      'deep_breath',
      'divine_fist',
      'pebble_rain',
      'stone_strike',
      'still_guard',
      'shared_screen',
    ];
    const run = (): CombatState => {
      let state = createCombat('playable-battle');
      for (let action = 0; action < 150 && state.phase === 'player'; action++) {
        const playable = state.hand.filter((card) => canPlayCard(state, card.uid));
        playable.sort(
          (left, right) => priorities.indexOf(left.cardId) - priorities.indexOf(right.cardId),
        );
        state =
          playable.length > 0
            ? reduceCombat(state, { type: 'playCard', cardId: playable[0].uid })
            : reduceCombat(state, { type: 'endTurn' });
      }
      return state;
    };
    const result = run();
    expect(result.phase).toBe('victory');
    expect(result.player.hp).toBeGreaterThan(0);
    expect(result.enemy.hp).toBe(0);
    expect(result.stats.cardsPlayed).toBeGreaterThan(10);
    expect(run()).toEqual(result);
  });

  it('reaches defeat through legal turn-end actions if the player never acts', () => {
    let state = createCombat('inaction');
    for (let turn = 0; turn < 30 && state.phase === 'player'; turn++) {
      state = reduceCombat(state, { type: 'endTurn' });
    }
    expect(state.phase).toBe('defeat');
    expect(state.player.hp).toBe(0);
  });
});

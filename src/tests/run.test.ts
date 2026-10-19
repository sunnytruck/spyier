import { describe, expect, it } from 'vitest';
import {
  canChooseEvent,
  createRun,
  getAvailableNodes,
  reduceRun,
  SHOP_PRICES,
} from '../engine/run';
import type { RunAction, RunState } from '../types/run';
import { simulateRun } from './helpers/runDriver';

function room(screen: 'shop' | 'rest' | 'event' | 'reward' | 'relic' | 'upgrade'): RunState {
  return { ...createRun('room-fixture'), screen };
}

describe('run resources and legal screen transitions', () => {
  it('starts a reproducible run with a ten-card deck, healing potion, and starter relic', () => {
    const run = createRun('same-run');
    expect(run).toEqual(createRun('same-run'));
    expect(run.deck).toHaveLength(10);
    expect(new Set(run.deck.map((card) => card.uid)).size).toBe(10);
    expect(run.hp).toBe(80);
    expect(run.gold).toBe(90);
    expect(run.potions).toEqual(['spring_water', null, null]);
    expect(run.relicIds).toEqual(['warm_pebble']);
    expect(getAvailableNodes(run)).toHaveLength(3);
  });

  it('rejects missing, skipped-floor, disconnected, and repeated node selection', () => {
    const start = createRun('legal-map');
    expect(reduceRun(start, { type: 'chooseNode', nodeId: 'missing' })).toBe(start);
    const floorTwo = start.map.nodes.find((node) => node.floor === 2)!;
    expect(reduceRun(start, { type: 'chooseNode', nodeId: floorTwo.id })).toBe(start);
    const entered = reduceRun(start, {
      type: 'chooseNode',
      nodeId: getAvailableNodes(start)[0].id,
    });
    expect(entered.screen).toBe('combat');
    expect(getAvailableNodes(entered)).toEqual([]);
    expect(reduceRun(entered, { type: 'chooseNode', nodeId: floorTwo.id })).toBe(entered);
    expect(start.visited).toEqual([]);
  });

  it('prevents room, reward, shop, and combat actions on the wrong screen', () => {
    const run = createRun('wrong-screen');
    const actions: RunAction[] = [
      { type: 'buyRelic' },
      { type: 'buyPotion' },
      { type: 'takeRelic' },
      { type: 'takeCard', cardId: null },
      { type: 'rest', choice: 'heal' },
      { type: 'eventChoice', index: 0 },
      { type: 'leaveNode' },
      { type: 'usePotion', slot: 0 },
      { type: 'combat', action: { type: 'endTurn' } },
    ];
    for (const action of actions) expect(reduceRun(run, action)).toBe(run);
  });

  it('adds exactly one offered reward card with a new stable instance identity', () => {
    const state = room('reward');
    state.reward = {
      cardIds: ['bedrock_sweep', 'moss_fang', 'stone_rhythm'],
      gold: 20,
      relicId: null,
      potionId: null,
    };
    expect(reduceRun(state, { type: 'takeCard', cardId: 'not-offered' })).toBe(state);
    const after = reduceRun(state, { type: 'takeCard', cardId: 'bedrock_sweep' });
    expect(after.screen).toBe('map');
    expect(after.deck).toHaveLength(11);
    expect(new Set(after.deck.map((card) => card.uid)).size).toBe(11);
    expect(after.stats.cardsAdded).toBe(1);
    expect(reduceRun(after, { type: 'takeCard', cardId: 'bedrock_sweep' })).toBe(after);
  });

  it('allows skipping a card reward before claiming the elite relic once', () => {
    const state = room('reward');
    state.reward = { cardIds: ['bedrock_sweep'], gold: 45, relicId: 'first_vow', potionId: null };
    const skipped = reduceRun(state, { type: 'takeCard', cardId: null });
    expect(skipped.screen).toBe('relic');
    expect(skipped.deck).toHaveLength(10);
    const claimed = reduceRun(skipped, { type: 'takeRelic' });
    expect(claimed.relicIds).toEqual(['warm_pebble', 'first_vow']);
    expect(claimed.screen).toBe('map');
    expect(reduceRun(claimed, { type: 'takeRelic' })).toBe(claimed);
  });

  it('pays shop prices once, rejects unavailable cards, and preserves the previous state', () => {
    const state = room('shop');
    state.gold = 250;
    state.shop = {
      cardIds: ['bedrock_sweep'],
      relicId: 'gate_fragment',
      potionId: 'shale_tonic',
      purchased: [],
      removed: false,
    };
    const snapshot = structuredClone(state);
    expect(reduceRun(state, { type: 'buyCard', cardId: 'moss_fang' })).toBe(state);
    const card = reduceRun(state, { type: 'buyCard', cardId: 'bedrock_sweep' });
    expect(card.gold).toBe(250 - SHOP_PRICES.card);
    expect(card.deck).toHaveLength(11);
    expect(reduceRun(card, { type: 'buyCard', cardId: 'bedrock_sweep' })).toBe(card);
    const relic = reduceRun(card, { type: 'buyRelic' });
    expect(relic.gold).toBe(250 - SHOP_PRICES.card - SHOP_PRICES.relic);
    expect(relic.relicIds).toContain('gate_fragment');
    expect(reduceRun(relic, { type: 'buyRelic' })).toBe(relic);
    const potion = reduceRun(relic, { type: 'buyPotion' });
    expect(potion.potions).toEqual(['spring_water', 'shale_tonic', null]);
    expect(potion.gold).toBe(40);
    expect(reduceRun(potion, { type: 'buyPotion' })).toBe(potion);
    expect(state).toEqual(snapshot);
  });

  it('blocks unaffordable purchases, full potion belts, and repeated removals', () => {
    const state = room('shop');
    state.gold = 10;
    state.shop = {
      cardIds: ['bedrock_sweep'],
      relicId: 'gate_fragment',
      potionId: 'shale_tonic',
      purchased: [],
      removed: false,
    };
    expect(reduceRun(state, { type: 'buyCard', cardId: 'bedrock_sweep' })).toBe(state);
    expect(reduceRun(state, { type: 'buyRelic' })).toBe(state);
    expect(reduceRun(state, { type: 'removeCard', cardUid: state.deck[0].uid })).toBe(state);
    state.gold = 100;
    state.potions = ['spring_water', 'spring_water', 'spring_water'];
    expect(reduceRun(state, { type: 'buyPotion' })).toBe(state);
    const removed = reduceRun(state, { type: 'removeCard', cardUid: state.deck[0].uid });
    expect(removed.deck).toHaveLength(9);
    expect(removed.gold).toBe(40);
    expect(reduceRun(removed, { type: 'removeCard', cardUid: removed.deck[0].uid })).toBe(removed);
  });

  it('heals at a rest room within max HP and upgrades one card without changing its ID', () => {
    const state = room('rest');
    state.hp = 70;
    const healed = reduceRun(state, { type: 'rest', choice: 'heal' });
    expect(healed.hp).toBe(80);
    expect(healed.screen).toBe('map');
    const selecting = reduceRun(state, { type: 'rest', choice: 'upgrade' });
    expect(selecting.screen).toBe('upgrade');
    const original = selecting.deck[0];
    expect(reduceRun(selecting, { type: 'upgradeCard', cardUid: 'missing' })).toBe(selecting);
    const upgraded = reduceRun(selecting, { type: 'upgradeCard', cardUid: original.uid });
    expect(upgraded.deck[0]).toEqual({ ...original, upgraded: true });
    expect(upgraded.hp).toBe(70);
    expect(upgraded.screen).toBe('map');
  });

  it('allows canceling an upgrade selection back to the unspent rest room', () => {
    const state = room('rest');
    const selecting = reduceRun(state, { type: 'rest', choice: 'upgrade' });
    const canceled = reduceRun(selecting, { type: 'leaveNode' });
    expect(canceled.screen).toBe('rest');
    expect(canceled.deck.every((card) => !card.upgraded)).toBe(true);
  });

  it('requires an affordable nonlethal event choice and deterministically applies its reward', () => {
    const state = room('event');
    state.eventId = 'shared_altar';
    state.hp = 10;
    expect(canChooseEvent(state, 0)).toBe(false);
    expect(reduceRun(state, { type: 'eventChoice', index: 0 })).toBe(state);
    expect(canChooseEvent(state, 0.5)).toBe(false);
    expect(canChooseEvent(state, 999)).toBe(false);
    state.hp = 11;
    const after = reduceRun(state, { type: 'eventChoice', index: 0 });
    expect(after.hp).toBe(1);
    expect(after.relicIds).toHaveLength(2);
    expect(after).toEqual(reduceRun(state, { type: 'eventChoice', index: 0 }));
    expect(after.screen).toBe('map');
    expect(reduceRun(after, { type: 'eventChoice', index: 0 })).toBe(after);
  });

  it('rejects paid upgrades when funds or unupgraded cards are missing', () => {
    const state = room('event');
    state.eventId = 'morning_circle';
    state.gold = 34;
    expect(canChooseEvent(state, 0)).toBe(false);
    state.gold = 35;
    expect(canChooseEvent(state, 0)).toBe(true);
    state.deck = state.deck.map((card) => ({ ...card, upgraded: true }));
    expect(canChooseEvent(state, 0)).toBe(false);
  });

  it.each(['victory', 'defeat'] as const)(
    'prevents new actions after terminal run screen %s',
    (screen) => {
      const state = { ...createRun('finished'), screen };
      expect(reduceRun(state, { type: 'chooseNode', nodeId: state.map.nodes[0].id })).toBe(state);
      expect(reduceRun(state, { type: 'takeCard', cardId: null })).toBe(state);
      expect(reduceRun(state, { type: 'combat', action: { type: 'endTurn' } })).toBe(state);
    },
  );
});

describe('playable complete first-floor campaign', () => {
  it('reaches an actual defeat using only legal node and turn-end actions', () => {
    let state = createRun('do-nothing');
    state = reduceRun(state, { type: 'chooseNode', nodeId: getAvailableNodes(state)[0].id });
    for (let turn = 0; turn < 30 && state.screen === 'combat'; turn++)
      state = reduceRun(state, { type: 'combat', action: { type: 'endTurn' } });
    expect(state.screen).toBe('defeat');
    expect(state.hp).toBe(0);
  });

  it('can beat the twelve-floor tower through legal card, room, and reward actions', () => {
    const result = simulateRun('act1-balance-0');
    expect(result.screen).toBe('victory');
    expect(result.floor).toBe(12);
    expect(result.visited).toHaveLength(12);
    expect(result.hp).toBeGreaterThan(0);
    expect(result.stats.battlesWon).toBeGreaterThanOrEqual(4);
    expect(result.combat!.enemy.id).toBe('tower_abbot');
    expect(result.combat!.enemy.hp).toBe(0);
    expect(simulateRun('act1-balance-0')).toEqual(result);
  });

  it('compares strategic and random legal policies across fifty identical seeds', () => {
    const strategic = Array.from({ length: 50 }, (_, index) =>
      simulateRun(`act1-balance-${index}`, true),
    );
    const random = Array.from({ length: 50 }, (_, index) =>
      simulateRun(`act1-balance-${index}`, false),
    );
    const strategicWins = strategic.filter((run) => run.screen === 'victory').length;
    const randomWins = random.filter((run) => run.screen === 'victory').length;
    console.info(
      `Act 1 legal-policy balance sample: strategic ${strategicWins}/50 wins; random ${randomWins}/50 wins.`,
    );
    expect(strategic.every((run) => run.screen === 'victory' || run.screen === 'defeat')).toBe(
      true,
    );
    expect(random.every((run) => run.screen === 'victory' || run.screen === 'defeat')).toBe(true);
    expect(strategicWins).toBeGreaterThan(0);
    expect(strategicWins).toBeGreaterThan(randomWins);
  }, 30000);
});

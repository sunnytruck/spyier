import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS, LEGACY_CARD_IDS } from '../data/cards';
import { RELIC_DEFINITIONS } from '../data/relics';
import { POTION_DEFINITIONS } from '../data/potions';
import {
  canPlayCard,
  createCombat,
  getCardCost,
  getEnemies,
  getEnemyKey,
  predictEnemyDamage,
  reduceCombat,
} from '../engine';
import type { CardInstance, CombatState } from '../types/game';

function fixture(cards: string[], ids = ['grit_scout', 'candle_moth']): CombatState {
  const deck: CardInstance[] = cards.map((cardId, index) => ({
    uid: `test-${index}`,
    cardId,
    upgraded: false,
  }));
  const state = createCombat('multiple-enemies', ids, { deck });
  state.hand = deck;
  state.drawPile = [];
  return state;
}

function play(state: CombatState, cardId: string, targetId?: string): CombatState {
  const card = state.hand.find((card) => card.cardId === cardId);
  if (!card) throw new Error(`Missing fixture card ${cardId}`);
  return reduceCombat(state, { type: 'playCard', cardId: card.uid, targetId });
}

describe('multiple independently targeted enemies', () => {
  it('rejects empty, oversized, and unknown encounter definitions', () => {
    expect(() => createCombat('bad', [])).toThrow(RangeError);
    expect(() => createCombat('bad', Array(4).fill('grit_scout'))).toThrow(RangeError);
    expect(() => createCombat('bad', 'missing-enemy')).toThrow(RangeError);
  });

  it('gives identical enemy definitions unique target identities', () => {
    const state = createCombat('twins', ['grit_scout', 'grit_scout']);
    expect(getEnemies(state)).toHaveLength(2);
    expect(new Set(getEnemies(state).map(getEnemyKey)).size).toBe(2);
  });

  it('selects the second enemy without damaging the first or mutating the input', () => {
    const before = fixture(['stone_strike']);
    const snapshot = structuredClone(before);
    const second = getEnemyKey(getEnemies(before)[1]);
    const selected = reduceCombat(before, { type: 'selectEnemy', targetId: second });
    const after = play(selected, 'stone_strike');
    expect(getEnemies(after).map((enemy) => enemy.hp)).toEqual([28, 17]);
    expect(after.selectedEnemyId).toBe(second);
    expect(before).toEqual(snapshot);
  });

  it('does not spend energy/cards/potions when explicitly targeting unknown or dead enemies', () => {
    const state = fixture(['stone_strike']);
    state.potions = ['magma_flask'];
    const uid = state.hand[0].uid;
    expect(canPlayCard(state, uid, 'missing')).toBe(false);
    expect(reduceCombat(state, { type: 'playCard', cardId: uid, targetId: 'missing' })).toBe(state);
    expect(reduceCombat(state, { type: 'selectEnemy', targetId: 'missing' })).toBe(state);
    expect(reduceCombat(state, { type: 'usePotion', slot: 0, targetId: 'missing' })).toBe(state);
    getEnemies(state)[0].hp = 0;
    expect(canPlayCard(state, uid, getEnemyKey(getEnemies(state)[0]))).toBe(false);
  });

  it('changes the selected target after a kill, winning only when every enemy dies', () => {
    let state = fixture(['stone_strike', 'stone_strike']);
    getEnemies(state)[0].hp = 7;
    getEnemies(state)[1].hp = 7;
    const second = getEnemyKey(getEnemies(state)[1]);
    state = play(state, 'stone_strike');
    expect(state.phase).toBe('player');
    expect(state.selectedEnemyId).toBe(second);
    state = play(state, 'stone_strike');
    expect(state.phase).toBe('victory');
    expect(getEnemies(state).every((enemy) => enemy.hp === 0)).toBe(true);
  });

  it('applies full-area attacks independently to each enemy block and vulnerability', () => {
    const state = fixture(['bedrock_sweep']);
    getEnemies(state)[0].block = 2;
    getEnemies(state)[1].vulnerable = 1;
    const after = play(state, 'bedrock_sweep');
    expect(getEnemies(after).map((enemy) => enemy.hp)).toEqual([24, 15]);
    expect(
      after.events.filter((event) => event.kind === 'damage').map((event) => event.enemyId),
    ).toEqual(getEnemies(state).map(getEnemyKey));
  });

  it('predicts each advertised action and resolves the shared block once across enemies', () => {
    const state = fixture([]);
    state.player.block = 6;
    const incoming = getEnemies(state).reduce(
      (sum, enemy) =>
        sum + predictEnemyDamage(state, getEnemyKey(enemy)) * (enemy.intent.hits ?? 1),
      0,
    );
    const after = reduceCombat(state, { type: 'endTurn' });
    expect(after.player.hp).toBe(80 - Math.max(0, incoming - 6));
    expect(getEnemies(after).map((enemy) => enemy.intentIndex)).toEqual([1, 1]);
  });

  it('skips a dead enemy action and keeps the surviving enemy action', () => {
    const state = fixture([]);
    getEnemies(state)[0].hp = 0;
    const after = reduceCombat(state, { type: 'endTurn' });
    expect(after.player.hp).toBe(76);
    expect(after.phase).toBe('player');
    expect(getEnemies(after)[0].intentIndex).toBe(0);
    expect(getEnemies(after)[1].intentIndex).toBe(1);
  });

  it('lets all-area poison kill every enemy before any action without touching block', () => {
    let state = fixture(['spore_bloom']);
    for (const enemy of getEnemies(state)) {
      enemy.hp = 4;
      enemy.block = 100;
    }
    state = play(state, 'spore_bloom');
    const after = reduceCombat(state, { type: 'endTurn' });
    expect(after.phase).toBe('victory');
    expect(after.player.hp).toBe(80);
    expect(getEnemies(after).every((enemy) => enemy.hp === 0)).toBe(true);
  });
});

describe('strategic card order, upgrades, and one-battle powers', () => {
  it('rewards applying strength before multi-hit attacks', () => {
    const original = fixture(['stone_training', 'gravel_jabs']);
    const setupFirst = play(play(original, 'stone_training'), 'gravel_jabs');
    const attackFirst = play(play(original, 'gravel_jabs'), 'stone_training');
    expect(getEnemies(attackFirst)[0].hp - getEnemies(setupFirst)[0].hp).toBe(4);
  });

  it('rewards gaining block before a block-based attack without consuming the block', () => {
    const original = fixture(['still_guard', 'bastion_ram']);
    const defended = play(play(original, 'still_guard'), 'bastion_ram');
    const early = play(play(original, 'bastion_ram'), 'still_guard');
    expect(getEnemies(early)[0].hp - getEnemies(defended)[0].hp).toBe(8);
    expect(defended.player.block).toBe(8);
  });

  it('doubles existing poison only on the selected enemy and exhausts the multiplier', () => {
    const state = fixture(['poison_moss', 'poison_rite']);
    const target = getEnemyKey(getEnemies(state)[1]);
    const after = play(play(state, 'poison_moss', target), 'poison_rite', target);
    expect(getEnemies(after).map((enemy) => enemy.poison)).toEqual([0, 10]);
    expect(after.exhaustPile.map((card) => card.cardId)).toEqual(['poison_rite']);
    expect(after.discardPile.map((card) => card.cardId)).toEqual(['poison_moss']);
  });

  it('uses upgraded cost and cannot reshuffle an exhausted energy card', () => {
    const state = fixture(['altar_reserve', 'stone_rhythm']);
    state.hand[1].upgraded = true;
    expect(getCardCost(state.hand[1])).toBe(1);
    let after = play(play(state, 'altar_reserve'), 'stone_rhythm');
    expect(after.energy).toBe(4);
    after = reduceCombat(after, { type: 'endTurn' });
    expect(after.exhaustPile.map((card) => card.cardId)).toEqual(['altar_reserve']);
    expect(after.powers.map((card) => card.cardId)).toEqual(['stone_rhythm']);
    expect(after.hand).toEqual([]);
  });

  it('activates growth, poison aura, and extra draw exactly at later player starts', () => {
    const state = fixture([
      'battle_liturgy',
      'moss_garden',
      'stone_rhythm',
      'stone_strike',
      'still_guard',
      'gravel_jabs',
      'dust_feint',
    ]);
    state.energy = 4;
    let after = play(play(play(state, 'battle_liturgy'), 'moss_garden'), 'stone_rhythm');
    expect(after.player.strength).toBe(0);
    expect(getEnemies(after).map((enemy) => enemy.poison)).toEqual([0, 0]);
    after = reduceCombat(after, { type: 'endTurn' });
    expect(after.player.strength).toBe(2);
    expect(getEnemies(after).map((enemy) => enemy.poison)).toEqual([2, 2]);
    expect(after.hand).toHaveLength(4);
    expect(after.powers).toHaveLength(3);
  });

  it('grants attack-triggered block once per card, including multi-hit attacks', () => {
    let state = fixture(['zealous_shell', 'gravel_jabs']);
    state = play(play(state, 'zealous_shell'), 'gravel_jabs');
    expect(state.player.block).toBe(2);
    expect(state.powerStacks?.blockOnAttack).toBe(2);
  });

  it('retaliates per hit even against fully blocked attacks and stops a dead attacker', () => {
    const state = fixture(['thorn_shrine'], ['restless_guardian']);
    state.enemy.hp = 5;
    state.enemy.intent = {
      kind: 'attack',
      label: '二連撃',
      description: '6を2回',
      damage: 6,
      hits: 2,
    };
    state.player.block = 100;
    const after = reduceCombat(play(state, 'thorn_shrine'), { type: 'endTurn' });
    expect(after.phase).toBe('victory');
    expect(after.player.hp).toBe(80);
    expect(after.enemy.hp).toBe(0);
  });
});

describe('finite consumables and relic trigger counts', () => {
  it('consumes a potion once without spending card energy', () => {
    const state = fixture([]);
    state.potions = ['magma_flask', null];
    const targetId = getEnemyKey(getEnemies(state)[1]);
    const after = reduceCombat(state, { type: 'usePotion', slot: 0, targetId });
    expect(after.energy).toBe(3);
    expect(getEnemies(after).map((enemy) => enemy.hp)).toEqual([28, 4]);
    expect(after.potions).toEqual([null, null]);
    expect(reduceCombat(after, { type: 'usePotion', slot: 0, targetId })).toBe(after);
  });

  it('preserves a healing potion at full HP and rejects invalid slots', () => {
    const state = fixture([]);
    state.potions = ['spring_water'];
    for (const slot of [-1, 0, 0.5, 99])
      expect(reduceCombat(state, { type: 'usePotion', slot })).toBe(state);
    state.player.hp = 70;
    const after = reduceCombat(state, { type: 'usePotion', slot: 0 });
    expect(after.player.hp).toBe(80);
    expect(after.potions).toEqual([null]);
  });

  it('applies a poison potion to all enemies instead of the selected target only', () => {
    const state = fixture([]);
    state.potions = ['moss_mist'];
    const after = reduceCombat(state, { type: 'usePotion', slot: 0 });
    expect(getEnemies(after).map((enemy) => enemy.poison)).toEqual([4, 4]);
  });

  it('fires combat-start, per-turn, and first-attack relics exactly as described', () => {
    const state = createCombat('relic-timing', 'quarry_crab', {
      relicIds: ['prayer_knuckle', 'morning_bell', 'first_vow', 'first_vow'],
      deck: ['stone_strike', 'stone_strike'].map((cardId, index) => ({
        uid: `relic-${index}`,
        cardId,
        upgraded: false,
      })),
    });
    expect(state.player.strength).toBe(1);
    expect(state.jitto).toBe(5);
    let after = play(play(state, 'stone_strike'), 'stone_strike');
    expect(after.player.strength).toBe(3);
    expect(after.relicCounters?.first_vow).toBe(1);
    after = reduceCombat(after, { type: 'endTurn' });
    expect(after.jitto).toBe(20);
    expect(after.relicCounters?.morning_bell).toBe(2);
    expect(after.relicCounters?.prayer_knuckle).toBe(1);
  });

  it('heals once after the final enemy dies, never after an intermediate kill', () => {
    let state = fixture(['stone_strike', 'stone_strike']);
    state.player.hp = 60;
    state.relicIds = ['warm_pebble'];
    for (const enemy of getEnemies(state)) enemy.hp = 7;
    state = play(state, 'stone_strike');
    expect(state.player.hp).toBe(60);
    state = play(state, 'stone_strike');
    expect(state.player.hp).toBe(64);
    expect(state.relicCounters?.warm_pebble).toBe(1);
    expect(reduceCombat(state, { type: 'endTurn' })).toBe(state);
  });

  it('keeps the original content catalog independently addressable with its original counts', () => {
    const cards = LEGACY_CARD_IDS.map((id) => CARD_DEFINITIONS[id]);
    expect(cards.filter((card) => card.type === 'attack')).toHaveLength(12);
    expect(cards.filter((card) => card.type === 'skill')).toHaveLength(12);
    expect(cards.filter((card) => card.type === 'power')).toHaveLength(6);
    expect(Object.keys(RELIC_DEFINITIONS)).toHaveLength(10);
    expect(Object.keys(POTION_DEFINITIONS)).toHaveLength(5);
  });
});

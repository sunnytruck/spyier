import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import { canPlayCard, createCombat, getEnemies, reduceCombat } from '../engine';
import { getPendingChoiceCards, getPendingChoiceLabel } from '../engine/actions/choices';
import { resolveEffects } from '../engine/effects/resolve';
import { deserializeGame, serializeGame } from '../engine/persistence';
import { captureCombatTransition } from '../presentation/trace';
import { cardTargetMode, resolveCardDrop } from '../presentation/targeting';
import type { CardInstance, ClassId, CombatState } from '../types/game';

function fixture(cardId: string, upgraded = false, enemies: string[] = ['grit_scout']): CombatState {
  const definition = CARD_DEFINITIONS[cardId];
  const classId: ClassId = definition.classId && definition.classId !== 'colorless' ? definition.classId : 'berserker';
  const source = { uid: 'source', cardId, upgraded };
  const filler: CardInstance[] = Array.from({ length: 20 }, (_, index) => ({ uid: `filler-${index}`, cardId: 'stone_strike', upgraded: false }));
  const state = createCombat('new-engine-edge-cases', enemies, { deck: [source, ...filler], classId });
  state.hand = [source, ...filler.slice(0, 3)];
  state.drawPile = filler.slice(3, 13);
  state.discardPile = filler.slice(13);
  state.exhaustPile = [];
  state.powers = [];
  state.energy = 20;
  state.player.block = 0;
  for (const enemy of getEnemies(state)) {
    enemy.hp = enemy.maxHp = 1000;
    enemy.block = enemy.poison = 0;
    enemy.intent = { kind: 'attack', label: '確認用の空振り', description: '0ダメージ。', damage: 0 };
  }
  return state;
}

const play = (state: CombatState) => reduceCombat(state, { type: 'playCard', cardId: 'source' });
const finishTurn = (state: CombatState) => reduceCombat(state, { type: 'endTurn' });

describe('seeded multi-hit, paid-X and dynamic quantities', () => {
  it('random hits retarget living enemies and consume no extra RNG after victory', () => {
    const state = fixture('berserker_boomerang', false, ['grit_scout', 'candle_moth']);
    getEnemies(state).forEach((enemy) => { enemy.hp = 3; });
    const captured = captureCombatTransition(state, () => play(state));
    const impacts = captured.cues.filter((cue) => cue.kind === 'impact');
    expect(impacts).toHaveLength(2);
    expect(new Set(impacts.map((cue) => cue.targetId)).size).toBe(2);
    expect(captured.result.phase).toBe('victory');
    expect(captured.result.stats.damageDealt).toBe(6);
    expect(play(state)).toEqual(captured.result);
  });

  it.each([[0, 0], [3, 3], [4, 8], [5, 10]])('heavenly X=%i resolves %i paid hits', (energy, hits) => {
    const state = fixture('oracle_heavenly_drill');
    state.energy = energy;
    const captured = captureCombatTransition(state, () => play(state));
    expect(captured.result.energy).toBe(0);
    expect(captured.cues.filter((cue) => cue.kind === 'impact')).toHaveLength(hits);
    expect(captured.result.enemy.hp).toBe(1000 - hits * 8);
    if (energy === 0) expect(captured.result.rngState).toBe(state.rngState);
  });

  it('negative hand scaling cannot heal the enemy and excludes the played source', () => {
    const state = fixture('assassin_focused_blade');
    state.hand.push(...state.drawPile.splice(0, 5));
    const next = play(state);
    expect(next.hand).toHaveLength(8);
    expect(next.enemy.hp).toBe(1000);
    expect(next.stats.damageDealt).toBe(0);
  });

  it('all-target scaling and hit conditions inspect each enemy independently', () => {
    const state = fixture('stone_strike', false, ['grit_scout', 'candle_moth']);
    getEnemies(state)[1].vulnerable = 2;
    resolveEffects(state, [{ type: 'damage', amount: 4, all: true,
      bonusPer: { value: 'enemyVulnerable', multiplier: 2 },
      hitsIf: { condition: { type: 'targetStatus', status: 'vulnerable' }, extra: 1 } }]);
    expect(getEnemies(state).map((enemy) => enemy.hp)).toEqual([996, 976]);
  });

  it('poison-based block excludes fallen enemies and receives the existing defense bonus', () => {
    const state = fixture('assassin_mirage', false, ['grit_scout', 'candle_moth']);
    state.jitto = 50;
    getEnemies(state)[0].poison = 7;
    getEnemies(state)[1].hp = 0;
    getEnemies(state)[1].poison = 100;
    expect(play(state).player.block).toBe(9);
  });

  it('a zero-orb barrage has zero hits even with player strength', () => {
    const state = fixture('stone_strike');
    state.player.strength = 50;
    resolveEffects(state, [{ type: 'damage', amount: 4, hitsPer: 'orbCount' }]);
    expect(state.enemy.hp).toBe(1000);
    state.classResources!.orbs = ['lightning', 'frost', 'lightning'];
    resolveEffects(state, [{ type: 'damage', amount: 4, hitsPer: 'orbCount' }]);
    expect(state.enemy.hp).toBe(838);
  });
});

describe('temporary effects survive the enemy action and expire once', () => {
  it('temporary thorns adds to permanent thorns, responds per hit, then removes only its own stacks', () => {
    const state = fixture('berserker_flame_barrier');
    state.powerStacks = { thorns: 2 };
    state.enemy.intent = { kind: 'attack', label: '二連打', description: '2×2。', damage: 2, hits: 2 };
    const next = finishTurn(play(state));
    expect(next.enemy.hp).toBe(988);
    expect(next.powerStacks?.thorns).toBe(2);
    expect(next.turnModifiers).toBeUndefined();
  });

  it('temporary attack-block preserves permanent attack-block after expiry', () => {
    const state = fixture('berserker_rage');
    state.powerStacks = { blockOnAttack: 1 };
    const active = play(state);
    const attacked = reduceCombat(active, { type: 'playCard', cardId: 'filler-0' });
    expect(attacked.player.block).toBe(4);
    const next = finishTurn(attacked);
    expect(next.powerStacks?.blockOnAttack).toBe(1);
    expect(next.turnModifiers).toBeUndefined();
  });

  it('signed temporary enemy strength changes actual attack, then restores its prior value', () => {
    const state = fixture('stone_strike');
    state.enemy.intent = { kind: 'attack', label: '拳', description: '4ダメージ。', damage: 4 };
    resolveEffects(state, [{ type: 'temporaryStatus', target: 'enemy', status: 'strength', amount: -2, allowNegative: true }]);
    expect(state.enemy.strength).toBe(-2);
    const restored = deserializeGame(serializeGame(state))!;
    expect(restored.enemy.strength).toBe(-2);
    const next = finishTurn(restored);
    expect(next.player.hp).toBe(78);
    expect(next.enemy.strength).toBe(0);
  });

  it('restoring temporary player strength preserves a later permanent increase', () => {
    const state = fixture('berserker_setup_strike');
    state.player.strength = 5;
    const active = play(state);
    resolveEffects(active, [{ type: 'status', target: 'player', status: 'strength', amount: 2 }]);
    const loaded = deserializeGame(serializeGame(active))!;
    expect(loaded.player.strength).toBe(9);
    expect(finishTurn(loaded).player.strength).toBe(7);
  });
});

describe('scheduled effects, drawing and resource operations', () => {
  it('queued stars survive saving and fire after the per-turn star count resets, only once', () => {
    const state = fixture('oracle_hidden_wealth');
    state.classResources!.stars = 5;
    state.classResources!.starsGainedThisTurn = 4;
    const active = play(state);
    expect(active.classResources!.stars).toBe(6);
    const loaded = deserializeGame(serializeGame(active))!;
    expect(loaded).toEqual(active);
    const next = finishTurn(loaded);
    expect(next.classResources!.stars).toBe(9);
    expect(next.classResources!.starsGainedThisTurn).toBe(3);
    expect(next.scheduledEffects).toBeUndefined();
    expect(finishTurn(next).classResources!.stars).toBe(9);
  });

  it('queued block is gained after clearing prior-turn block and is not replayed after load', () => {
    const state = fixture('assassin_dodge_roll');
    const active = play(state);
    expect(active.player.block).toBe(4);
    const next = finishTurn(deserializeGame(serializeGame(active))!);
    expect(next.player.block).toBe(4);
    const afterReload = finishTurn(deserializeGame(serializeGame(next))!);
    expect(afterReload.player.block).toBe(0);
  });

  it('redraw does not redraw its still-resolving source even when the draw pile is empty', () => {
    const state = fixture('assassin_gamble');
    state.discardPile.push(...state.drawPile);
    state.drawPile = [];
    const next = play(state);
    expect(next.hand).toHaveLength(3);
    expect(next.hand.some((card) => card.uid === 'source')).toBe(false);
    expect(next.exhaustPile.filter((card) => card.uid === 'source')).toHaveLength(1);
    expect(next.rngState).not.toBe(state.rngState);
  });

  it('draw-to never discards an oversized hand or consumes RNG without a draw', () => {
    const state = fixture('assassin_expertise');
    state.hand.push(...state.drawPile.splice(0, 5));
    const next = play(state);
    expect(next.hand).toHaveLength(8);
    expect(next.rngState).toBe(state.rngState);
  });

  it('random exhaust with no eligible card consumes no RNG and preserves all zones', () => {
    const state = fixture('stone_strike');
    state.discardPile.push(...state.hand);
    state.hand = [];
    const before = structuredClone(state);
    resolveEffects(state, [{ type: 'exhaustRandom', amount: 1 }]);
    expect(state).toEqual(before);
  });

  it('energy multiplication uses current energy and stays within the save validator numeric range', () => {
    const state = fixture('stone_strike');
    state.energy = 750_000;
    resolveEffects(state, [{ type: 'multiply', resource: 'energy', amount: 2 }]);
    expect(state.energy).toBe(1_000_000);
    expect(deserializeGame(serializeGame(state))?.energy).toBe(1_000_000);
  });

  it('evoke-all resolves rightmost-first and stops when the battle ends', () => {
    const state = fixture('stone_strike');
    state.classResources!.orbs = ['frost', 'lightning', 'frost'];
    state.classResources!.focus = 2;
    const captured = captureCombatTransition(state, () => resolveEffects(state, [{ type: 'evoke', times: 1, all: true }]));
    expect(captured.cues.filter((cue) => cue.resourceAction === 'remove').map((cue) => [cue.orbIndex, cue.resource])).toEqual([[2, 'frost'], [1, 'lightning'], [0, 'frost']]);
    expect(state.player.block).toBe(14);
    expect(state.enemy.hp).toBe(990);
    expect(state.classResources!.orbs).toEqual([]);
  });
});

describe('zone-aware interactive continuations', () => {
  it('a conditional poison card supports enemy targeting before its condition is met', () => {
    const state = fixture('assassin_bubble', false, ['grit_scout', 'candle_moth']);
    const source = state.hand[0];
    const definition = CARD_DEFINITIONS[source.cardId];
    expect(cardTargetMode(definition)).toBe('enemy');
    expect(resolveCardDrop(state, source, { inArena: true, overPlayer: true }).valid).toBe(false);
    const enemy = getEnemies(state)[1];
    enemy.poison = 3;
    const result = resolveCardDrop(state, source, { inArena: true, enemyId: enemy.instanceId });
    expect(result.valid).toBe(true);
    const next = reduceCombat(state, { type: 'playCard', cardId: source.uid, targetId: result.targetId });
    expect(getEnemies(next).map((actor) => actor.poison)).toEqual([0, 12]);
  });

  it('a random attack may be dropped in the arena without a manually chosen enemy', () => {
    const state = fixture('berserker_boomerang');
    expect(cardTargetMode(CARD_DEFINITIONS.berserker_boomerang)).toBe('self');
    expect(resolveCardDrop(state, state.hand[0], { inArena: true, overPlayer: true }).valid).toBe(true);
  });

  it('discard-to-topdeck saves its exact candidate pool, rejects unrelated cards, and settles the source once', () => {
    const state = fixture('oracle_cosmic_indifference');
    const active = play(state);
    expect(active.pendingChoice?.mode).toBe('topdeck');
    expect(getPendingChoiceCards(active).map((card) => card.uid)).toEqual(state.discardPile.map((card) => card.uid));
    expect(getPendingChoiceLabel(active)).toContain('捨て札');
    expect(canPlayCard(active, 'filler-0')).toBe(false);
    expect(reduceCombat(active, { type: 'chooseCards', cardIds: ['filler-0'] })).toBe(active);
    const restored = deserializeGame(serializeGame(active))!;
    expect(restored).toEqual(active);
    const uid = state.discardPile[0].uid;
    const next = reduceCombat(restored, { type: 'chooseCards', cardIds: [uid] });
    expect(next.drawPile.at(-1)?.uid).toBe(uid);
    expect(next.discardPile.filter((card) => card.uid === 'source')).toHaveLength(1);
    expect(next.pendingChoice).toBeUndefined();
    expect(reduceCombat(next, { type: 'chooseCards', cardIds: [uid] })).toBe(next);
  });

  it('nested conditional choices retain the outer continuation without executing it early or twice', () => {
    const state = fixture('stone_strike');
    resolveEffects(state, [
      { type: 'conditional', condition: { type: 'cardsPlayedAtMost', amount: 0 }, effects: [{ type: 'discard', amount: 1 }, { type: 'energy', amount: 2 }] },
      { type: 'energy', amount: 3 },
    ], { defense: false }, { sourceCard: state.hand.shift()! });
    expect(state.energy).toBe(20);
    expect(state.pendingChoice?.resume.effects).toEqual([{ type: 'energy', amount: 2 }, { type: 'energy', amount: 3 }]);
    const next = reduceCombat(state, { type: 'chooseCards', cardIds: ['filler-0'] });
    expect(next.energy).toBe(25);
    expect(next.pendingChoice).toBeUndefined();
    expect(next.discardPile.filter((card) => card.uid === 'source')).toHaveLength(1);
  });

  it('a lone topdeck candidate moves automatically and allows subsequent effects', () => {
    const state = fixture('stone_strike');
    state.drawPile.push(...state.hand.splice(1));
    const uid = state.hand[0].uid;
    resolveEffects(state, [{ type: 'moveChoice', from: 'hand', to: 'drawPile', amount: 1 }, { type: 'energy', amount: 2 }]);
    expect(state.drawPile.at(-1)?.uid).toBe(uid);
    expect(state.energy).toBe(22);
    expect(state.pendingChoice).toBeUndefined();
  });
});

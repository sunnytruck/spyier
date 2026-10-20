import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import { CLASS_IDS } from '../data/classes';
import { eligibleRelicIds, EXPANSION_RELIC_IDS, isRelicEligible, LEGACY_RELIC_IDS, RELIC_DEFINITIONS } from '../data/relics';
import { createCombat, getEnemies, getEnemyKey, reduceCombat } from '../engine';
import { triggerRelics, type RelicContext } from '../engine/combat/relics';
import { deserializeGame, serializeGame } from '../engine/persistence';
import type { ClassId, CombatState } from '../types/game';

function fixture(relicIds: string[], cards = ['stone_strike', 'stone_strike', 'still_guard', 'still_guard', 'stone_strike'], classId?: ClassId, hp = 80): CombatState {
  return createCombat('relic-expansion', 'restless_guardian', {
    relicIds, hp, classId,
    deck: cards.map((cardId, index) => ({ uid: `relic-card-${index}`, cardId, upgraded: false })),
  });
}

function play(state: CombatState, cardId: string): CombatState {
  const card = state.hand.find((card) => card.cardId === cardId);
  expect(card).toBeDefined();
  const result = reduceCombat(state, { type: 'playCard', cardId: card!.uid });
  expect(result).not.toBe(state);
  return result;
}

describe('expanded relic catalog and class acquisition restrictions', () => {
  it('adds 20 working definitions while retaining all 10 legacy IDs', () => {
    expect(LEGACY_RELIC_IDS).toHaveLength(10);
    expect(EXPANSION_RELIC_IDS).toHaveLength(20);
    expect(EXPANSION_RELIC_IDS.filter((id) => !RELIC_DEFINITIONS[id].classId)).toHaveLength(15);
    expect(new Set(EXPANSION_RELIC_IDS)).toHaveProperty('size', 20);
    for (const id of EXPANSION_RELIC_IDS) {
      expect(RELIC_DEFINITIONS[id].id).toBe(id);
      expect(RELIC_DEFINITIONS[id].name).not.toHaveLength(0);
      expect(RELIC_DEFINITIONS[id].description).not.toHaveLength(0);
      expect(RELIC_DEFINITIONS[id].effect.amount).toBeGreaterThan(0);
    }
  });

  it.each(CLASS_IDS)('%s retains the original 26 eligible relics and only accepts matching new class relics', (classId) => {
    const ids = eligibleRelicIds(classId);
    const originalIds = [...LEGACY_RELIC_IDS, ...EXPANSION_RELIC_IDS];
    expect(ids.filter((id) => originalIds.includes(id))).toHaveLength(26);
    expect(ids.length).toBeGreaterThan(26);
    expect(ids.every((id) => !RELIC_DEFINITIONS[id].classId || RELIC_DEFINITIONS[id].classId === classId)).toBe(true);
    for (const id of EXPANSION_RELIC_IDS.filter((id) => RELIC_DEFINITIONS[id].classId))
      expect(isRelicEligible(id, classId)).toBe(RELIC_DEFINITIONS[id].classId === classId);
  });

  it('never offers class relics to legacy runs, and rejects unknown IDs safely', () => {
    const originalIds = [...LEGACY_RELIC_IDS, ...EXPANSION_RELIC_IDS];
    expect(eligibleRelicIds().filter((id) => originalIds.includes(id))).toHaveLength(25);
    expect(eligibleRelicIds().every((id) => !RELIC_DEFINITIONS[id].classId)).toBe(true);
    for (const id of ['unknown', 'toString', '__proto__']) expect(isRelicEligible(id)).toBe(false);
    const before = eligibleRelicIds();
    const copy = eligibleRelicIds();
    copy.length = 0;
    expect(eligibleRelicIds()).toEqual(before);
  });

  it.each(CLASS_IDS)('ignores other classes’ relic effects even if manually inserted into %s', (classId) => {
    const otherIds = EXPANSION_RELIC_IDS.filter((id) => RELIC_DEFINITIONS[id].classId && RELIC_DEFINITIONS[id].classId !== classId);
    const state = fixture(otherIds, ['stone_strike'], classId);
    expect(state.relicCounters).toEqual({});
    expect(state.classResources?.stars).toBe(0);
    expect(state.classResources?.ostyHp).toBe(0);
    expect(state.classResources?.orbs).toEqual([]);
  });
});

describe('neutral relics resolve the effects written in their descriptions', () => {
  it('applies startup weak, vulnerable and poison to every living enemy once', () => {
    const state = createCombat('relic-group', ['grit_scout', 'candle_moth'], {
      relicIds: ['ember_lens', 'moss_vial', 'stone_mask'],
    });
    expect(getEnemies(state).map((enemy) => [enemy.weak, enemy.vulnerable, enemy.poison])).toEqual([[1, 1, 2], [1, 1, 2]]);
    triggerRelics(state, 'combatStart');
    expect(getEnemies(state).map((enemy) => [enemy.weak, enemy.vulnerable, enemy.poison])).toEqual([[1, 1, 2], [1, 1, 2]]);
    expect(state.relicCounters?.ember_lens).toBe(1);
  });

  it('only grants low-HP startup strength and per-turn block below the stated threshold', () => {
    const low = fixture(['dawn_censer', 'cracked_sandal'], undefined, undefined, 40);
    expect([low.player.strength, low.player.block]).toEqual([2, 3]);
    const high = fixture(['dawn_censer', 'cracked_sandal'], undefined, undefined, 41);
    expect([high.player.strength, high.player.block]).toEqual([0, 0]);
    low.player.block = 0;
    low.turn += 1;
    triggerRelics(low, 'turnStart');
    expect(low.player.block).toBe(3);
    expect(low.relicCounters?.cracked_sandal).toBe(2);
  });

  it('grants second-turn energy and third-turn draw, each exactly on the written turn', () => {
    const cards = Array.from({ length: 25 }, () => 'stone_strike');
    let state = fixture(['waking_hourglass', 'amber_hourglass'], cards);
    expect(state.energy).toBe(3);
    state = reduceCombat(state, { type: 'endTurn' });
    expect(state.turn).toBe(2);
    expect(state.energy).toBe(4);
    expect(state.hand).toHaveLength(5);
    state = reduceCombat(state, { type: 'endTurn' });
    expect(state.turn).toBe(3);
    expect(state.energy).toBe(3);
    expect(state.hand).toHaveLength(7);
    state = reduceCombat(state, { type: 'endTurn' });
    expect(state.hand).toHaveLength(5);
    expect(state.relicCounters?.waking_hourglass).toBe(1);
    expect(state.relicCounters?.amber_hourglass).toBe(1);
  });

  it('draws on the third played card only once per turn', () => {
    let state = fixture(['inkstone_ledger'], Array.from({ length: 12 }, () => 'still_guard'));
    state.energy = 10;
    for (let index = 0; index < 3; index += 1) state = play(state, 'still_guard');
    expect(state.hand).toHaveLength(3);
    expect(state.relicCounters?.inkstone_ledger).toBe(1);
    state = play(state, 'still_guard');
    expect(state.hand).toHaveLength(2);
    expect(state.relicCounters?.inkstone_ledger).toBe(1);
    state = reduceCombat(state, { type: 'endTurn' });
    for (let index = 0; index < 3; index += 1) state = play(state, 'still_guard');
    expect(state.relicCounters?.inkstone_ledger).toBe(2);
  });

  it('keeps a partially completed third-attack counter across save/load and resets it on the next turn', () => {
    let state = fixture(['sword_echo'], Array.from({ length: 12 }, () => 'stone_strike'));
    state.energy = 20;
    state = play(play(state, 'stone_strike'), 'stone_strike');
    expect(state.relicCounters?.sword_echo).toBeUndefined();
    state = deserializeGame(serializeGame(state))!;
    const energy = state.energy;
    state = play(state, 'stone_strike');
    expect(state.energy).toBe(energy);
    expect(state.relicCounters?.sword_echo).toBe(1);
    state = reduceCombat(state, { type: 'endTurn' });
    state.enemy.hp = state.enemy.maxHp;
    state.energy = 10;
    state = play(play(state, 'stone_strike'), 'stone_strike');
    expect(state.relicCounters?.sword_echo).toBe(1);
    state = play(state, 'stone_strike');
    expect(state.relicCounters?.sword_echo).toBe(2);
  });

  it('does not trigger a skill relic twice when a draw/discard card resumes after a saved choice', () => {
    let state = fixture(['guard_rhythm'], ['assassin_preparation', ...Array.from({ length: 8 }, () => 'stone_strike')], 'assassin');
    // Move a real deck instance into the opening hand without changing card identity.
    const position = state.drawPile.findIndex((card) => card.cardId === 'assassin_preparation');
    if (position >= 0) state.hand.push(...state.drawPile.splice(position, 1));
    state = play(state, 'assassin_preparation');
    expect(state.pendingChoice?.mode).toBe('discard');
    expect(state.player.block).toBe(4);
    state = deserializeGame(serializeGame(state))!;
    const result = reduceCombat(state, { type: 'chooseCards', cardIds: [state.hand[0].uid] });
    expect(result.pendingChoice).toBeUndefined();
    expect(result.player.block).toBe(4);
    expect(result.relicCounters?.guard_rhythm).toBe(1);
    expect(result.stats.cardsPlayed).toBe(1);
  });

  it('adds block only to the first skill each turn, never to attack or subsequent skills', () => {
    let state = fixture(['guard_rhythm']);
    state.energy = 10;
    state = play(state, 'stone_strike');
    expect(state.player.block).toBe(0);
    state = play(state, 'still_guard');
    expect(state.player.block).toBe(12);
    state = play(state, 'still_guard');
    expect(state.player.block).toBe(20);
    expect(state.relicCounters?.guard_rhythm).toBe(1);
  });

  it('refunds one energy on the third attack, with skills excluded from the attack count', () => {
    let state = fixture(['sword_echo']);
    state.energy = 10;
    state = play(state, 'stone_strike');
    state = play(state, 'still_guard');
    state = play(state, 'stone_strike');
    expect(state.relicCounters?.sword_echo).toBeUndefined();
    state = play(state, 'stone_strike');
    expect(state.energy).toBe(7);
    expect(state.relicCounters?.sword_echo).toBe(1);
  });

  it('refunds energy for the first power in battle and never the second', () => {
    const power = Object.values(CARD_DEFINITIONS).find((card) => card.type === 'power')!;
    let state = fixture(['echo_prism'], [power.id, power.id]);
    state.energy = 10;
    state = play(state, power.id);
    expect(state.energy).toBe(11 - power.cost);
    state = play(state, power.id);
    expect(state.energy).toBe(11 - power.cost * 2);
    expect(state.relicCounters?.echo_prism).toBe(1);
  });

  it('cleanses one extra poison after the player’s normal poison tick', () => {
    let state = fixture(['pilgrim_veil']);
    state.player.poison = 5;
    state.player.block = 100;
    state = reduceCombat(state, { type: 'endTurn' });
    expect(state.player.hp).toBe(75);
    expect(state.player.poison).toBe(3);
  });

  it('heals eight on low-HP victory once, and does not heal above half HP', () => {
    for (const [hp, expected] of [[40, 48], [41, 41]]) {
      const state = fixture(['victory_ladle'], undefined, undefined, hp);
      state.enemy.hp = 0;
      state.phase = 'victory';
      triggerRelics(state, 'victory');
      triggerRelics(state, 'victory');
      expect(state.player.hp).toBe(expected);
    }
  });

  it('heals and blocks for each distinct killed enemy, including the final enemy only once', () => {
    let state = createCombat('relic-kills', ['grit_scout', 'grit_scout'], {
      hp: 60, relicIds: ['quarry_trophy', 'soul_ladle'],
      deck: [0, 1].map((index) => ({ uid: `kill-${index}`, cardId: 'stone_strike', upgraded: false })),
    });
    for (const enemy of getEnemies(state)) enemy.hp = 1;
    state = play(state, 'stone_strike');
    expect([state.player.hp, state.player.block]).toEqual([62, 5]);
    const firstKey = getEnemyKey(getEnemies(state)[0]);
    triggerRelics(state, 'enemyKilled', { enemyId: firstKey });
    expect([state.player.hp, state.player.block]).toEqual([62, 5]);
    state = play(state, 'stone_strike');
    expect(state.phase).toBe('victory');
    expect([state.player.hp, state.player.block]).toEqual([64, 10]);
    expect(state.relicCounters?.quarry_trophy).toBe(2);
    expect(state.relicCounters?.soul_ladle).toBe(2);
  });
});

describe('class relics connect to real card and resource rules', () => {
  it('berserker HP-cost cards grant block without shielding the HP cost itself', () => {
    let state = fixture(['scarred_bracelet'], ['berserker_bloodletting', 'berserker_bloodletting'], 'berserker');
    state = play(state, 'berserker_bloodletting');
    state = play(state, 'berserker_bloodletting');
    expect([state.player.hp, state.player.block]).toEqual([74, 6]);
    expect(state.relicCounters?.scarred_bracelet).toBe(2);
  });

  it('assassin third attack creates a usable knife without making a second knife on the fourth attack', () => {
    let state = fixture(['silent_whetstone'], Array.from({ length: 4 }, () => 'assassin_strike'), 'assassin');
    state.energy = 10;
    for (let index = 0; index < 4; index += 1) state = play(state, 'assassin_strike');
    expect(state.hand.filter((card) => card.cardId === 'token_knife')).toHaveLength(1);
    const enemyHp = state.enemy.hp;
    state = play(state, 'token_knife');
    expect(state.enemy.hp).toBeLessThan(enemyHp);
    expect(state.relicCounters?.silent_whetstone).toBe(1);
  });

  it('oracle relic stars count toward this-turn star-burst damage and reset correctly next turn', () => {
    let state = fixture(['star_map'], ['oracle_star_burst'], 'oracle');
    expect([state.classResources?.stars, state.classResources?.starsGainedThisTurn]).toEqual([1, 1]);
    const enemyHp = state.enemy.hp;
    state = play(state, 'oracle_star_burst');
    expect(state.enemy.hp).toBe(enemyHp - 3);
    state = reduceCombat(state, { type: 'endTurn' });
    expect([state.classResources?.stars, state.classResources?.starsGainedThisTurn]).toEqual([2, 1]);
  });

  it('necromancer relic summons an actual ally that powers summon attacks', () => {
    let state = fixture(['spirit_lantern'], ['necromancer_unleash'], 'necromancer');
    expect(state.classResources?.ostyHp).toBe(4);
    const enemyHp = state.enemy.hp;
    state = play(state, 'necromancer_unleash');
    expect(state.enemy.hp).toBe(enemyHp - 10);
  });

  it('machinist relic creates an orb that can be evoked twice by an existing skill', () => {
    let state = fixture(['core_cage'], ['machinist_dual_cast'], 'machinist');
    expect(state.classResources?.orbs).toEqual(['frost']);
    state = play(state, 'machinist_dual_cast');
    expect(state.player.block).toBe(10);
    expect(state.classResources?.orbs).toEqual([]);
  });
});

describe('every new relic is exercised and preserves its idempotency counters on save/load', () => {
  it.each(EXPANSION_RELIC_IDS)('%s fires once for an identical hook even after restoring a save', (id) => {
    const definition = RELIC_DEFINITIONS[id];
    const { effect } = definition;
    const state = fixture([], undefined, definition.classId, 40);
    state.relicIds = [id];
    state.relicCounters = {};
    state.turn = effect.turn ?? 1;
    state.player.poison = 3;
    const context: RelicContext = {};
    if (effect.trigger === 'cardPlayed') {
      const card = Object.values(CARD_DEFINITIONS).find((candidate) =>
        (!effect.cardType || candidate.type === effect.cardType) &&
        (!effect.cardEffect || candidate.effects.some((part) => part.type === effect.cardEffect)));
      expect(card).toBeDefined();
      context.card = { uid: 'hook-context', cardId: card!.id, upgraded: false };
      for (let serial = 1; serial <= (effect.atCard ?? 1); serial += 1) {
        state.stats.cardsPlayed = serial;
        triggerRelics(state, effect.trigger, context);
      }
    } else {
      if (effect.trigger === 'enemyKilled' || effect.trigger === 'victory') {
        state.enemy.hp = 0;
        state.phase = 'victory';
        context.enemyId = getEnemyKey(state.enemy);
      }
      triggerRelics(state, effect.trigger, context);
    }
    expect(state.relicCounters?.[id]).toBe(1);
    const saved = serializeGame(state);
    const restored = deserializeGame(saved);
    expect(restored).not.toBeNull();
    expect(restored).toEqual(state);
    triggerRelics(restored!, effect.trigger, context);
    expect(restored).toEqual(state);
  });
});

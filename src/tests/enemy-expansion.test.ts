import { describe, expect, it } from 'vitest';
import { ENEMY_DEFINITIONS, EXPANSION_ENEMY_IDS, getEncounterGroupsForFloor } from '../data/enemies';
import { createCombat, getEnemies, getEnemyKey, predictEnemyDamage, reduceCombat } from '../engine';
import { calculateDamage } from '../engine/combat/damage';
import { deserializeGame, serializeGame } from '../engine/persistence';

const announcedActions = EXPANSION_ENEMY_IDS.flatMap((enemyId) => {
  const definition = ENEMY_DEFINITIONS[enemyId];
  return [
    ...definition.intents.map((intent, index) => ({ enemyId, phase: undefined as number | undefined, index, intent })),
    ...(definition.phases ?? []).flatMap((phase, phaseIndex) => phase.intents.map((intent, index) => ({ enemyId, phase: phaseIndex, index, intent }))),
  ];
});

describe('expanded enemy intentions execute exactly as announced', () => {
  it.each(announcedActions)('$enemyId phase $phase action $index: $intent.label', ({ enemyId, phase, index, intent }) => {
    const state = createCombat('expanded-intent', enemyId, { maxHp: 10000 });
    state.enemy.intent = { ...intent };
    state.enemy.intentIndex = index;
    if (phase !== undefined) state.enemy.intentPhase = phase;
    state.enemy.strength = 2;
    state.enemy.weak = 1;
    state.enemy.block = 100;
    state.player.block = 5;
    state.player.weak = 2;
    state.player.vulnerable = 2;
    const snapshot = structuredClone(state);
    const perHit = intent.damage === undefined ? 0 : calculateDamage(
      intent.damage,
      { ...state.enemy, strength: 2 + (intent.strength ?? 0) },
      { ...state.player, vulnerable: 1 },
    );
    expect(predictEnemyDamage(state)).toBe(perHit);
    const after = reduceCombat(state, { type: 'endTurn' });
    const attackDamage = Math.max(0, perHit * (intent.hits ?? 1) - 5);
    expect(after.player.hp).toBe(10000 - attackDamage - (intent.poison ?? 0));
    expect(after.player.poison).toBe(Math.max(0, (intent.poison ?? 0) - 1));
    expect(after.player.weak).toBe(1 + (intent.weak ?? 0));
    expect(after.player.vulnerable).toBe(1 + (intent.vulnerable ?? 0));
    expect(after.enemy.block).toBe(intent.block ?? 0);
    expect(after.enemy.strength).toBe(2 + (intent.strength ?? 0));
    expect(after.log.some((entry) => entry.text.includes(`「${intent.label}」`))).toBe(true);
    expect(state).toEqual(snapshot);
    expect(deserializeGame(serializeGame(after))).toEqual(after);
  });

  it('includes twelve original enemies with readable explanations and distinct tactical families', () => {
    expect(EXPANSION_ENEMY_IDS).toHaveLength(12);
    expect(new Set(EXPANSION_ENEMY_IDS).size).toBe(12);
    for (const id of EXPANSION_ENEMY_IDS) {
      expect(ENEMY_DEFINITIONS[id].description).toBeTruthy();
      expect(ENEMY_DEFINITIONS[id].gimmick).toBeTruthy();
    }
    expect(EXPANSION_ENEMY_IDS.filter((id) => ENEMY_DEFINITIONS[id].reaction)).toHaveLength(2);
    expect(EXPANSION_ENEMY_IDS.filter((id) => ENEMY_DEFINITIONS[id].phases)).toHaveLength(3);
  });
});

describe('cooperating enemies and prediction', () => {
  it('keeps support block for allies even when they act after the herald', () => {
    const state = createCombat('support-block', ['bell_herald', 'grit_scout', 'candle_moth']);
    const after = reduceCombat(state, { type: 'endTurn' });
    expect(getEnemies(after).map((enemy) => enemy.block)).toEqual([0, 5, 5]);
    expect(after.player.hp).toBe(71);
  });

  it('predicts earlier ally strength support and applies it once to each ally', () => {
    const state = createCombat('support-strength', ['bell_herald', 'grit_scout', 'candle_moth']);
    const enemies = getEnemies(state);
    enemies[0].intentIndex = 1;
    enemies[0].intent = { ...ENEMY_DEFINITIONS.bell_herald.intents[1] };
    const incoming = enemies.reduce((sum, enemy) => sum + predictEnemyDamage(state, getEnemyKey(enemy)) * (enemy.intent.hits ?? 1), 0);
    expect(incoming).toBe(11);
    const after = reduceCombat(state, { type: 'endTurn' });
    expect(after.player.hp).toBe(80 - incoming);
    expect(getEnemies(after).map((enemy) => enemy.strength)).toEqual([0, 1, 1]);
  });

  it('includes vulnerability applied by an earlier attacker for a later enemy prediction', () => {
    const state = createCombat('coordinated-crack', ['seam_serpent', 'grit_scout']);
    const enemies = getEnemies(state);
    expect(predictEnemyDamage(state, getEnemyKey(enemies[0]))).toBe(4);
    expect(predictEnemyDamage(state, getEnemyKey(enemies[1]))).toBe(7);
    const after = reduceCombat(state, { type: 'endTurn' });
    expect(after.player.hp).toBe(69);
    expect(after.player.vulnerable).toBe(2);
  });

  it('never predicts or applies support from an ally that poison or doom will kill', () => {
    for (const method of ['poison', 'doom'] as const) {
      const state = createCombat(`dead-support-${method}`, ['bell_herald', 'grit_scout']);
      const herald = getEnemies(state)[0];
      herald.intent = { ...ENEMY_DEFINITIONS.bell_herald.intents[1] };
      herald[method] = herald.hp;
      expect(predictEnemyDamage(state, getEnemyKey(getEnemies(state)[1]))).toBe(5);
      const after = reduceCombat(state, { type: 'endTurn' });
      expect(after.player.hp).toBe(75);
      expect(getEnemies(after)[1].strength).toBe(0);
    }
  });

  it('never supports dead allies or itself', () => {
    const state = createCombat('only-conductor', ['idol_conductor', 'grit_scout']);
    getEnemies(state)[1].hp = 0;
    const after = reduceCombat(state, { type: 'endTurn' });
    expect(getEnemies(after).map((enemy) => enemy.strength)).toEqual([0, 0]);
    expect(after.player.hp).toBe(80);
  });
});

describe('card reactions are visible, deterministic, and triggered once per valid play', () => {
  it('grants the scribe block only for skills, without replacing the announced intent', () => {
    const state = createCombat('skill-reaction', 'echo_scribe', {
      deck: [{ uid: 'guard', cardId: 'still_guard', upgraded: false }],
    });
    const savedIntent = { ...state.enemy.intent };
    const after = reduceCombat(state, { type: 'playCard', cardId: 'guard' });
    expect(after.enemy.block).toBe(3);
    expect(after.enemy.intent).toEqual(savedIntent);
    expect(after.player.block).toBe(8);
    expect(reduceCombat(after, { type: 'playCard', cardId: 'guard' })).toBe(after);
    expect(deserializeGame(serializeGame(after))).toEqual(after);
    expect(state.enemy.block).toBe(0);
  });

  it('does not react to an attack, an unaffordable card, or a potion', () => {
    const state = createCombat('reaction-filter', 'echo_scribe', {
      deck: [{ uid: 'attack', cardId: 'stone_strike', upgraded: false }, { uid: 'guard', cardId: 'still_guard', upgraded: false }],
      potions: ['spring_water', null, null],
    });
    const attacked = reduceCombat(state, { type: 'playCard', cardId: 'attack' });
    expect(attacked.enemy.block).toBe(0);
    attacked.energy = 0;
    expect(reduceCombat(attacked, { type: 'playCard', cardId: 'guard' })).toBe(attacked);
    attacked.player.hp = 70;
    expect(reduceCombat(attacked, { type: 'usePotion', slot: 0 }).enemy.block).toBe(0);
  });

  it('updates a reactive elite strength and damage preview immediately, but not its action', () => {
    const state = createCombat('power-reaction', 'resonance_sentinel', {
      deck: [{ uid: 'power', cardId: 'stillness', upgraded: false }],
    });
    const after = reduceCombat(state, { type: 'playCard', cardId: 'power' });
    expect(after.enemy.strength).toBe(2);
    expect(after.enemy.intent).toEqual(state.enemy.intent);
    expect(predictEnemyDamage(after)).toBe(12);
    expect(reduceCombat(after, { type: 'endTurn' }).player.hp).toBe(68);
  });
});

describe('phase changes and field-wide attacks', () => {
  it('executes the stored boss action even when player damage crosses the phase threshold', () => {
    const state = createCombat('boss-hp-phase', 'eclipse_archon', {
      deck: [{ uid: 'strike', cardId: 'stone_strike', upgraded: false }],
    });
    state.enemy.hp = 106;
    const attacked = reduceCombat(state, { type: 'playCard', cardId: 'strike' });
    expect(attacked.enemy.hp).toBe(99);
    expect(attacked.enemy.intentPhase).toBeUndefined();
    expect(attacked.enemy.intent).toEqual(ENEMY_DEFINITIONS.eclipse_archon.intents[0]);
    expect(predictEnemyDamage(attacked)).toBe(14);
    const after = reduceCombat(attacked, { type: 'endTurn' });
    expect(after.player.hp).toBe(66);
    expect(after.enemy.intentPhase).toBe(0);
    expect(after.enemy.intentIndex).toBe(0);
    expect(after.enemy.intent).toEqual(ENEMY_DEFINITIONS.eclipse_archon.phases![0].intents[0]);
    const restored = deserializeGame(serializeGame(after));
    expect(restored).toEqual(after);
    expect(reduceCombat(restored!, { type: 'endTurn' })).toEqual(reduceCombat(after, { type: 'endTurn' }));
  });

  it.each([{ id: 'sundial_champion', turn: 4 }, { id: 'hollow_mountain', turn: 5 }])(
    'announces $id changed behavior on turn $turn and resumes the same pattern after load', ({ id, turn }) => {
      let state = createCombat('turn-phase', id, { maxHp: 10000 });
      while (state.turn < turn) state = reduceCombat(state, { type: 'endTurn' });
      expect(state.enemy.intentPhase).toBe(0);
      expect(state.enemy.intentIndex).toBe(0);
      expect(state.enemy.intent).toEqual(ENEMY_DEFINITIONS[id].phases![0].intents[0]);
      const loaded = deserializeGame(serializeGame(state));
      expect(loaded).toEqual(state);
      expect(reduceCombat(loaded!, { type: 'endTurn' })).toEqual(reduceCombat(state, { type: 'endTurn' }));
    },
  );

  it('damages player and summon independently on a field-wide strike, with player block applied once', () => {
    const state = createCombat('field-strike', 'hollow_mountain', { classId: 'necromancer' });
    state.enemy.intentIndex = 1;
    state.enemy.intent = { ...ENEMY_DEFINITIONS.hollow_mountain.intents[1] };
    state.classResources!.ostyHp = 30;
    state.player.block = 5;
    expect(predictEnemyDamage(state)).toBe(14);
    const after = reduceCombat(state, { type: 'endTurn' });
    expect(after.classResources!.ostyHp).toBe(16);
    expect(after.player.hp).toBe(71);
    expect(state.classResources!.ostyHp).toBe(30);
  });

  it('keeps ordinary attacks absorbing into the summon before player HP', () => {
    const state = createCombat('ordinary-strike', 'eclipse_archon', { classId: 'necromancer' });
    state.classResources!.ostyHp = 30;
    state.player.block = 5;
    const after = reduceCombat(state, { type: 'endTurn' });
    expect(after.classResources!.ostyHp).toBe(21);
    expect(after.player.hp).toBe(80);
  });

  it('lethal field attacks resolve defeat once and cannot be replayed after loading', () => {
    const state = createCombat('lethal-wave', 'hollow_mountain', { classId: 'necromancer', hp: 1 });
    state.enemy.intentIndex = 1;
    state.enemy.intent = { ...ENEMY_DEFINITIONS.hollow_mountain.intents[1] };
    state.classResources!.ostyHp = 30;
    const after = reduceCombat(state, { type: 'endTurn' });
    expect(after.phase).toBe('defeat');
    expect(after.player.hp).toBe(0);
    const loaded = deserializeGame(serializeGame(after));
    expect(loaded).toEqual(after);
    expect(reduceCombat(loaded!, { type: 'endTurn' })).toBe(loaded);
  });
});

describe('floor-aware enemy pools', () => {
  it('keeps every opening ordinary encounter at fourteen direct damage or less', () => {
    for (let floor = 1; floor <= 11; floor += 1) {
      for (const ids of getEncounterGroupsForFloor(floor, 'combat')) {
        const state = createCombat(`opening-${floor}`, ids);
        const incoming = getEnemies(state).reduce((sum, enemy) => sum + predictEnemyDamage(state, getEnemyKey(enemy)) * (enemy.intent.hits ?? 1), 0);
        expect(incoming, `${floor}: ${ids.join(',')}`).toBeLessThanOrEqual(14);
      }
    }
  });
});

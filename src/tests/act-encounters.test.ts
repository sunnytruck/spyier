import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ACT_DEFINITIONS, ACT_IDS, getActDefinition, isActId } from '../data/acts';
import { ACT_ENEMY_IDS, BASE_ENEMY_IDS, ENEMY_DEFINITIONS, getActEnemyId, getEncounterGroupsForFloor, getEnemyDefinition } from '../data/enemies';
import { createCombat, getEnemies, getEnemyKey, predictEnemyDamage, reduceCombat } from '../engine';
import { calculateDamage } from '../engine/combat/damage';
import { deserializeGame, serializeGame } from '../engine/persistence';

const actions = ACT_IDS.flatMap((act) => BASE_ENEMY_IDS.flatMap((baseId) => {
  const enemyId = getActEnemyId(baseId, act);
  const definition = ENEMY_DEFINITIONS[enemyId];
  return [
    ...definition.intents.map((intent, index) => ({ act, enemyId, phase: undefined as number | undefined, index, intent })),
    ...(definition.phases ?? []).flatMap((phase, phaseIndex) => phase.intents.map((intent, index) => ({ act, enemyId, phase: phaseIndex, index, intent }))),
  ];
}));

describe('three act definitions and stable enemy variant IDs', () => {
  it('defines three twelve-floor themes with explicit increasing scales', () => {
    expect(ACT_IDS).toEqual([1, 2, 3]);
    expect(ACT_IDS.map((act) => getActDefinition(act).hpScale)).toEqual([1, 1.55, 2.15]);
    expect(ACT_IDS.map((act) => getActDefinition(act).attackScale)).toEqual([1, 1.25, 1.5]);
    expect(ACT_IDS.map((act) => getActDefinition(act).blockScale)).toEqual([1, 1.3, 1.6]);
    expect(new Set(ACT_IDS.map((act) => ACT_DEFINITIONS[act].name)).size).toBe(3);
    expect(new Set(ACT_IDS.map((act) => ACT_DEFINITIONS[act].theme)).size).toBe(3);
    for (const act of ACT_IDS) {
      expect(getActDefinition(act).floors).toBe(12);
      expect(getActDefinition(act).description.length).toBeGreaterThan(15);
      expect(isActId(act)).toBe(true);
    }
    for (const invalid of [0, 4, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isActId(invalid)).toBe(false);
      expect(() => getActDefinition(invalid)).toThrow(RangeError);
      expect(() => getActEnemyId('grit_scout', invalid)).toThrow(RangeError);
      expect(() => getEncounterGroupsForFloor(1, 'combat', invalid)).toThrow(RangeError);
    }
    expect(isActId('2')).toBe(false);
    expect(isActId(null)).toBe(false);
  });

  it('keeps every original enemy definition and every original floor pool byte-for-byte', () => {
    // Captured before adding variants: this includes all 21 enemies and 36 pools.
    const enemies = Object.fromEntries(BASE_ENEMY_IDS.map((id) => [id, ENEMY_DEFINITIONS[id]]));
    const pools = Array.from({ length: 12 }, (_, index) => (['combat', 'elite', 'boss'] as const).map((kind) => getEncounterGroupsForFloor(index + 1, kind)));
    expect(createHash('sha256').update(JSON.stringify({ enemies, pools })).digest('hex'))
      .toBe('94d4486920bc49c0ca8f6946bf3e5e6ddf15309c8f781a6d4b5d9eead56dac3a');
    expect(BASE_ENEMY_IDS).toHaveLength(21);
    expect(ACT_ENEMY_IDS).toHaveLength(42);
    expect(new Set([...BASE_ENEMY_IDS, ...ACT_ENEMY_IDS]).size).toBe(63);
  });

  it.each(BASE_ENEMY_IDS)('%s maps idempotently between base and explicit upper-act variants', (baseId) => {
    expect(getActEnemyId(baseId)).toBe(baseId);
    for (const act of ACT_IDS) {
      const id = getActEnemyId(baseId, act);
      expect(id).toBe(act === 1 ? baseId : `act${act}_${baseId}`);
      expect(getActEnemyId(id, act)).toBe(id);
      expect(getActEnemyId(id, 1)).toBe(baseId);
      expect(getEnemyDefinition(id)?.id).toBe(id);
      expect(getEnemyDefinition(id)?.name).toBeTruthy();
    }
    expect(getActEnemyId(`act2_${baseId}`, 3)).toBe(`act3_${baseId}`);
  });

  it('rejects unknown base IDs instead of replacing them with a guardian', () => {
    for (const id of ['missing', 'act2_missing', 'act3_act2_grit_scout', '__proto__']) {
      expect(() => getActEnemyId(id, 2)).toThrow(RangeError);
      expect(getEnemyDefinition(id)).toBeUndefined();
    }
  });
});

describe('scaled definitions preserve tactics and exact description values', () => {
  it.each(ACT_ENEMY_IDS)('%s scales HP, attacks and block without changing status counts or phase rules', (id) => {
    const act = getActDefinition(id.startsWith('act2_') ? 2 : 3);
    const base = ENEMY_DEFINITIONS[getActEnemyId(id, 1)];
    const variant = ENEMY_DEFINITIONS[id];
    expect(variant).not.toBe(base);
    expect(variant.hp).toBe(Math.round(base.hp * act.hpScale));
    expect(variant.maxHp).toBe(Math.round(base.maxHp * act.hpScale));
    expect(variant.block).toBe(Math.round(base.block * act.blockScale));
    for (const status of ['strength', 'weak', 'vulnerable', 'poison'] as const) expect(variant[status]).toBe(base[status]);
    const groups = [{ before: base.intents, after: variant.intents }, ...(base.phases ?? []).map((phase, index) => ({ before: phase.intents, after: variant.phases![index].intents }))];
    for (const group of groups) {
      expect(group.after).not.toBe(group.before);
      expect(group.after).toHaveLength(group.before.length);
      group.before.forEach((before, index) => {
        const after = group.after[index];
        expect(after).not.toBe(before);
        expect(after.kind).toBe(before.kind);
        expect(after.label).toBe(before.label);
        if (before.damage !== undefined) {
          expect(after.damage).toBe(Math.round(before.damage * act.attackScale));
          expect(after.description).toContain(`基礎${after.damage}ダメージ`);
        } else expect(after.damage).toBeUndefined();
        if (before.block !== undefined) {
          expect(after.block).toBe(Math.round(before.block * act.blockScale));
          expect(after.description).toContain(`${after.block}ブロック`);
        }
        if (before.alliesBlock !== undefined) {
          expect(after.alliesBlock).toBe(Math.round(before.alliesBlock * act.blockScale));
          expect(after.description).toContain(`${after.alliesBlock}ブロック`);
        }
        for (const field of ['hits', 'strength', 'weak', 'vulnerable', 'poison', 'alliesStrength', 'allTargets'] as const) expect(after[field]).toBe(before[field]);
      });
    }
    expect(variant.phases?.map((phase) => phase.trigger)).toEqual(base.phases?.map((phase) => phase.trigger));
    if (base.reaction) {
      expect(variant.reaction).not.toBe(base.reaction);
      expect(variant.reaction!.cardType).toBe(base.reaction.cardType);
      expect(variant.reaction!.strength).toBe(base.reaction.strength);
      if (base.reaction.block) {
        expect(variant.reaction!.block).toBe(Math.round(base.reaction.block * act.blockScale));
        expect(variant.gimmick).toContain(`${variant.reaction!.block}ブロック`);
      }
    }
  });
});

describe('all acts execute every stored intent and phase exactly as predicted', () => {
  it.each(actions)('act $act: $enemyId phase $phase, intent $index', ({ enemyId, phase, index, intent }) => {
    const state = createCombat('act-intent-prediction', enemyId, { maxHp: 10000 });
    state.enemy.intent = { ...intent };
    state.enemy.intentIndex = index;
    if (phase !== undefined) state.enemy.intentPhase = phase;
    state.enemy.strength = 2;
    state.enemy.weak = 1;
    state.enemy.block = 100;
    state.player.block = 5;
    state.player.weak = 2;
    state.player.vulnerable = 2;
    const before = JSON.stringify(state);
    const perHit = intent.damage === undefined ? 0 : calculateDamage(intent.damage,
      { ...state.enemy, strength: 2 + (intent.strength ?? 0) },
      { ...state.player, vulnerable: 1 });
    expect(predictEnemyDamage(state)).toBe(perHit);
    const restored = deserializeGame(serializeGame(state))!;
    expect(restored).toEqual(state);
    const after = reduceCombat(restored, { type: 'endTurn' });
    expect(after.player.hp).toBe(10000 - Math.max(0, perHit * (intent.hits ?? 1) - 5) - (intent.poison ?? 0));
    expect(after.player.poison).toBe(Math.max(0, (intent.poison ?? 0) - 1));
    expect(after.player.weak).toBe(1 + (intent.weak ?? 0));
    expect(after.player.vulnerable).toBe(1 + (intent.vulnerable ?? 0));
    expect(after.enemy.block).toBe(intent.block ?? 0);
    expect(after.enemy.strength).toBe(2 + (intent.strength ?? 0));
    expect(after).toEqual(reduceCombat(state, { type: 'endTurn' }));
    expect(deserializeGame(serializeGame(after))).toEqual(after);
    expect(JSON.stringify(state)).toBe(before);
  });

  it.each(ACT_IDS)('act %s predicts coordinated vulnerability/strength and retains support block', (act) => {
    const support = createCombat('act-support', ['bell_herald', 'grit_scout', 'candle_moth'].map((id) => getActEnemyId(id, act)), { maxHp: 10000 });
    const herald = getEnemies(support)[0];
    herald.intentIndex = 1;
    herald.intent = { ...ENEMY_DEFINITIONS[herald.id].intents[1] };
    const incoming = getEnemies(support).reduce((sum, enemy) => sum + predictEnemyDamage(support, getEnemyKey(enemy)) * (enemy.intent.hits ?? 1), 0);
    const after = reduceCombat(support, { type: 'endTurn' });
    expect(after.player.hp).toBe(10000 - incoming);
    expect(getEnemies(after).map((enemy) => enemy.strength)).toEqual([0, 1, 1]);
    const cracked = createCombat('act-crack', ['seam_serpent', 'grit_scout'].map((id) => getActEnemyId(id, act)), { maxHp: 10000 });
    const crackIncoming = getEnemies(cracked).reduce((sum, enemy) => sum + predictEnemyDamage(cracked, getEnemyKey(enemy)) * (enemy.intent.hits ?? 1), 0);
    expect(reduceCombat(cracked, { type: 'endTurn' }).player.hp).toBe(10000 - crackIncoming);
    const block = createCombat('act-support-block', ['bell_herald', 'grit_scout'].map((id) => getActEnemyId(id, act)));
    expect(getEnemies(reduceCombat(block, { type: 'endTurn' }))[1].block).toBe(Math.round(5 * getActDefinition(act).blockScale));
  });

  it.each(ACT_IDS)('act %s reactive block and phased field strikes use the scaled definition', (act) => {
    const id = getActEnemyId('echo_scribe', act);
    const reactive = createCombat('act-reaction', id, { deck: [{ uid: 'guard', cardId: 'still_guard', upgraded: false }] });
    const announced = { ...reactive.enemy.intent };
    const reacted = reduceCombat(reactive, { type: 'playCard', cardId: 'guard' });
    expect(reacted.enemy.block).toBe(Math.round(3 * getActDefinition(act).blockScale));
    expect(reacted.enemy.intent).toEqual(announced);
    expect(deserializeGame(serializeGame(reacted))).toEqual(reacted);
    const fieldId = getActEnemyId('hollow_mountain', act);
    const field = createCombat('act-field', fieldId, { classId: 'necromancer' });
    field.enemy.intentIndex = 1;
    field.enemy.intent = { ...ENEMY_DEFINITIONS[fieldId].intents[1] };
    field.classResources!.ostyHp = 100;
    field.player.block = 5;
    const damage = predictEnemyDamage(field);
    const after = reduceCombat(field, { type: 'endTurn' });
    expect(after.player.hp).toBe(80 - Math.max(0, damage - 5));
    expect(after.classResources!.ostyHp).toBe(100 - damage);
  });

  it.each(ACT_IDS)('act %s announces HP and turn phase changes after executing the saved action', (act) => {
    const hpId = getActEnemyId('eclipse_archon', act);
    const state = createCombat('act-hp-threshold', hpId, {
      maxHp: 10000, deck: [{ uid: 'strike', cardId: 'stone_strike', upgraded: false }],
    });
    state.enemy.hp = Math.floor(state.enemy.maxHp / 2) + 1;
    const attacked = reduceCombat(state, { type: 'playCard', cardId: 'strike' });
    expect(attacked.enemy.hp).toBeLessThanOrEqual(attacked.enemy.maxHp / 2);
    expect(attacked.enemy.intentPhase).toBeUndefined();
    expect(attacked.enemy.intent).toEqual(ENEMY_DEFINITIONS[hpId].intents[0]);
    const storedDamage = predictEnemyDamage(attacked);
    const advanced = reduceCombat(deserializeGame(serializeGame(attacked))!, { type: 'endTurn' });
    expect(advanced.player.hp).toBe(10000 - storedDamage);
    expect(advanced.enemy.intentPhase).toBe(0);
    expect(advanced.enemy.intentIndex).toBe(0);
    expect(advanced.enemy.intent).toEqual(ENEMY_DEFINITIONS[hpId].phases![0].intents[0]);
    for (const [baseId, triggerTurn] of [['sundial_champion', 4], ['hollow_mountain', 5]] as const) {
      const id = getActEnemyId(baseId, act);
      let battle = createCombat('act-turn-threshold', id, { maxHp: 10000 });
      while (battle.turn < triggerTurn) battle = reduceCombat(deserializeGame(serializeGame(battle))!, { type: 'endTurn' });
      expect(battle.enemy.intentPhase).toBe(0);
      expect(battle.enemy.intentIndex).toBe(0);
      expect(battle.enemy.intent).toEqual(ENEMY_DEFINITIONS[id].phases![0].intents[0]);
      expect(reduceCombat(deserializeGame(serializeGame(battle))!, { type: 'endTurn' }))
        .toEqual(reduceCombat(battle, { type: 'endTurn' }));
    }
  });
});

describe('local floor encounter pools for all three acts', () => {
  it.each(ACT_IDS)('act %s provides executable ordinary, elite and boss encounters for every local floor', (act) => {
    for (let floor = 1; floor <= 12; floor++) {
      for (const kind of ['combat', 'elite', 'boss'] as const) {
        const pool = getEncounterGroupsForFloor(floor, kind, act);
        expect(pool.length).toBeGreaterThan(0);
        expect(pool).toEqual(getEncounterGroupsForFloor(floor, kind).map((group) => group.map((id) => getActEnemyId(id, act))));
        for (const group of pool) {
          expect(group.length).toBeGreaterThan(0);
          expect(group.length).toBeLessThanOrEqual(3);
          const state = createCombat(`act-${act}-${floor}-${kind}`, group, { maxHp: 10000 });
          expect(getEnemies(state).map((enemy) => enemy.id)).toEqual(group);
          expect(deserializeGame(serializeGame(state))).toEqual(state);
        }
      }
    }
  });
});

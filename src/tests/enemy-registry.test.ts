import { expect, it } from 'vitest';
import {
  DEFAULT_ENEMY_ID,
  ENEMY_DEFINITION,
  ENEMY_DEFINITIONS,
  ENEMY_INTENTS,
  getEnemyDefinition,
} from '../data/enemies';
import { createCombat, reduceCombat } from '../engine';

it('uses each registered enemy pattern while preserving the default guardian', () => {
  const customId = 'registry-test-enemy';
  ENEMY_DEFINITIONS[customId] = {
    id: customId,
    name: '試験用の岩',
    hp: 40,
    maxHp: 40,
    block: 0,
    strength: 0,
    weak: 0,
    vulnerable: 0,
    poison: 0,
    intents: [
      { kind: 'defend', label: '小さな構え', description: '4ブロック。', block: 4 },
      { kind: 'attack', label: '二連の小石', description: '3ダメージを2回。', damage: 3, hits: 2 },
    ],
  };
  try {
    let state = createCombat('registry-seed', customId);
    expect(state.enemy.id).toBe(customId);
    expect(state.enemy.intent).toEqual(ENEMY_DEFINITIONS[customId].intents[0]);
    state = reduceCombat(state, { type: 'endTurn' });
    expect(state.enemy.block).toBe(4);
    expect(state.player.hp).toBe(80);
    expect(state.enemy.intent).toEqual(ENEMY_DEFINITIONS[customId].intents[1]);
    state = reduceCombat(state, { type: 'endTurn' });
    expect(state.player.hp).toBe(74);
    expect(state.enemy.intentIndex).toBe(0);
    expect(state.enemy.intent).toEqual(ENEMY_DEFINITIONS[customId].intents[0]);

    const guardian = createCombat('registry-seed');
    expect(guardian).toEqual(createCombat('registry-seed', DEFAULT_ENEMY_ID));
    expect(guardian.enemy).toEqual({
      ...ENEMY_DEFINITION,
      intentIndex: 0,
      intent: ENEMY_INTENTS[0],
    });
    expect(getEnemyDefinition(DEFAULT_ENEMY_ID)?.intents).toBe(ENEMY_INTENTS);
    expect(getEnemyDefinition('missing-enemy')).toBeUndefined();
    expect(() => createCombat('registry-seed', 'missing-enemy')).toThrow(RangeError);
  } finally {
    delete ENEMY_DEFINITIONS[customId];
  }
});

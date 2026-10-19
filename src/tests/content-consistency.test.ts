import { expect, it } from 'vitest';
import { POTION_DEFINITIONS } from '../data/potions';
import { createCombat, reduceCombat } from '../engine';
import { deserializeGame, serializeGame } from '../engine/persistence';
import { ENEMY_DEFINITIONS } from '../data/enemies';

it('the magma flask applies only the target vulnerability, as its corrected description states', () => {
  const state = createCombat('potion-text', 'restless_guardian', { potions: ['magma_flask', null, null] });
  state.player.strength = 20;
  state.player.weak = 2;
  state.enemy.vulnerable = 2;
  const after = reduceCombat(state, { type: 'usePotion', slot: 0 });
  expect(state.enemy.hp - after.enemy.hp).toBe(30);
  expect(after.energy).toBe(state.energy);
  expect(after.potions![0]).toBeNull();
  expect(POTION_DEFINITIONS.magma_flask.description).toContain('筋力・弱体の影響は受けない');
});

it('resumes an old boss telegraph exactly, then announces the current balanced pattern', () => {
  const saved = createCombat('before-boss-tuning', 'tower_abbot');
  saved.enemy.intent = { ...saved.enemy.intent, damage: 22, description: '基礎22ダメージ。' };
  const loaded = deserializeGame(serializeGame(saved))!;
  expect(loaded.enemy.intent.damage).toBe(22);
  const next = reduceCombat(loaded, { type: 'endTurn' });
  expect(next.player.hp).toBe(58);
  expect(next.enemy.intent).toEqual(ENEMY_DEFINITIONS.tower_abbot.intents[1]);
  expect(next.enemy.intent.damage).toBe(6);
});

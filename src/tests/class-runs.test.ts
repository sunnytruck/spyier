import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import { createRun, reduceRun } from '../engine/run';
import { deserializeRun, isValidRunState, serializeRun } from '../engine/runPersistence';
import type { ClassId } from '../types/game';
import { chooseClassRunAction } from './helpers/classDriver';

const routes: [ClassId, string][] = [
  ['berserker', 'class-balance-1'],
  ['assassin', 'class-balance-0'],
  ['oracle', 'class-balance-8'],
  ['necromancer', 'class-balance-0'],
  ['machinist', 'class-balance-1'],
];

describe('playable class campaigns through the first act', () => {
  it.each(routes)('%s can reach and defeat the boss using only legal public actions', (classId, seed) => {
    let run = createRun(seed, classId);
    let bossRewardSeen = false;
    let choiceSeen = false;
    for (let step = 0; step < 1500 && !['victory', 'defeat'].includes(run.screen); step++) {
      expect(isValidRunState(run), `${classId}: ${run.screen} at floor ${run.floor}`).toBe(true);
      const restored = deserializeRun(serializeRun(run));
      expect(restored).toEqual(run);
      const action = chooseClassRunAction(run);
      if (run.combat?.pendingChoice) choiceSeen = true;
      if (run.screen === 'reward') {
        for (const id of run.reward!.cardIds) expect(CARD_DEFINITIONS[id].classId).toBe(classId);
        if (run.floor === 12) {
          bossRewardSeen = true;
          expect(run.reward!.completesRun).toBe(true);
        }
      }
      const next = reduceRun(run, action);
      expect(next, JSON.stringify(action)).not.toBe(run);
      expect(reduceRun(restored!, action)).toEqual(next);
      run = next;
    }
    expect(run.screen).toBe('victory');
    expect(run.floor).toBe(12);
    expect(run.hp).toBeGreaterThan(0);
    expect(bossRewardSeen).toBe(true);
    if (classId === 'assassin') expect(choiceSeen).toBe(true);
    expect(deserializeRun(serializeRun(run))).toEqual(run);
  }, 30000);

  it.each(routes)('%s still loses when the player repeatedly passes without defending', (classId, seed) => {
    let run = createRun(seed, classId);
    const first = run.map.nodes.find((node) => node.floor === 1)!;
    run = reduceRun(run, { type: 'chooseNode', nodeId: first.id });
    for (let turn = 0; turn < 100 && run.screen === 'combat'; turn++)
      run = reduceRun(run, { type: 'combat', action: { type: 'endTurn' } });
    expect(run.screen).toBe('defeat');
    expect(run.hp).toBe(0);
    expect(deserializeRun(serializeRun(run))).toEqual(run);
    expect(reduceRun(run, { type: 'combat', action: { type: 'endTurn' } })).toBe(run);
  });
});

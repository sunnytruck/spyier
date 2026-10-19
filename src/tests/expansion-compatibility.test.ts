import { describe, expect, it } from 'vitest';
import { getEnemies } from '../engine';
import { reduceRun } from '../engine/run';
import { deserializeRun, isValidRunState, serializeRun } from '../engine/runPersistence';
import type { CombatState } from '../types/game';
import saves from './fixtures/pre-expansion-saves.json';
import { chooseClassRunAction } from './helpers/classDriver';

/** Captured from a912a6f before expanding enemies, relics, or event state. */
describe('pre-expansion version-2 saves', () => {
  it.each(Object.entries(saves))('resumes %s without replacing any saved inventory or intent', (_name, save) => {
    const raw = JSON.stringify(save);
    const restored = deserializeRun(raw);
    expect(restored).not.toBeNull();
    expect(isValidRunState(restored)).toBe(true);
    expect(restored).toMatchObject(save.run);
    expect(restored!.rngState).toBe(save.run.rngState);
    expect(restored!.deck).toEqual(save.run.deck);
    expect(restored!.relicIds).toEqual(save.run.relicIds);
    if (restored!.combat) {
      const previous = save.run as typeof saves.assassinCombat.run;
      expect(getEnemies(restored!.combat).map((enemy) => enemy.intent)).toEqual(
        getEnemies(previous.combat as unknown as CombatState).map((enemy) => enemy.intent),
      );
      expect(restored!.combat.classResources).toEqual(previous.combat.classResources);
    }

    // Continue real public actions, then compare against the same saved decision.
    let run = restored!;
    for (let step = 0; step < 12 && !['victory', 'defeat'].includes(run.screen); step++) {
      const reloaded = deserializeRun(serializeRun(run))!;
      const action = chooseClassRunAction(run);
      const next = reduceRun(run, action);
      expect(next, JSON.stringify(action)).not.toBe(run);
      expect(reduceRun(reloaded, action)).toEqual(next);
      expect(isValidRunState(next)).toBe(true);
      run = next;
    }
    expect(JSON.stringify(save)).toBe(raw);
  });
});

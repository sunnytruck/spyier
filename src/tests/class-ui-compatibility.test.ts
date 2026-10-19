import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { reduceCombat } from '../engine';
import { deserializeGame, isValidCombatState, serializeGame } from '../engine/persistence';
import { captureCombatTransition } from '../presentation/trace';
import type { CombatAction } from '../types/game';
import baseline from './fixtures/class-resources-before-ui.json';

const digest = (raw: string) => createHash('sha256').update(raw).digest('hex');

/** Captured by the old engine, rather than recomputed from the implementation under test. */
describe('class presentation preserves pre-UI gameplay and saved decisions byte for byte', () => {
  it.each(baseline.scenarios)('$name restores the original resource state and exact continuation', (scenario) => {
    let state = deserializeGame(scenario.initial);
    expect(state).not.toBeNull();
    expect(isValidCombatState(state)).toBe(true);
    expect(serializeGame(state!)).toBe(scenario.initial);
    for (const step of scenario.steps) {
      const before = serializeGame(state!);
      const action = step.action as CombatAction;
      const next = reduceCombat(state!, action);
      const traced = captureCombatTransition(state!, () => reduceCombat(state!, action));
      expect(next, step.label).not.toBe(state);
      expect(serializeGame(state!), `${step.label} mutated its input`).toBe(before);
      expect(next.rngState, `${step.label} RNG changed`).toBe(step.rngState);
      const raw = serializeGame(next);
      expect(digest(raw), `${scenario.name}/${step.label}: gameplay/save changed`).toBe(step.sha256);
      expect(serializeGame(traced.result), `${step.label} tracing changed the saved state`).toBe(raw);
      expect(traced.result.rngState).toBe(step.rngState);
      const restored = deserializeGame(raw);
      expect(restored).not.toBeNull();
      expect(serializeGame(restored!), `${step.label} reload changed resource ordering or state`).toBe(raw);
      state = restored;
    }
  });

  it('records all five classes and the actual baseline commit', () => {
    expect(baseline.sourceCommit).toBe('60fd02d060c0570850911fd0fc23e6f532a582ba');
    expect(new Set(baseline.scenarios.map((scenario) => scenario.classId))).toEqual(new Set([
      'berserker', 'assassin', 'oracle', 'necromancer', 'machinist',
    ]));
    expect(baseline.scenarios.reduce((sum, scenario) => sum + scenario.steps.length, 0)).toBe(68);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canPlayCard, createCombat, reduceCombat } from '../engine';
import {
  SAVE_KEY,
  SETTINGS_KEY,
  clearGame,
  deserializeGame,
  getSaveWarning,
  isValidCombatState,
  loadGame,
  loadSettings,
  saveGame,
  saveSettings,
  serializeGame,
} from '../engine/persistence';

class MemoryStorage {
  entries = new Map<string, string>();
  getItem(key: string) {
    return this.entries.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.entries.set(key, String(value));
  }
  removeItem(key: string) {
    this.entries.delete(key);
  }
}

let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
  clearGame();
});
afterEach(() => vi.unstubAllGlobals());

describe('versioned combat saves', () => {
  it('round-trips the entire initial combat, intent and seeded RNG', () => {
    const state = createCombat('保存の石');
    expect(isValidCombatState(state)).toBe(true);
    expect(deserializeGame(serializeGame(state))).toEqual(state);
    expect(saveGame(state)).toBe(true);
    expect(loadGame()).toEqual(state);
  });

  it('preserves an ongoing battle and resumes with the exact same next shuffle and intent', () => {
    let state = createCombat('resume-after-reshuffle');
    for (let turn = 0; turn < 3 && state.phase === 'player'; turn++) {
      for (const instance of [...state.hand]) {
        if (canPlayCard(state, instance.uid))
          state = reduceCombat(state, { type: 'playCard', cardId: instance.uid });
      }
      if (state.phase === 'player') state = reduceCombat(state, { type: 'endTurn' });
      expect(isValidCombatState(state)).toBe(true);
    }
    const restored = deserializeGame(serializeGame(state));
    expect(restored).toEqual(state);
    expect(reduceCombat(restored!, { type: 'endTurn' })).toEqual(
      reduceCombat(state, { type: 'endTurn' }),
    );
  });

  it('rejects malformed, incomplete and unsupported-version files', () => {
    for (const raw of [
      '{oops',
      'null',
      '[]',
      '{}',
      JSON.stringify({ version: 99, combat: createCombat('v') }),
    ]) {
      expect(deserializeGame(raw)).toBeNull();
    }
  });

  it('rejects unknown card IDs, duplicate cards and missing cards', () => {
    const state = createCombat('bad-cards');
    const unknown = structuredClone(state);
    unknown.hand[0].cardId = 'unknown-card';
    expect(isValidCombatState(unknown)).toBe(false);
    const duplicate = structuredClone(state);
    duplicate.discardPile.push({ ...duplicate.hand[0] });
    expect(isValidCombatState(duplicate)).toBe(false);
    const missing = structuredClone(state);
    missing.hand.pop();
    expect(isValidCombatState(missing)).toBe(false);
  });

  it('rejects impossible HP, gauge, energy, status and terminal states', () => {
    for (const change of [
      { energy: -1 },
      { jitto: 101 },
      { rngState: -1 },
      { turn: 0 },
      { phase: 'victory' },
      { player: { ...createCombat('bad').player, hp: 1000 } },
      { enemy: { ...createCombat('bad').enemy, poison: -1 } },
    ]) {
      expect(isValidCombatState({ ...createCombat('bad'), ...change })).toBe(false);
    }
  });

  it('rejects corrupted intent payloads before the reducer sees them', () => {
    const state = createCombat('bad-intent');
    state.enemy.intent = { kind: 'attack', label: '破損', description: '破損', damage: -100 };
    expect(isValidCombatState(state)).toBe(false);
    expect(() => serializeGame(state)).toThrow();
  });

  it('rejects arrays impersonating enum values and unsafe intent loops', () => {
    const state = createCombat('strict-enums');
    expect(isValidCombatState({ ...state, phase: ['player'] })).toBe(false);
    expect(
      isValidCombatState({
        ...state,
        enemy: { ...state.enemy, intent: { ...state.enemy.intent, kind: ['attack'] } },
      }),
    ).toBe(false);
    for (const hits of [0, 1_000_000]) {
      expect(
        isValidCombatState({
          ...state,
          enemy: { ...state.enemy, intent: { ...state.enemy.intent, hits } },
        }),
      ).toBe(false);
    }
    expect(isValidCombatState({ ...state, enemy: { ...state.enemy, intentIndex: 999 } })).toBe(
      false,
    );
    storage.setItem(SETTINGS_KEY, '{"speed":["instant"],"reducedMotion":true}');
    expect(loadSettings()).toEqual({ speed: 'normal', reducedMotion: false });
  });

  it('reports corruption without crashing or silently replacing the original file', () => {
    storage.setItem(SAVE_KEY, 'not JSON');
    expect(loadGame()).toBeNull();
    expect(getSaveWarning()).toContain('読み込めません');
    expect(storage.getItem(SAVE_KEY)).toBe('not JSON');
    expect(saveGame(createCombat('replacement'))).toBe(true);
    expect(getSaveWarning()).toBeNull();
  });

  it('clears only this game save and leaves settings and unrelated application data intact', () => {
    saveGame(createCombat('clear'));
    storage.setItem('another-app', 'keep');
    saveSettings({ speed: 'fast', reducedMotion: true });
    clearGame();
    expect(loadGame()).toBeNull();
    expect(storage.getItem('another-app')).toBe('keep');
    expect(storage.getItem(SETTINGS_KEY)).not.toBeNull();
  });

  it('fails gracefully when storage access is blocked or full', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('SecurityError');
      },
      setItem() {
        throw new Error('QuotaExceededError');
      },
      removeItem() {
        throw new Error('SecurityError');
      },
    });
    expect(loadGame()).toBeNull();
    expect(saveGame(createCombat('private-mode'))).toBe(false);
    expect(getSaveWarning()).toContain('保存');
    expect(() => clearGame()).not.toThrow();
    expect(saveSettings({ speed: 'normal', reducedMotion: false })).toBe(false);
  });
});

describe('settings', () => {
  it('loads defaults when absent and round-trips valid preferences', () => {
    expect(loadSettings()).toEqual({ speed: 'normal', reducedMotion: false });
    expect(saveSettings({ speed: 'instant', reducedMotion: true })).toBe(true);
    expect(loadSettings()).toEqual({ speed: 'instant', reducedMotion: true });
  });

  it('ignores invalid or partial settings safely', () => {
    for (const raw of [
      'oops',
      'null',
      '{}',
      '{"speed":"warp","reducedMotion":true}',
      '{"speed":"fast"}',
    ]) {
      storage.setItem(SETTINGS_KEY, raw);
      expect(loadSettings()).toEqual({ speed: 'normal', reducedMotion: false });
    }
  });
});

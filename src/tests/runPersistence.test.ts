import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCombat, getEnemies, getEnemyKey, reduceCombat } from '../engine';
import { createRun, getAvailableNodes, reduceRun } from '../engine/run';
import {
  RUN_SAVE_KEY,
  clearRun,
  deserializeRun,
  getRunSaveWarning,
  isValidRunState,
  loadRun,
  saveRun,
  serializeRun,
} from '../engine/runPersistence';
import { SAVE_KEY, saveGame } from '../engine/persistence';
import type { RunState } from '../types/run';
import { chooseRunAction } from './helpers/runDriver';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}
let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
  clearRun();
});
afterEach(() => vi.unstubAllGlobals());

describe('complete, versioned exploration saves', () => {
  it('round-trips a new run including its complete map and RNG without changing legacy practice', () => {
    const state = createRun('persistent-tower');
    saveGame(createCombat('legacy-practice'));
    const legacy = storage.getItem(SAVE_KEY);
    expect(isValidRunState(state)).toBe(true);
    expect(saveRun(state)).toBe(true);
    expect(loadRun()).toEqual(state);
    expect(storage.getItem(SAVE_KEY)).toBe(legacy);
    clearRun();
    expect(loadRun()).toBeNull();
    expect(storage.getItem(SAVE_KEY)).toBe(legacy);
  });

  it('restores the exact current screen and candidates at every legal transition across six runs', () => {
    const screens = new Set<string>();
    for (let seed = 0; seed < 6; seed++) {
      let state = createRun(`save-every-transition-${seed}`);
      for (let step = 0; step < 1200; step++) {
        screens.add(state.screen);
        expect(isValidRunState(state), `${state.screen}, floor ${state.floor}, seed ${seed}`).toBe(
          true,
        );
        const restored = deserializeRun(serializeRun(state));
        expect(restored).toEqual(state);
        if (state.screen === 'victory' || state.screen === 'defeat') break;
        let action = chooseRunAction(state);
        if (state.screen === 'map') {
          const options = getAvailableNodes(state);
          const preferred =
            options.find((node) => node.type === 'shop' && !screens.has('shop')) ??
            options.find((node) => node.type === 'elite' && state.stats.elitesDefeated === 0) ??
            options.find((node) => node.type === 'rest' && !screens.has('upgrade'));
          if (preferred) action = { type: 'chooseNode', nodeId: preferred.id };
        }
        if (state.screen === 'rest' && !screens.has('upgrade'))
          action = { type: 'rest', choice: 'upgrade' };
        // Restoring must not alter the next random draw, choice or reward either.
        const next = reduceRun(state, action);
        expect(reduceRun(restored!, action)).toEqual(next);
        expect(next).not.toBe(state);
        state = next;
      }
    }
    for (const screen of [
      'map',
      'combat',
      'reward',
      'relic',
      'shop',
      'event',
      'rest',
      'upgrade',
      'victory',
    ]) {
      expect(screens.has(screen), `${screen} actually executed`).toBe(true);
    }
  }, 30000);

  it('normalizes duplicated JSON enemy objects without losing the selected second target', () => {
    let run = createRun('two-target-save');
    run = reduceRun(run, { type: 'chooseNode', nodeId: getAvailableNodes(run)[0].id });
    run.combat = createCombat('two-target-save', ['grit_scout', 'candle_moth'], {
      deck: run.deck,
      hp: run.hp,
      maxHp: run.maxHp,
      relicIds: run.relicIds,
      potions: run.potions,
    });
    const second = getEnemyKey(getEnemies(run.combat)[1]);
    run = reduceRun(run, { type: 'combat', action: { type: 'selectEnemy', targetId: second } });
    const restored = deserializeRun(serializeRun(run))!;
    expect(restored.combat!.selectedEnemyId).toBe(second);
    expect(restored.combat!.enemy).toBe(restored.combat!.enemies![0]);
    expect(reduceCombat(restored.combat!, { type: 'endTurn' })).toEqual(
      reduceCombat(run.combat!, { type: 'endTurn' }),
    );
  });

  it('rejects impossible screens, malformed maps, duplicate cards, and future UID collisions', () => {
    const base = createRun('invalid-save');
    const invalid: unknown[] = [
      { ...base, screen: ['map'] },
      { ...base, screen: 'shop' },
      { ...base, hp: -1 },
      { ...base, floor: 12 },
      { ...base, nextCardId: 1 },
      { ...base, rngState: -1 },
      { ...base, deck: [...base.deck, { ...base.deck[0] }] },
      { ...base, potions: ['unknown', null, null] },
      { ...base, relicIds: ['unknown'] },
      { ...base, map: { floors: 12, nodes: [null] } },
    ];
    const brokenRoute = structuredClone(base);
    brokenRoute.map.nodes[0].connections = ['missing-node'];
    invalid.push(brokenRoute);
    for (const state of invalid) expect(isValidRunState(state)).toBe(false);
    expect(() => serializeRun(invalid[0] as RunState)).toThrow();
    for (const raw of ['oops', 'null', '{}', '{"version":999,"run":{}}'])
      expect(deserializeRun(raw)).toBeNull();
  });

  it('rejects a playing combat with mismatched persistent inventory', () => {
    let run = createRun('inventory-sync');
    run = reduceRun(run, { type: 'chooseNode', nodeId: getAvailableNodes(run)[0].id });
    expect(isValidRunState(run)).toBe(true);
    const potions = structuredClone(run);
    potions.potions[0] = null;
    const cards = structuredClone(run);
    cards.deck[0].upgraded = true;
    expect(isValidRunState(potions)).toBe(false);
    expect(isValidRunState(cards)).toBe(false);
  });

  it('keeps corrupt data intact until a deliberate new run replaces it, with an actionable warning', () => {
    storage.setItem(RUN_SAVE_KEY, 'broken JSON');
    expect(loadRun()).toBeNull();
    expect(getRunSaveWarning()).toContain('読み込めません');
    expect(storage.getItem(RUN_SAVE_KEY)).toBe('broken JSON');
    expect(saveRun(createRun('restart'))).toBe(true);
    expect(getRunSaveWarning()).toBeNull();
  });

  it('keeps playing possible when storage is unavailable or full', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('full');
      },
      removeItem() {
        throw new Error('blocked');
      },
    });
    expect(loadRun()).toBeNull();
    expect(saveRun(createRun('private'))).toBe(false);
    expect(getRunSaveWarning()).toContain('保存');
    expect(() => clearRun()).not.toThrow();
  });
});

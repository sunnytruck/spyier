import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import { CLASS_IDS } from '../data/classes';
import {
  BOSS_ENEMY_IDS,
  ENEMY_DEFINITIONS,
  EXPANSION_ENEMY_IDS,
  getEncounterGroupsForFloor,
  NORMAL_ENEMY_IDS,
} from '../data/enemies';
import { eligibleRelicIds, EXPANSION_RELIC_IDS, isRelicEligible, RELIC_DEFINITIONS } from '../data/relics';
import { getEnemies, getEnemyKey } from '../engine';
import { createRun, reduceRun } from '../engine/run';
import { deserializeRun, isValidRunState, serializeRun } from '../engine/runPersistence';
import type { ClassId } from '../types/game';
import type { RunState } from '../types/run';
import { chooseClassRunAction } from './helpers/classDriver';

function expectCombatInvariants(run: RunState): void {
  const combat = run.combat;
  if (!combat) return;
  expect(Number.isSafeInteger(combat.energy)).toBe(true);
  expect(combat.energy).toBeGreaterThanOrEqual(0);
  const enemies = getEnemies(combat);
  expect(new Set(enemies.map(getEnemyKey)).size).toBe(enemies.length);
  for (const actor of [combat.player, ...enemies]) {
    expect(actor.hp).toBeGreaterThanOrEqual(0);
    expect(actor.hp).toBeLessThanOrEqual(actor.maxHp);
    for (const field of ['block', 'weak', 'vulnerable', 'poison'] as const)
      expect(Number.isSafeInteger(actor[field]) && actor[field] >= 0).toBe(true);
  }
  const zones = [...combat.hand, ...combat.drawPile, ...combat.discardPile, ...combat.exhaustPile, ...combat.powers];
  expect(new Set(zones.map((card) => card.uid)).size).toBe(zones.length);
}

describe('expanded content pools', () => {
  it('keeps new enemy definitions unique and gives each a real, distinct tactical pattern', () => {
    expect(EXPANSION_ENEMY_IDS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(EXPANSION_ENEMY_IDS).size).toBe(EXPANSION_ENEMY_IDS.length);
    const patterns = EXPANSION_ENEMY_IDS.map((id) => {
      const definition = ENEMY_DEFINITIONS[id];
      expect(definition.id).toBe(id);
      expect(definition.description).toBeTruthy();
      expect(definition.gimmick).toBeTruthy();
      expect(definition.intents.length).toBeGreaterThanOrEqual(2);
      return JSON.stringify(definition.intents.map(({ kind, damage, hits, block, strength, weak, vulnerable, poison, alliesBlock, alliesStrength }) =>
        ({ kind, damage, hits, block, strength, weak, vulnerable, poison, alliesBlock, alliesStrength }),
      ));
    });
    expect(new Set(patterns).size).toBe(patterns.length);
  });

  it('bands ordinary encounters by floor, keeps early turns reasonable, and separates bosses', () => {
    const early = new Set(getEncounterGroupsForFloor(1, 'combat').flat());
    const late = new Set(getEncounterGroupsForFloor(10, 'combat').flat());
    expect([...late].some((id) => !early.has(id))).toBe(true);
    for (let floor = 1; floor <= 12; floor++) {
      for (const kind of ['combat', 'elite', 'boss'] as const) {
        const pool = getEncounterGroupsForFloor(floor, kind);
        expect(pool.length).toBeGreaterThan(0);
        for (const group of pool) {
          expect(group.length).toBeGreaterThan(0);
          expect(group.length).toBeLessThanOrEqual(3);
          expect(group.every((id) => Boolean(ENEMY_DEFINITIONS[id]))).toBe(true);
          if (kind === 'combat') {
            expect(group.every((id) => NORMAL_ENEMY_IDS.includes(id))).toBe(true);
            const opening = group.reduce((sum, id) => {
              const intent = ENEMY_DEFINITIONS[id].intents[0];
              return sum + (intent.damage ?? 0) * (intent.hits ?? 1);
            }, 0);
            expect(opening).toBeLessThanOrEqual(14);
          }
          if (kind !== 'boss') expect(group.some((id) => BOSS_ENEMY_IDS.includes(id))).toBe(false);
          else expect(group).toHaveLength(1);
        }
      }
    }
    expect(getEncounterGroupsForFloor(12, 'boss').map(([id]) => id)).toEqual(BOSS_ENEMY_IDS);
  });

  it.each([undefined, ...CLASS_IDS])('filters class relics from all random acquisition for %s', (classId) => {
    expect(EXPANSION_RELIC_IDS.length).toBeGreaterThanOrEqual(15);
    const pool = eligibleRelicIds(classId);
    expect(pool.length).toBeGreaterThanOrEqual(10);
    for (const [id, definition] of Object.entries(RELIC_DEFINITIONS)) {
      expect(pool.includes(id)).toBe(!definition.classId || definition.classId === classId);
      expect(isRelicEligible(id, classId)).toBe(pool.includes(id));
    }
    if (classId) expect(pool.some((id) => RELIC_DEFINITIONS[id].classId === classId)).toBe(true);
    expect(isRelicEligible('unknown', classId)).toBe(false);
  });
});

const campaigns: [ClassId, string][] = CLASS_IDS.flatMap((classId) =>
  Array.from({ length: 4 }, (_, index) => [classId, `expansion-validation-${index}`] as [ClassId, string]),
);

describe('five-class legal campaigns across reproducible seeds', () => {
  it.each(campaigns)('%s / %s reaches an honest terminal result without stalled transitions', (classId, seed) => {
    let run = createRun(seed, classId);
    let observedEventResult = false;
    for (let step = 0; step < 1800 && !['victory', 'defeat'].includes(run.screen); step++) {
      expect(isValidRunState(run), `${run.screen}, floor ${run.floor}, step ${step}`).toBe(true);
      expectCombatInvariants(run);
      if (run.screen === 'eventResult') observedEventResult = true;
      if (run.screen === 'reward') {
        expect(run.reward!.cardIds.every((id) => CARD_DEFINITIONS[id].classId === classId)).toBe(true);
        if (run.reward!.relicId) expect(isRelicEligible(run.reward!.relicId, classId)).toBe(true);
      }
      if (run.screen === 'shop' && run.shop!.relicId)
        expect(isRelicEligible(run.shop!.relicId, classId)).toBe(true);
      const restored = deserializeRun(serializeRun(run))!;
      expect(restored).toEqual(run);
      const action = chooseClassRunAction(run);
      const next = reduceRun(run, action);
      expect(next, `${run.screen}: ${JSON.stringify(action)}`).not.toBe(run);
      expect(reduceRun(restored, action)).toEqual(next);
      run = next;
    }
    expect(['victory', 'defeat']).toContain(run.screen);
    expect(isValidRunState(run)).toBe(true);
    if (run.screen === 'victory') {
      expect(run.floor).toBe(12);
      expect(run.hp).toBeGreaterThan(0);
    } else expect(run.hp).toBe(0);
    // Event state is deliberately persisted rather than resolved twice after reload.
    if (observedEventResult) expect((run.eventHistory ?? []).length).toBeGreaterThan(0);
    expect(deserializeRun(serializeRun(run))).toEqual(run);
  }, 30000);
});

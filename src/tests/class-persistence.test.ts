import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '../data/classes';
import { createCombat, getEnemies, reduceCombat } from '../engine';
import { deserializeGame, isValidCombatState, serializeGame } from '../engine/persistence';
import { createRun, getAvailableNodes, reduceRun } from '../engine/run';
import { deserializeRun, isValidRunState, serializeRun } from '../engine/runPersistence';
import type { ClassId, CombatState } from '../types/game';

function combatFixture(classId: ClassId, cardIds: string[], upgraded = false): CombatState {
  const deck = cardIds.map((cardId, index) => ({ uid: `fixture-${index}`, cardId, upgraded }));
  const state = createCombat('class-save-fixture', ['grit_scout', 'candle_moth'], { classId, deck });
  state.hand = [...deck];
  state.drawPile = [];
  state.discardPile = [];
  state.energy = 10;
  return state;
}

describe('class-aware saves preserve exact decisions and RNG', () => {
  it.each(CLASS_IDS)('%s startup and ongoing combat round-trip with the original versioned format', (classId) => {
    const run = createRun(`class-save-${classId}`, classId);
    expect(isValidRunState(run)).toBe(true);
    expect(deserializeRun(serializeRun(run))).toEqual(run);
    const battle = reduceRun(run, { type: 'chooseNode', nodeId: getAvailableNodes(run)[0].id });
    const restored = deserializeRun(serializeRun(battle))!;
    expect(restored).toEqual(battle);
    expect(restored.version).toBe(2);
    expect(restored.combat!.version).toBe(1);
    expect(reduceRun(restored, { type: 'combat', action: { type: 'endTurn' } })).toEqual(
      reduceRun(battle, { type: 'combat', action: { type: 'endTurn' } }),
    );
  });

  it('restores stars, forging, signed focus, orbs, summon HP and per-enemy doom without resetting them', () => {
    const state = combatFixture('oracle', ['oracle_awe', 'oracle_manifest']);
    state.classResources = {
      stars: 13, starsGainedThisTurn: 4, forge: 27, ostyHp: 8,
      focus: -2, temporaryFocus: 1, orbs: ['lightning', 'frost'], nextTurnEnergy: 2,
    };
    getEnemies(state)[0].doom = 12;
    getEnemies(state)[1].doom = 7;
    const restored = deserializeGame(serializeGame(state))!;
    expect(restored).toEqual(state);
    expect(restored.enemy).toBe(restored.enemies![0]);
    expect(reduceCombat(restored, { type: 'endTurn' })).toEqual(reduceCombat(state, { type: 'endTurn' }));
  });

  it.each(['berserker_anger', 'assassin_blade_dance', 'necromancer_soul_strike', 'oracle_manifest'])('%s generated cards survive reload and never enter the permanent deck', (cardId) => {
    const classId = cardId.split('_')[0] as ClassId;
    const state = combatFixture(classId, [cardId, `${classId}_strike`]);
    const after = reduceCombat(state, { type: 'playCard', cardId: state.hand[0].uid });
    expect(after.generatedCards!.length).toBeGreaterThan(0);
    expect(after.deck).toEqual(state.deck);
    expect(isValidCombatState(after)).toBe(true);
    const restored = deserializeGame(serializeGame(after))!;
    expect(restored).toEqual(after);
    expect(reduceCombat(restored, { type: 'endTurn' })).toEqual(reduceCombat(after, { type: 'endTurn' }));
  });

  it.each(['assassin_survivor', 'berserker_burning_pact'])('%s resumes the exact suspended selection and remaining effect queue', (cardId) => {
    const classId = cardId.startsWith('assassin') ? 'assassin' : 'berserker';
    const state = combatFixture(classId, [cardId, `${classId}_strike`, `${classId}_guard`]);
    const pending = reduceCombat(state, { type: 'playCard', cardId: state.hand[0].uid });
    expect(pending.pendingChoice).toBeDefined();
    const restored = deserializeGame(serializeGame(pending))!;
    expect(restored).toEqual(pending);
    const action = { type: 'chooseCards' as const, cardIds: [pending.hand[1].uid] };
    expect(reduceCombat(restored, action)).toEqual(reduceCombat(pending, action));
    expect(isValidCombatState(reduceCombat(restored, action))).toBe(true);
  });

  it('rejects malformed class resources, impossible orb counts, invalid doom and unknown class IDs', () => {
    const base = combatFixture('machinist', ['machinist_zap', 'machinist_guard']);
    const invalid: unknown[] = [
      { ...base, classId: 'colorless' },
      { ...base, classResources: undefined },
      { ...base, classResources: { ...base.classResources, stars: -1 } },
      { ...base, classResources: { ...base.classResources, forge: 0.5 } },
      { ...base, classResources: { ...base.classResources, orbs: ['lightning', 'frost', 'frost', 'frost'] } },
      { ...base, classResources: { ...base.classResources, orbs: ['dark'] } },
      { ...base, enemy: { ...base.enemy, doom: -1 }, enemies: undefined },
    ];
    for (const value of invalid) {
      expect(isValidCombatState(value)).toBe(false);
      expect(deserializeGame(JSON.stringify({ version: 1, combat: value }))).toBeNull();
    }
  });

  it('rejects a missing generated-card registry entry, duplicated UID, or future UID collision', () => {
    const base = combatFixture('assassin', ['assassin_blade_dance', 'assassin_guard']);
    const generated = reduceCombat(base, { type: 'playCard', cardId: base.hand[0].uid });
    expect(isValidCombatState(generated)).toBe(true);
    const missing = { ...generated, generatedCards: [] };
    const duplicate = { ...generated, generatedCards: [...generated.generatedCards!, generated.generatedCards![0]] };
    const collision = { ...generated, nextId: Number(generated.generatedCards![0].uid.replace('generated-', '')) };
    for (const value of [missing, duplicate, collision]) expect(isValidCombatState(value)).toBe(false);
  });

  it('rejects an invented continuation or a reduced mandatory discard count in a saved choice', () => {
    const base = combatFixture('assassin', ['assassin_preparation', 'assassin_guard', 'assassin_strike', 'assassin_guard'], true);
    const pending = reduceCombat(base, { type: 'playCard', cardId: base.hand[0].uid });
    expect(pending.pendingChoice!.amount).toBe(2);
    const payload = structuredClone(pending);
    payload.pendingChoice!.resume.effects = [{ type: 'energy', amount: 999 }];
    expect(isValidCombatState(payload)).toBe(false);
    const smaller = structuredClone(pending);
    smaller.pendingChoice!.amount = 1;
    expect(isValidCombatState(smaller)).toBe(false);
    const duplicate = structuredClone(pending);
    duplicate.hand.push(duplicate.pendingChoice!.resume.sourceCard!);
    expect(isValidCombatState(duplicate)).toBe(false);
  });

  it('rejects mismatched run/combat classes while continuing to load classless legacy saves', () => {
    const run = createRun('class-mismatch', 'necromancer');
    const battle = reduceRun(run, { type: 'chooseNode', nodeId: getAvailableNodes(run)[0].id });
    const wrong = structuredClone(battle);
    wrong.combat!.classId = 'oracle';
    expect(isValidRunState(wrong)).toBe(false);
    expect(deserializeRun(JSON.stringify({ version: 2, run: wrong }))).toBeNull();
    const oldRun = createRun('old-save');
    const oldCombat = createCombat('old-practice');
    expect(deserializeRun(serializeRun(oldRun))).toEqual(oldRun);
    expect(deserializeGame(serializeGame(oldCombat))).toEqual(oldCombat);
  });
});

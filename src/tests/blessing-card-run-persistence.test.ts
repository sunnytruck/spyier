import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import { getEnemies } from '../engine';
import { createBlessedRun, getAvailableNodes, reduceRun } from '../engine/run';
import { deserializeRun, isValidRunState, serializeRun } from '../engine/runPersistence';
import { chooseClassRunAction } from './helpers/classDriver';
import type { CombatAction } from '../types/game';
import type { RunState } from '../types/run';

const acquired = new Map<string, RunState>();

function roundTrip(state: RunState): RunState {
  expect(isValidRunState(state)).toBe(true);
  const raw = serializeRun(state);
  const restored = deserializeRun(raw);
  expect(restored).not.toBeNull();
  expect(restored).toEqual(state);
  expect(serializeRun(restored!)).toBe(raw);
  return restored!;
}

/** Obtain the primary limited card through a genuine frozen offer and receipt. */
function acquireLimitedCard(cardId: string): RunState {
  const cached = acquired.get(cardId);
  if (cached) return structuredClone(cached);
  for (let index = 0; index < 1000; index++) {
    const state = createBlessedRun(`limited-run-boundary-${cardId}-${index}`, 'berserker');
    const option = state.blessing!.options.find((entry) => entry.templateId === 'exclusive_lesson' && entry.rewards.some((reward) => reward.kind === 'cards' && reward.cardIds.includes(cardId)));
    if (!option) continue;
    const before = serializeRun(state);
    const selected = reduceRun(roundTrip(state), { type: 'chooseBlessing', optionId: option.id });
    expect(selected.blessing!.stage).toBe('confirm');
    const result = reduceRun(roundTrip(selected), { type: 'confirmBlessing' });
    expect(result.blessing!.stage).toBe('result');
    expect(result.blessing!.receipt!.addedCards.map((card) => card.cardId)).toEqual([cardId]);
    expect(result.deck.find((card) => card.cardId === cardId)?.upgraded).toBe(false);
    expect(reduceRun(result, { type: 'confirmBlessing' })).toBe(result);
    const map = reduceRun(roundTrip(result), { type: 'continueBlessing' });
    expect(map.screen).toBe('map');
    expect(serializeRun(state)).toBe(before);
    acquired.set(cardId, roundTrip(map));
    return structuredClone(map);
  }
  throw new Error(`No genuine exclusive offer found for ${cardId}`);
}

/**
 * Controlled combat-boundary fixture: acquisition and node entry are real.
 * Rearranging the existing zone inventory and raising energy isolates the
 * chosen card's persistence boundary from shuffle luck. Extra cards/upgrade
 * states below are explicit fixtures, not claims about acquisition routes.
 */
function battleFixture(cardId: string, upgraded = false, extraCardIds: string[] = []): RunState {
  let state = acquireLimitedCard(cardId);
  if (upgraded) state.deck.find((card) => card.cardId === cardId)!.upgraded = true;
  for (const extraId of extraCardIds) {
    state.deck.push({ uid: `card-${state.nextCardId++}`, cardId: extraId, upgraded: false });
    state.stats.cardsAdded += 1;
  }
  state = reduceRun(roundTrip(state), { type: 'chooseNode', nodeId: getAvailableNodes(state)[0].id });
  expect(state.screen).toBe('combat');
  const combat = state.combat!;
  const subjects = [cardId, ...extraCardIds].map((id) => combat.deck.find((card) => card.cardId === id)!);
  const ids = new Set(subjects.map((card) => card.uid));
  const remainder = combat.deck.filter((card) => !ids.has(card.uid));
  combat.hand = [...subjects, ...remainder.slice(0, Math.max(0, 5 - subjects.length))].map((card) => ({ ...card }));
  const hand = new Set(combat.hand.map((card) => card.uid));
  combat.drawPile = combat.deck.filter((card) => !hand.has(card.uid)).map((card) => ({ ...card }));
  combat.discardPile = [];
  combat.exhaustPile = [];
  combat.powers = [];
  combat.energy = 20;
  return roundTrip(state);
}

function combatStep(state: RunState, action: CombatAction): RunState {
  const raw = serializeRun(state);
  const restored = roundTrip(state);
  const result = reduceRun(state, { type: 'combat', action });
  expect(result).not.toBe(state);
  expect(serializeRun(state)).toBe(raw);
  expect(reduceRun(restored, { type: 'combat', action })).toEqual(result);
  return roundTrip(result);
}

function playById(state: RunState, cardId: string): RunState {
  const card = state.combat!.hand.find((entry) => entry.cardId === cardId);
  expect(card, `${cardId} must be in the controlled hand`).toBeDefined();
  return combatStep(state, { type: 'playCard', cardId: card!.uid });
}

function winOpeningBattle(state: RunState): RunState {
  for (let step = 0; state.screen === 'combat' && step < 300; step++) {
    const action = chooseClassRunAction(state);
    const next = reduceRun(roundTrip(state), action);
    expect(next).not.toBe(state);
    state = roundTrip(next);
  }
  expect(state.screen).toBe('reward');
  expect(state.combat!.phase).toBe('victory');
  return state;
}

function enterFollowingBattle(state: RunState): RunState {
  state = reduceRun(roundTrip(state), { type: 'takeCard', cardId: null });
  expect(state.screen).toBe('map');
  for (let step = 0; step < 100 && state.screen !== 'combat'; step++) {
    const action = state.screen === 'map'
      ? { type: 'chooseNode' as const, nodeId: (getAvailableNodes(state).find((node) => node.type === 'battle') ?? getAvailableNodes(state)[0]).id }
      : chooseClassRunAction(state);
    const next = reduceRun(roundTrip(state), action);
    expect(next).not.toBe(state);
    state = roundTrip(next);
  }
  expect(state.screen).toBe('combat');
  return state;
}

describe('limited cards across public campaign action and save boundaries', () => {
  it.each([false, true])('aurora permanently synchronizes max HP while fighting, at victory, and in the next battle (upgraded=%s)', (upgraded) => {
    let state = battleFixture('blessing_aurora', upgraded);
    const originalMaxHp = state.maxHp;
    expect(state.combat!.player.maxHp).toBe(originalMaxHp);
    expect(state.hp).toBe(originalMaxHp);
    const persistentDeck = structuredClone(state.deck);
    state = playById(state, 'blessing_aurora');
    expect(state.screen).toBe('combat');
    expect(state.maxHp).toBe(originalMaxHp - 1);
    expect(state.hp).toBe(originalMaxHp - 1);
    expect(state.combat!.player.maxHp).toBe(state.maxHp);
    expect(state.combat!.player.hp).toBe(state.hp);
    expect(state.deck).toEqual(persistentDeck);
    const mismatched = structuredClone(state);
    mismatched.maxHp = originalMaxHp;
    expect(isValidRunState(mismatched)).toBe(false);
    expect(deserializeRun(JSON.stringify({ version: 2, run: mismatched }))).toBeNull();
    state = winOpeningBattle(state);
    // A second use during normal play is possible after a reshuffle; every
    // payment must remain synchronized rather than resetting at victory.
    const finalMaxHp = state.maxHp;
    expect(finalMaxHp).toBeLessThan(originalMaxHp);
    expect(state.combat!.player.maxHp).toBe(finalMaxHp);
    const nextBattle = enterFollowingBattle(state);
    expect(nextBattle.maxHp).toBe(finalMaxHp);
    expect(nextBattle.combat!.player.maxHp).toBe(finalMaxHp);
    expect(nextBattle.deck).toEqual(persistentDeck);
  });

  it('apotheosis preserves captured normal delayed effects, saves temporary provenance, and restores the original run deck next battle', () => {
    // Relaxation is the explicitly added secondary boundary-fixture card.
    let state = battleFixture('blessing_apotheosis', false, ['blessing_relaxation']);
    const permanentDeck = structuredClone(state.deck);
    const normalRelaxation = state.deck.find((card) => card.cardId === 'blessing_relaxation')!;
    expect(normalRelaxation.upgraded).toBe(false);
    state = playById(state, 'blessing_relaxation');
    expect(state.combat!.scheduledEffects).toHaveLength(1);
    const scheduled = structuredClone(state.combat!.scheduledEffects![0]);
    expect(scheduled.effects).toEqual([{ type: 'draw', amount: 2 }, { type: 'energy', amount: 2 }]);
    expect(scheduled.sourceCard).toEqual(normalRelaxation);
    state = playById(state, 'blessing_apotheosis');
    expect(state.deck).toEqual(permanentDeck);
    expect(state.combat!.deck.every((card) => card.upgraded || CARD_DEFINITIONS[card.cardId].unupgradable)).toBe(true);
    expect(state.combat!.temporaryUpgrades).toHaveLength(permanentDeck.length);
    expect(state.combat!.scheduledEffects![0]).toEqual(scheduled);
    expect(state.combat!.scheduledEffects![0].sourceCard!.upgraded).toBe(false);
    const missingProvenance = structuredClone(state);
    delete missingProvenance.combat!.temporaryUpgrades;
    expect(isValidRunState(missingProvenance)).toBe(false);
    expect(deserializeRun(JSON.stringify({ version: 2, run: missingProvenance }))).toBeNull();
    state = combatStep(state, { type: 'endTurn' });
    expect(state.combat!.energy).toBe(5); // Normal captured +2, not upgraded +3.
    expect(state.combat!.hand).toHaveLength(7); // Normal captured draw2 + normal draw5.
    expect(state.combat!.scheduledEffects ?? []).toEqual([]);
    expect(state.deck).toEqual(permanentDeck);
    state = winOpeningBattle(state);
    expect(state.deck).toEqual(permanentDeck);
    expect(state.combat!.temporaryUpgrades!.length).toBeGreaterThan(0);
    roundTrip(state); // Terminal combat is still stored on the reward screen.
    state = enterFollowingBattle(state);
    expect(state.deck).toEqual(permanentDeck);
    expect(state.combat!.deck).toEqual(permanentDeck);
    expect(state.combat!.temporaryUpgrades).toBeUndefined();
    expect(state.combat!.scheduledEffects).toBeUndefined();
    expect(state.combat!.cardDamageBonuses).toBeUndefined();
    expect(state.combat!.deck.find((card) => card.uid === normalRelaxation.uid)?.upgraded).toBe(false);
  });

  it('max HP one to zero causes a serializable terminal run and cannot pay or reward twice after restoring', () => {
    // Explicit minimum-health fixture isolates the agreed lethal resource rule.
    let state = battleFixture('blessing_aurora');
    state.hp = state.maxHp = 1;
    state.combat!.player.hp = state.combat!.player.maxHp = 1;
    state.combat!.intangible = 1; // Enemy-only protection cannot prevent this cost.
    const deck = structuredClone(state.deck);
    state = roundTrip(state);
    const uid = state.combat!.hand.find((card) => card.cardId === 'blessing_aurora')!.uid;
    state = combatStep(state, { type: 'playCard', cardId: uid });
    expect(state.screen).toBe('defeat');
    expect(state.hp).toBe(0);
    expect(state.maxHp).toBe(0);
    expect(state.combat!.player.hp).toBe(0);
    expect(state.combat!.player.maxHp).toBe(0);
    expect(state.combat!.phase).toBe('defeat');
    expect(state.reward).toBeNull();
    expect(state.stats.battlesWon).toBe(0);
    expect(state.deck).toEqual(deck);
    const loaded = roundTrip(state);
    expect(reduceRun(loaded, { type: 'combat', action: { type: 'playCard', cardId: uid } })).toBe(loaded);
    expect(reduceRun(loaded, { type: 'combat', action: { type: 'endTurn' } })).toBe(loaded);
    expect(reduceRun(loaded, { type: 'takeCard', cardId: null })).toBe(loaded);
    expect(getEnemies(loaded.combat!).some((enemy) => enemy.hp > 0)).toBe(true);
  });
});

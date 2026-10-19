import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '../data/classes';
import { getEnemies } from '../engine';
import { canAscendAct, createBlessedRun, createRun, getAvailableNodes, reduceRun } from '../engine/run';
import { deserializeRun, isValidRunState, serializeRun } from '../engine/runPersistence';
import { chooseClassRunAction } from './helpers/classDriver';
import { createRoguelikeDriver } from './helpers/roguelikeDriver';
import previousSaves from './fixtures/pre-blessing-saves.json';

/** Real saves captured by isolated 51974c9, before any Act/blessing fields existed. */
describe('pre-blessing version-2 saves keep their original single-Act contract', () => {
  const savedRuns = [
    ['oracleMap', previousSaves.oracleMap],
    ['necroCombat', previousSaves.necroCombat],
    ['machinistVictory', previousSaves.machinistVictory],
  ] as const;

  it.each(savedRuns)('%s restores exact saved bytes without opting into a new campaign', (_name, envelope) => {
    const raw = JSON.stringify(envelope);
    let state = deserializeRun(raw)!;
    expect(state).not.toBeNull();
    expect(isValidRunState(state)).toBe(true);
    expect(serializeRun(state)).toBe(raw);
    expect(Object.hasOwn(state, 'act')).toBe(false);
    expect(Object.hasOwn(state, 'maxActs')).toBe(false);
    expect(Object.hasOwn(state, 'blessing')).toBe(false);
    const oldMap = JSON.stringify(state.map);
    const rejectedAscent = { type: 'ascendAct' } as const;
    expect(reduceRun(state, rejectedAscent)).toBe(state);
    if (state.screen === 'victory') {
      expect(state.hp).toBe(61);
      expect(state.floor).toBe(12);
      expect(reduceRun(state, { type: 'chooseNode', nodeId: state.map.nodes[0].id })).toBe(state);
    } else {
      for (let step = 0; step < 12 && !['victory', 'defeat'].includes(state.screen); step++) {
        const restored = deserializeRun(serializeRun(state))!;
        const action = chooseClassRunAction(state);
        const next = reduceRun(state, action);
        expect(next).not.toBe(state);
        expect(reduceRun(restored, action)).toEqual(next);
        expect(JSON.stringify(next.map)).toBe(oldMap);
        expect(Object.hasOwn(next, 'act')).toBe(false);
        expect(Object.hasOwn(next, 'blessing')).toBe(false);
        state = next;
      }
    }
    expect(JSON.stringify(envelope)).toBe(raw);
  });

  it('records the genuine pre-change commit and preserves all three real phases', () => {
    expect(previousSaves.sourceCommit).toBe('51974c9f02054e8d89c2092df2b020ac98efc8ce');
    expect(savedRuns.map(([, envelope]) => envelope.run.screen)).toEqual(['map', 'combat', 'victory']);
  });
});

function inventory(state: ReturnType<typeof createRun>) {
  return {
    hp: state.hp, maxHp: state.maxHp, gold: state.gold, deck: state.deck,
    relicIds: state.relicIds, potions: state.potions, nextCardId: state.nextCardId, stats: state.stats,
  };
}

describe('new player campaigns commit a saved blessing before entering the map', () => {
  it.each(CLASS_IDS)('%s starts with the same four frozen choices and applies one receipt only', (classId) => {
    let state = createBlessedRun(`blessing-first-${classId}`, classId);
    expect(state).toEqual(createBlessedRun(`blessing-first-${classId}`, classId));
    expect(state.screen).toBe('blessing');
    expect(state.act).toBe(1);
    expect(state.maxActs).toBe(3);
    expect(state.blessing!.characterId).toBe('jitto_god');
    expect(state.blessing!.options).toHaveLength(4);
    expect(new Set(state.blessing!.options.map((option) => option.id)).size).toBe(4);
    expect(state.blessing!.options.some((option) => option.risk === 'safe')).toBe(true);
    expect(state.blessing!.options.some((option) => option.risk === 'risky')).toBe(true);
    expect(getAvailableNodes(state)).toEqual([]);
    expect(reduceRun(state, { type: 'chooseNode', nodeId: state.map.nodes[0].id })).toBe(state);
    expect(reduceRun(state, { type: 'confirmBlessing' })).toBe(state);
    expect(reduceRun(state, { type: 'continueBlessing' })).toBe(state);
    expect(reduceRun(state, { type: 'chooseBlessing', optionId: 'missing-option' })).toBe(state);
    const originalOffers = JSON.stringify(state.blessing!.options);
    const before = inventory(state);
    let receiptSeen = false;
    for (let step = 0; step < 8 && state.screen === 'blessing'; step++) {
      const raw = serializeRun(state);
      const restored = deserializeRun(raw)!;
      expect(restored).not.toBeNull();
      expect(serializeRun(restored)).toBe(raw);
      expect(JSON.stringify(restored.blessing!.options)).toBe(originalOffers);
      const action = chooseClassRunAction(state);
      const next = reduceRun(state, action);
      expect(next).not.toBe(state);
      expect(serializeRun(state)).toBe(raw);
      expect(reduceRun(restored, action)).toEqual(next);
      expect(next.rngState).toBe(state.rngState);
      if (action.type === 'chooseBlessing' || action.type === 'selectBlessingTargets') {
        expect(inventory(next)).toEqual(before);
        expect(next.blessingHistory).toEqual([]);
      }
      if (action.type === 'confirmBlessing') {
        receiptSeen = true;
        expect(next.blessing!.stage).toBe('result');
        expect(next.blessingHistory).toHaveLength(1);
        const receipt = next.blessing!.receipt!;
        expect(receipt.act).toBe(1);
        expect(next.hp - before.hp).toBe(receipt.hpChange);
        expect(next.maxHp - before.maxHp).toBe(receipt.maxHpChange);
        expect(next.gold - before.gold).toBe(receipt.goldChange);
        expect(next.blessingHistory![0].receipt).toEqual(receipt);
        expect(reduceRun(next, action)).toBe(next);
        expect(reduceRun(next, { type: 'chooseBlessing', optionId: state.blessing!.options[0].id })).toBe(next);
      }
      state = next;
    }
    expect(receiptSeen).toBe(true);
    expect(state.screen).toBe('map');
    expect(state.blessing).toBeNull();
    expect(state.blessingHistory).toHaveLength(1);
    expect(getAvailableNodes(state)).toHaveLength(3);
    expect(reduceRun(state, { type: 'continueBlessing' })).toBe(state);
    expect(reduceRun(state, { type: 'confirmBlessing' })).toBe(state);
    expect(reduceRun(state, { type: 'ascendAct' })).toBe(state);
    const restored = deserializeRun(serializeRun(state))!;
    expect(restored).toEqual(state);
    const noHistory = structuredClone(state);
    noHistory.blessingHistory = [];
    expect(isValidRunState(noHistory)).toBe(false);
    expect(deserializeRun(JSON.stringify({ version: 2, run: noHistory }))).toBeNull();
  });

  it.each(['remove', 'upgrade', 'transform'] as const)('%s targets remain pending through reload and only the exact selection is committed', (kind) => {
    let state = createBlessedRun('target-search-unused', 'berserker');
    let option = state.blessing!.options.find((candidate) => candidate.target?.kind === kind && candidate.target.count === (kind === 'remove' ? 1 : 2));
    for (let seed = 0; !option && seed < 100; seed++) {
      state = createBlessedRun(`blessing-target-${seed}`, 'berserker');
      option = state.blessing!.options.find((candidate) => candidate.target?.kind === kind && candidate.target.count === (kind === 'remove' ? 1 : 2));
    }
    expect(option).toBeDefined();
    const basis = inventory(state);
    const offers = JSON.stringify(state.blessing!.options);
    state = reduceRun(state, { type: 'chooseBlessing', optionId: option!.id });
    expect(state.blessing!.stage).toBe('targets');
    expect(reduceRun(state, { type: 'confirmBlessing' })).toBe(state);
    const target = option!.target!;
    const uids = target.eligibleCardUids.slice(0, target.count);
    expect(reduceRun(state, { type: 'selectBlessingTargets', cardUids: ['missing-uid'] })).toBe(state);
    expect(reduceRun(state, { type: 'selectBlessingTargets', cardUids: [uids[0], uids[0]] })).toBe(state);
    if (target.count > 1) {
      state = reduceRun(state, { type: 'selectBlessingTargets', cardUids: uids.slice(0, 1) });
      expect(state.blessing!.stage).toBe('targets');
      state = deserializeRun(serializeRun(state))!;
      expect(state.blessing!.selectedCardUids).toEqual(uids.slice(0, 1));
      expect(reduceRun(state, { type: 'confirmBlessing' })).toBe(state);
    }
    state = reduceRun(state, { type: 'selectBlessingTargets', cardUids: uids });
    expect(state.blessing!.stage).toBe('confirm');
    expect(inventory(state)).toEqual(basis);
    expect(JSON.stringify(state.blessing!.options)).toBe(offers);
    const restored = deserializeRun(serializeRun(state))!;
    expect(restored.blessing!.selectedCardUids).toEqual(uids);
    const next = reduceRun(restored, { type: 'confirmBlessing' });
    expect(next.blessing!.stage).toBe('result');
    const receipt = next.blessing!.receipt!;
    if (kind === 'remove') expect(receipt.removedCards.map((card) => card.uid)).toEqual(uids);
    if (kind === 'upgrade') expect(receipt.upgradedCards.map((card) => card.uid)).toEqual(uids);
    if (kind === 'transform') {
      expect(receipt.transformedCards.map(({ before }) => before.uid)).toEqual(uids);
      for (const change of receipt.transformedCards)
        expect(change.after.cardId).toBe(target.replacements![change.before.uid]);
    }
    for (const card of basis.deck.filter((card) => !uids.includes(card.uid)))
      expect(next.deck.find((entry) => entry.uid === card.uid)).toEqual(card);
    expect(reduceRun(next, { type: 'confirmBlessing' })).toBe(next);
    expect(deserializeRun(serializeRun(next))).toEqual(next);
  });
});

describe('new campaigns advance through actual boss rewards and saved Act transitions', () => {
  it('can clear all three Acts through legal battles, boss rewards and two saved ascents', () => {
    const seed = 'blessed-campaign-1';
    const decide = createRoguelikeDriver('safe', seed);
    let state = createBlessedRun(seed, 'machinist');
    const bossRewards: number[] = [];
    const ascents: number[] = [];
    for (let step = 0; step < 6000 && state.screen !== 'defeat'; step++) {
      if (state.screen === 'victory' && !canAscendAct(state)) break;
      expect(isValidRunState(state)).toBe(true);
      if (state.screen === 'reward' && state.reward!.completesRun && !bossRewards.includes(state.act!)) bossRewards.push(state.act!);
      state = deserializeRun(serializeRun(state))!;
      const action = decide(state);
      const next = reduceRun(state, action);
      expect(next, `${state.act}:${state.floor}:${state.screen}:${action.type}`).not.toBe(state);
      if (action.type === 'ascendAct') ascents.push(state.act!);
      state = next;
    }
    expect(state.screen).toBe('victory');
    expect(state.act).toBe(3);
    expect(state.hp).toBeGreaterThan(0);
    expect(bossRewards).toEqual([1, 2, 3]);
    expect(ascents).toEqual([1, 2]);
    expect(state.actHistory!.map((entry) => entry.act)).toEqual([1, 2]);
    expect(state.blessingHistory!.map((entry) => entry.act)).toEqual([1, 2, 3]);
    expect(state.blessingHistory!.every((entry) => entry.receipt.encounterId === entry.encounterId)).toBe(true);
    expect(deserializeRun(serializeRun(state))).toEqual(state);
    expect(reduceRun(state, { type: 'ascendAct' })).toBe(state);
  }, 30000);

  it.each(CLASS_IDS)('%s reaches a genuine terminal result while preserving each public Act boundary', (classId) => {
    const seed = 'blessed-campaign-0';
    const decide = createRoguelikeDriver('safe', seed);
    let state = createBlessedRun(seed, classId);
    const bossRewards = new Set<number>();
    const reached = new Set<number>([1]);
    for (let step = 0; step < 6000 && state.screen !== 'defeat'; step++) {
      if (state.screen === 'victory' && !canAscendAct(state)) break;
      expect(isValidRunState(state), `${classId} Act${state.act}: ${state.screen} floor${state.floor}`).toBe(true);
      const raw = serializeRun(state);
      const restored = deserializeRun(raw)!;
      expect(restored).not.toBeNull();
      expect(serializeRun(restored)).toBe(raw);
      if (state.screen === 'reward' && state.reward!.completesRun) bossRewards.add(state.act!);
      const action = decide(state);
      const next = reduceRun(state, action);
      expect(next, `${classId} ${state.screen}: ${JSON.stringify(action)}`).not.toBe(state);
      expect(serializeRun(state)).toBe(raw);
      expect(reduceRun(restored, action)).toEqual(next);
      if (action.type === 'ascendAct') {
        expect(state.screen).toBe('victory');
        expect(bossRewards.has(state.act!)).toBe(true);
        expect(next.act).toBe(state.act! + 1);
        expect(inventory(next)).toEqual(inventory(state));
        expect(next.rngState).toBe(state.rngState);
        expect(next.floor).toBe(0);
        expect(next.visited).toEqual([]);
        expect(next.currentNodeId).toBeNull();
        expect(next.combat).toBeNull();
        expect(next.reward).toBeNull();
        expect(next.screen).toBe('blessing');
        expect(next.blessing!.stage).toBe('offer');
        expect(next.blessing!.act).toBe(next.act);
        expect(next.blessing!.characterId).not.toBe(state.blessingHistory!.at(-1)!.characterId);
        expect(next.actHistory!.at(-1)).toMatchObject({ act: state.act, map: state.map, visited: state.visited, hp: state.hp, maxHp: state.maxHp, gold: state.gold });
        expect(reduceRun(next, action)).toBe(next);
        reached.add(next.act!);
      }
      if (next.screen === 'combat' && next.act! > 1)
        expect(getEnemies(next.combat!).every((enemy) => enemy.id.startsWith(`act${next.act}_`))).toBe(true);
      state = next;
    }
    expect(state.screen === 'defeat' || state.screen === 'victory' && !canAscendAct(state)).toBe(true);
    expect(isValidRunState(state)).toBe(true);
    expect(state.blessingHistory!.length).toBe(state.act);
    expect(deserializeRun(serializeRun(state))).toEqual(state);
    expect(reduceRun(state, { type: 'ascendAct' })).toBe(state);
    if (state.screen === 'victory') {
      expect(state.act).toBe(3);
      expect([...reached]).toEqual([1, 2, 3]);
      expect([...bossRewards]).toEqual([1, 2, 3]);
      expect(state.actHistory).toHaveLength(2);
      expect(state.hp).toBeGreaterThan(0);
    } else expect(state.hp).toBe(0);
  }, 30000);
});

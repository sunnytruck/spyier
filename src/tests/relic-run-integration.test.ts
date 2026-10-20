import { describe, expect, it } from 'vitest';
import { CLASS_DEFINITIONS, CLASS_IDS } from '../data/classes';
import { STARTER_RELIC_IDS, STARTER_UPGRADE_IDS } from '../data/starterRelics';
import { getRelicPool, RELIC_DEFINITIONS } from '../data/relics';
import { CARD_DEFINITIONS } from '../data/cards';
import { isNormalAcquisitionCard } from '../engine/cardAcquisition';
import { getCardPool } from '../engine/cardPools';
import { createBlessedRun, getAvailableNodes, getShopRelicPrice, reduceRun } from '../engine/run';
import { createBlessingEncounter } from '../engine/blessings';
import { deserializeRun, isValidRunState, serializeRun } from '../engine/runPersistence';
import { chooseClassRunAction } from './helpers/classDriver';
import { createRoguelikeDriver } from './helpers/roguelikeDriver';
import { chooseRelicAcquisitionAction } from './helpers/relicAcquisitionDriver';
import preRelicSaves from './fixtures/pre-relic-saves.json';
import type { ClassId } from '../types/game';
import type { RunState } from '../types/run';

const legacyStarterIds = {
  berserker: 'warm_pebble', assassin: 'fossil_bookmark', oracle: 'amber_spark',
  necromancer: 'gate_fragment', machinist: 'layered_charm',
};

/** These are real old-engine snapshots, not new states edited to look old. */
describe('0038936 saves retain their stored relics and committed rewards', () => {
  it.each(CLASS_IDS)('%s resumes the old starter without granting a replacement', (classId) => {
    const envelope = preRelicSaves.starterCombat[classId];
    const raw = JSON.stringify(envelope);
    let state = deserializeRun(raw)!;
    expect(state).not.toBeNull();
    expect(isValidRunState(state)).toBe(true);
    expect(serializeRun(state)).toBe(raw);
    expect(state.relicIds[0]).toBe(legacyStarterIds[classId]);
    expect(state.combat!.relicIds).toEqual(state.relicIds);
    const savedMap = JSON.stringify(state.map);
    for (let step = 0; step < 18 && !['victory', 'defeat'].includes(state.screen); step++) {
      const saved = serializeRun(state);
      const restored = deserializeRun(saved)!;
      expect(restored).not.toBeNull();
      expect(serializeRun(restored)).toBe(saved);
      const action = chooseClassRunAction(state);
      const next = reduceRun(state, action);
      expect(next).not.toBe(state);
      expect(reduceRun(restored, action)).toEqual(next);
      expect(isValidRunState(next)).toBe(true);
      expect(next.relicIds).toContain(legacyStarterIds[classId]);
      expect(JSON.stringify(next.map)).toBe(savedMap);
      state = next;
    }
    expect(JSON.stringify(envelope)).toBe(raw);
  });

  it('keeps an already fired starter counter through repeated load and turn advancement', () => {
    const raw = JSON.stringify(preRelicSaves.activeCounterCombat);
    const state = deserializeRun(raw)!;
    expect(state).not.toBeNull();
    expect(serializeRun(state)).toBe(raw);
    expect(state.combat!.turn).toBe(2);
    expect(state.combat!.relicCounters!.fossil_bookmark).toBe(1);
    const restored = deserializeRun(serializeRun(state))!;
    expect(restored.combat!.relicCounters).toEqual(state.combat!.relicCounters);
    const next = reduceRun(restored, { type: 'combat', action: { type: 'endTurn' } });
    expect(next.combat!.turn).toBe(3);
    expect(next.combat!.relicCounters!.fossil_bookmark).toBe(1);
    expect(deserializeRun(serializeRun(next))).toEqual(next);
  });

  it('preserves an old blessing relic receipt and only continues once', () => {
    const raw = JSON.stringify(preRelicSaves.blessingReceipt);
    const state = deserializeRun(raw)!;
    expect(state).not.toBeNull();
    expect(serializeRun(state)).toBe(raw);
    expect(state.blessing!.stage).toBe('result');
    const relics = [...state.relicIds];
    expect(reduceRun(state, { type: 'confirmBlessing' })).toBe(state);
    const next = reduceRun(state, { type: 'continueBlessing' });
    expect(next.screen).toBe('map');
    expect(next.relicIds).toEqual(relics);
    expect(next.blessingHistory).toEqual(state.blessingHistory);
    expect(reduceRun(next, { type: 'continueBlessing' })).toBe(next);
    expect(deserializeRun(serializeRun(next))).toEqual(next);
  });

  it('does not reroll a pre-existing boss card reward during loading or skipping', () => {
    const raw = JSON.stringify(preRelicSaves.bossReward);
    const state = deserializeRun(raw)!;
    expect(state).not.toBeNull();
    expect(serializeRun(state)).toBe(raw);
    expect(state.screen).toBe('reward');
    expect(state.reward!.completesRun).toBe(true);
    const savedOffer = [...state.reward!.cardIds];
    expect(deserializeRun(serializeRun(state))!.reward!.cardIds).toEqual(savedOffer);
    const next = reduceRun(state, { type: 'takeCard', cardId: null });
    expect(next).not.toBe(state);
    expect(next.deck).toEqual(state.deck);
    expect(deserializeRun(serializeRun(next))).toEqual(next);
    expect(reduceRun(next, { type: 'takeCard', cardId: savedOffer[0] })).toBe(next);
  });

  it('records the actual source revision and captured public phases', () => {
    expect(preRelicSaves.sourceCommit).toBe('0038936');
    expect(Object.keys(preRelicSaves.starterCombat)).toEqual(CLASS_IDS);
    expect(preRelicSaves.blessingReceipt.run.screen).toBe('blessing');
    expect(preRelicSaves.bossReward.run.screen).toBe('reward');
  });
});

/** Choose an existing safe numeric blessing, so no combat relic/card masks the starter. */
function beginNewClassCombat(classId: ClassId): RunState {
  for (let index = 0; index < 100; index++) {
    let state = createBlessedRun(`relic-starter-${classId}-${index}`, classId);
    const numeric = state.blessing!.options.find((option) =>
      option.costs.length === 0 && option.target === null &&
      option.rewards.every((reward) => ['maxHp', 'heal', 'gold'].includes(reward.kind)));
    if (!numeric) continue;
    state = reduceRun(state, { type: 'chooseBlessing', optionId: numeric.id });
    state = reduceRun(state, { type: 'confirmBlessing' });
    state = reduceRun(state, { type: 'continueBlessing' });
    expect(state.screen).toBe('map');
    const node = getAvailableNodes(state).find((candidate) => candidate.type === 'battle');
    expect(node).toBeDefined();
    state = reduceRun(state, { type: 'chooseNode', nodeId: node!.id });
    expect(state.screen).toBe('combat');
    return state;
  }
  throw new Error(`No numeric opening blessing for ${classId}`);
}

describe('new class runs receive source starter effects at their specified public timing', () => {
  it.each(CLASS_IDS)('%s receives exactly its source starter and preserves its started state on reload', (classId) => {
    expect(CLASS_DEFINITIONS[classId].starterRelicId).toBe(STARTER_RELIC_IDS[classId]);
    const state = beginNewClassCombat(classId);
    const id = STARTER_RELIC_IDS[classId];
    expect(state.relicIds).toEqual([id]);
    expect(state.combat!.relicIds).toEqual([id]);
    expect(state.combat!.turn).toBe(1);
    const raw = serializeRun(state);
    expect(deserializeRun(raw)).toEqual(state);
    expect(serializeRun(deserializeRun(raw)!)).toBe(raw);
    if (classId === 'berserker') expect(state.combat!.relicCounters?.[id] ?? 0).toBe(0);
    else expect(state.combat!.relicCounters![id]).toBe(1);
    if (classId === 'assassin') expect(state.combat!.hand).toHaveLength(7);
    if (classId === 'oracle') {
      expect(state.combat!.classResources!.stars).toBe(3);
      expect(state.combat!.classResources!.starsGainedThisTurn).toBe(3);
    }
    if (classId === 'necromancer') expect(state.combat!.classResources!.ostyHp).toBe(1);
    if (classId === 'machinist') expect(state.combat!.classResources!.orbs).toEqual(['lightning']);
  });

  it('the start-of-battle lightning is not generated a second time on the next player turn', () => {
    const state = beginNewClassCombat('machinist');
    const next = reduceRun(deserializeRun(serializeRun(state))!, { type: 'combat', action: { type: 'endTurn' } });
    expect(next.combat!.turn).toBe(2);
    expect(next.combat!.classResources!.orbs).toEqual(['lightning']);
    expect(next.combat!.relicCounters![STARTER_RELIC_IDS.machinist]).toBe(1);
    expect(deserializeRun(serializeRun(next))).toEqual(next);
  });

  it('the sealed phylactery invokes the existing summon resource on every turn start', () => {
    const state = beginNewClassCombat('necromancer');
    const next = reduceRun(state, { type: 'combat', action: { type: 'endTurn' } });
    expect(next.combat!.turn).toBe(2);
    // The first spirit may absorb the real enemy hit before the second summon.
    expect(next.combat!.classResources!.ostyHp).toBeGreaterThanOrEqual(1);
    expect(next.combat!.classResources!.ostyHp).toBeLessThanOrEqual(2);
    expect(next.combat!.relicCounters![STARTER_RELIC_IDS.necromancer]).toBe(2);
    expect(deserializeRun(serializeRun(next))).toEqual(next);
  });
});

describe('relic acquisition categories and class restrictions remain independent', () => {
  it.each(CLASS_IDS)('%s never receives starters or another source category through a normal pool', (classId) => {
    for (const source of ['normal', 'shop', 'ancient', 'event'] as const) {
      const ids = getRelicPool(classId, source);
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        const relic = RELIC_DEFINITIONS[id];
        expect(relic.acquisition, `${source}:${id}`).toBe(source);
        expect(relic.rarity).not.toBe('starter');
        expect(relic.upgradeFrom).toBeUndefined();
        expect(!relic.classId || relic.classId === classId, id).toBe(true);
      }
      expect(getRelicPool(classId, source, ids)).toEqual([]);
    }
  });

  it.each(CLASS_IDS)('%s can exchange only its own already owned starter for the corresponding upgrade', (classId) => {
    expect(getRelicPool(classId, 'starterUpgrade')).toEqual([]);
    const upgrade = getRelicPool(classId, 'starterUpgrade', [STARTER_RELIC_IDS[classId]]);
    expect(upgrade).toHaveLength(1);
    expect(RELIC_DEFINITIONS[upgrade[0]].classId).toBe(classId);
    expect(RELIC_DEFINITIONS[upgrade[0]].upgradeFrom).toBe(STARTER_RELIC_IDS[classId]);
    expect(getRelicPool(classId, 'starterUpgrade', [...upgrade, STARTER_RELIC_IDS[classId]])).toEqual([]);
    for (const other of CLASS_IDS.filter((candidate) => candidate !== classId))
      expect(getRelicPool(other, 'starterUpgrade', [STARTER_RELIC_IDS[classId]])).toEqual([]);
  });
});

/** A genuine campaign search, using no injected deck, HP, room, outcome or random state. */
function reachNewBossReward(classId: ClassId): RunState {
  for (let attempt = 0; attempt < 8; attempt++) {
    const seed = `relic-boss-${classId}-${attempt}`;
    const decide = createRoguelikeDriver('safe', seed);
    let state = createBlessedRun(seed, classId);
    for (let step = 0; step < 1600 && state.screen !== 'defeat'; step++) {
      if (state.screen === 'reward' && state.reward?.completesRun) return state;
      if (state.screen === 'victory') break;
      if (step % 20 === 0) {
        const restored = deserializeRun(serializeRun(state));
        expect(restored, `${classId}:${state.screen}:${state.floor}`).not.toBeNull();
        expect(restored).toEqual(state);
        state = restored!;
      }
      const action = decide(state);
      const next = reduceRun(state, action);
      expect(next, `${classId}:${state.screen}:${action.type}`).not.toBe(state);
      state = next;
    }
  }
  throw new Error(`Eight legal ${classId} campaigns did not reach a boss reward`);
}

describe('new boss rewards present three frozen own-class rare cards before leaving the Act', () => {
  it.each(CLASS_IDS)('%s has three legal rare choices, maximizes variety and can choose or skip exactly once', (classId) => {
    const state = reachNewBossReward(classId);
    expect(state.reward!.rareOnly).toBe(true);
    expect(state.reward!.cardIds).toHaveLength(3);
    const rareCount = getCardPool(classId, 'combat').filter((id) => CARD_DEFINITIONS[id].rarity === 'rare').length;
    expect(new Set(state.reward!.cardIds).size).toBe(Math.min(3, rareCount));
    for (const id of state.reward!.cardIds) {
      expect(CARD_DEFINITIONS[id].classId).toBe(classId);
      expect(CARD_DEFINITIONS[id].rarity).toBe('rare');
      expect(isNormalAcquisitionCard(CARD_DEFINITIONS[id])).toBe(true);
    }
    const raw = serializeRun(state);
    const restored = deserializeRun(raw)!;
    expect(restored).not.toBeNull();
    expect(serializeRun(restored)).toBe(raw);
    expect(restored.reward!.cardIds).toEqual(state.reward!.cardIds);
    const wrongRarity = structuredClone(state);
    wrongRarity.reward!.cardIds[0] = CLASS_DEFINITIONS[classId].starterDeck[0];
    expect(isValidRunState(wrongRarity)).toBe(false);
    const wrongAcquisition = structuredClone(state);
    wrongAcquisition.reward!.cardIds[0] = 'blessing_apotheosis';
    expect(isValidRunState(wrongAcquisition)).toBe(false);
    if (rareCount >= 3) {
      const duplicate = structuredClone(state);
      duplicate.reward!.cardIds[1] = duplicate.reward!.cardIds[0];
      expect(isValidRunState(duplicate)).toBe(false);
    }
    expect(reduceRun(restored, { type: 'ascendAct' })).toBe(restored);
    expect(reduceRun(restored, { type: 'takeCard', cardId: 'blessing_apotheosis' })).toBe(restored);
    const skipped = reduceRun(restored, { type: 'takeCard', cardId: null });
    expect(skipped).not.toBe(restored);
    expect(skipped.deck).toEqual(restored.deck);
    expect(reduceRun(skipped, { type: 'takeCard', cardId: null })).toBe(skipped);
    expect(deserializeRun(serializeRun(skipped))).toEqual(skipped);
    const chosen = reduceRun(state, { type: 'takeCard', cardId: state.reward!.cardIds[0] });
    expect(chosen).not.toBe(state);
    expect(chosen.deck.filter((card) => card.cardId === state.reward!.cardIds[0]).length)
      .toBeGreaterThan(state.deck.filter((card) => card.cardId === state.reward!.cardIds[0]).length);
    expect(reduceRun(chosen, { type: 'takeCard', cardId: state.reward!.cardIds[0] })).toBe(chosen);
    expect(deserializeRun(serializeRun(chosen))).toEqual(chosen);
    expect(JSON.stringify(state)).toBe(JSON.stringify(restored));
  }, 30000);
});

/** All encounter, ownership and payment proofs originate in public run actions. */
function chooseBlessingRelic(seed: string, relicId: string, classId: ClassId = 'machinist'): RunState {
  let state = createBlessedRun(seed, classId);
  expect(state.blessing!.options).toHaveLength(4);
  const option = state.blessing!.options.find((candidate) => candidate.rewards.some((reward) =>
    reward.kind === 'relic' && reward.relicId === relicId));
  expect(option, `${seed}:${relicId}`).toBeDefined();
  state = reduceRun(state, { type: 'chooseBlessing', optionId: option!.id });
  state = reduceRun(state, { type: 'confirmBlessing' });
  expect(state.blessing!.stage).toBe('result');
  expect(state.relicIds).toContain(relicId);
  expect(deserializeRun(serializeRun(state))).toEqual(state);
  const continued = reduceRun(state, { type: 'continueBlessing' });
  expect(continued.screen).toBe('relicAcquisition');
  expect(reduceRun(continued, { type: 'continueBlessing' })).toBe(continued);
  return continued;
}

/** A finite deterministic seed search avoids coupling storage tests to pool length. */
function findOpeningRelic(prefix: string, relicId: string, classId: ClassId): RunState {
  for (let index = 0; index < 1000; index++) {
    const seed = `${prefix}-${index}`;
    const candidate = createBlessedRun(seed, classId);
    if (candidate.blessing!.options.some((option) => option.rewards.some((reward) =>
      reward.kind === 'relic' && reward.relicId === relicId)))
      return chooseBlessingRelic(seed, relicId, classId);
  }
  throw new Error(`No opening ${relicId} among 1000 deterministic ${classId} seeds`);
}

describe('post-blessing relic selection is a separately saved, exactly-once run transaction', () => {
  it.each([
    ['relic-acquisition-legal-7', 'ref_lead_paperweight', 'chooseCard'],
    ['relic-acquisition-legal-23', 'ref_dangerous_scissors', 'remove'],
    ['relic-acquisition-legal-53', 'ref_claw', 'transform'],
    ['relic-acquisition-legal-94', 'ref_tasty_cookie', 'upgrade'],
  ] as const)('%s saves the uncommitted %s choice and its exact result', (seed, relicId, kind) => {
    let state = chooseBlessingRelic(seed, relicId);
    expect(state.relicAcquisition!.stage).toBe('select');
    expect(state.relicAcquisition!.kind).toBe(kind);
    const before = structuredClone(state);
    const pending = before.relicAcquisition!;
    const action = chooseRelicAcquisitionAction(state, reduceRun);
    expect(action.type).toBe('selectRelicCards');
    const selected = reduceRun(state, action);
    expect(selected.deck).toEqual(before.deck);
    expect(selected.hp).toBe(before.hp);
    expect(selected.gold).toBe(before.gold);
    expect(selected.rngState).toBe(before.rngState);
    expect(selected.relicAcquisition!.replacements).toEqual(pending.replacements);
    state = deserializeRun(serializeRun(selected))!;
    expect(state).toEqual(selected);
    expect(reduceRun(state, { type: 'leaveNode' })).toBe(state);
    expect(reduceRun(state, { type: 'continueRelicAcquisition' })).toBe(state);
    const confirmed = reduceRun(state, { type: 'confirmRelicAcquisition' });
    expect(confirmed.relicAcquisition!.stage).toBe('result');
    expect(confirmed.rngState).toBe(before.rngState);
    const receipt = confirmed.relicAcquisition!.receipt!;
    if (kind === 'chooseCard') {
      expect(receipt.addedCards).toHaveLength(1);
      expect(pending.offeredCardIds).toContain(receipt.addedCards[0].cardId);
      expect(CARD_DEFINITIONS[receipt.addedCards[0].cardId].classId).toBe('colorless');
      expect(isNormalAcquisitionCard(CARD_DEFINITIONS[receipt.addedCards[0].cardId])).toBe(true);
    } else if (kind === 'remove') {
      expect(receipt.removedCards.map((card) => card.uid)).toEqual(state.relicAcquisition!.selectedCardUids);
      expect(receipt.removedCards).toHaveLength(2);
      expect(confirmed.hp).toBe(before.hp - 16);
      expect(confirmed.deck).toHaveLength(before.deck.length - 2);
    } else if (kind === 'transform') {
      expect(receipt.addedCards).toHaveLength(6);
      expect(receipt.removedCards).toHaveLength(6);
      expect(receipt.addedCards.every((card) => card.cardId === 'blessing_rending')).toBe(true);
      expect(confirmed.deck).toHaveLength(before.deck.length);
    } else {
      expect(receipt.upgradedCards).toHaveLength(4);
      expect(receipt.upgradedCards.every((card) => card.upgraded)).toBe(true);
      expect(confirmed.deck.filter((card) => card.upgraded)).toHaveLength(4);
    }
    const raw = serializeRun(confirmed);
    const restored = deserializeRun(raw)!;
    expect(serializeRun(restored)).toBe(raw);
    expect(reduceRun(restored, { type: 'confirmRelicAcquisition' })).toBe(restored);
    const tampered = structuredClone(restored);
    tampered.relicAcquisition!.receipt!.goldChange += 1;
    expect(isValidRunState(tampered)).toBe(false);
    const complete = reduceRun(restored, { type: 'continueRelicAcquisition' });
    expect(complete.screen).toBe('map');
    expect(complete.relicAcquisition).toBeNull();
    expect(complete.relicState![`acquired:${relicId}`]).toBe(1);
    expect(reduceRun(complete, { type: 'continueRelicAcquisition' })).toBe(complete);
    expect(reduceRun(complete, { type: 'confirmRelicAcquisition' })).toBe(complete);
    expect(deserializeRun(serializeRun(complete))).toEqual(complete);
    expect(before).toEqual(chooseBlessingRelic(seed, relicId));
  });

  it('Orobas replaces the initial core before combat and restores only the upgraded effect', () => {
    const pending = chooseBlessingRelic('relic-acquisition-legal-41', 'ref_orobas_fingertip');
    expect(pending.relicAcquisition!.stage).toBe('result');
    expect(pending.relicIds).not.toContain(STARTER_RELIC_IDS.machinist);
    expect(pending.relicIds).toContain(STARTER_UPGRADE_IDS.machinist);
    expect(pending.relicAcquisition!.receipt!.replacedRelicIds).toEqual([STARTER_RELIC_IDS.machinist]);
    let state = reduceRun(deserializeRun(serializeRun(pending))!, { type: 'continueRelicAcquisition' });
    const node = getAvailableNodes(state).find((candidate) => candidate.type === 'battle')!;
    state = reduceRun(state, { type: 'chooseNode', nodeId: node.id });
    expect(state.combat!.classResources!.orbs).toEqual(['lightning', 'lightning', 'lightning']);
    expect(state.combat!.relicCounters![STARTER_UPGRADE_IDS.machinist]).toBe(1);
    expect(state.combat!.relicCounters?.[STARTER_RELIC_IDS.machinist]).toBeUndefined();
    expect(deserializeRun(serializeRun(state))).toEqual(state);
  });

  it('a legally purchased Dolly mirror saves a pending copy, charges once and returns to the same shop', () => {
    const seed = 'relic-mirror-legal-20';
    let state = createBlessedRun(seed, 'berserker');
    const decide = createRoguelikeDriver('safe', seed);
    for (let step = 0; step < 200 && state.screen !== 'defeat'; step++) {
      if (state.screen === 'shop' && state.shop?.relicId === 'ref_dolly_mirror') break;
      const next = reduceRun(state, decide(state));
      expect(next).not.toBe(state);
      state = next;
    }
    expect(state.screen).toBe('shop');
    expect(state.shop!.relicId).toBe('ref_dolly_mirror');
    const price = getShopRelicPrice(state);
    expect(state.gold).toBeGreaterThanOrEqual(price);
    const bought = reduceRun(state, { type: 'buyRelic' });
    expect(bought.screen).toBe('relicAcquisition');
    expect(bought.relicAcquisition!.kind).toBe('copy');
    expect(bought.gold).toBe(state.gold - price);
    expect(bought.shop!.purchased).toContain('relic');
    expect(bought.deck).toEqual(state.deck);
    expect(reduceRun(bought, { type: 'buyRelic' })).toBe(bought);
    let resumed = deserializeRun(serializeRun(bought))!;
    expect(resumed).toEqual(bought);
    const chosen = resumed.deck.find((card) => card.upgraded) ?? resumed.deck[0];
    resumed = reduceRun(resumed, { type: 'selectRelicCards', cardUids: [chosen.uid] });
    expect(deserializeRun(serializeRun(resumed))).toEqual(resumed);
    const result = reduceRun(resumed, { type: 'confirmRelicAcquisition' });
    expect(result.relicAcquisition!.receipt!.addedCards).toHaveLength(1);
    const copy = result.relicAcquisition!.receipt!.addedCards[0];
    expect(copy.uid).not.toBe(chosen.uid);
    expect(copy.cardId).toBe(chosen.cardId);
    expect(copy.upgraded).toBe(chosen.upgraded);
    expect(result.deck.find((card) => card.uid === chosen.uid)).toEqual(chosen);
    expect(result.gold).toBe(bought.gold);
    const complete = reduceRun(deserializeRun(serializeRun(result))!, { type: 'continueRelicAcquisition' });
    expect(complete.screen).toBe('shop');
    expect(complete.currentNodeId).toBe(state.currentNodeId);
    expect(complete.shop).toEqual(bought.shop);
    expect(complete.deck).toHaveLength(state.deck.length + 1);
    expect(reduceRun(complete, { type: 'buyRelic' })).toBe(complete);
    expect(deserializeRun(serializeRun(complete))).toEqual(complete);
  });

  it('potion-belt capacity survives acquisition, combat creation, a turn and repeated loading', () => {
    let state = findOpeningRelic('relic-storage-legal', 'ref_potion_belt', 'berserker');
    expect(state.potions).toHaveLength(5);
    expect(state.potions.slice(3)).toEqual([null, null]);
    state = reduceRun(deserializeRun(serializeRun(state))!, { type: 'continueRelicAcquisition' });
    const node = getAvailableNodes(state).find((candidate) => candidate.type === 'battle')!;
    state = reduceRun(state, { type: 'chooseNode', nodeId: node.id });
    expect(state.combat!.potions).toEqual(state.potions);
    expect(state.combat!.potions).toHaveLength(5);
    state = reduceRun(deserializeRun(serializeRun(state))!, { type: 'combat', action: { type: 'endTurn' } });
    expect(state.combat!.turn).toBe(2);
    expect(state.potions).toHaveLength(5);
    expect(state.combat!.potions).toEqual(state.potions);
    expect(deserializeRun(serializeRun(state))).toEqual(state);
  });

  it('Happy Flower preserves the run turn counter across a saved battle boundary', () => {
    let state = findOpeningRelic('relic-storage-legal', 'ref_happy_flower', 'berserker');
    state = reduceRun(state, { type: 'continueRelicAcquisition' });
    const node = getAvailableNodes(state).find((candidate) => candidate.type === 'battle')!;
    state = reduceRun(state, { type: 'chooseNode', nodeId: node.id });
    expect(state.relicState!.ref_happy_flower).toBe(1);
    for (let index = 0; index < 2; index++)
      state = reduceRun(state, { type: 'combat', action: { type: 'endTurn' } });
    expect(state.combat!.turn).toBe(3);
    expect(state.combat!.energy).toBe(4);
    expect(state.relicState!.ref_happy_flower).toBe(3);
    expect(state.combat!.relicCounters!.ref_happy_flower).toBe(1);
    const restored = deserializeRun(serializeRun(state))!;
    expect(restored.relicState).toEqual(state.relicState);
    expect(restored.combat!.relicState).toEqual(state.relicState);
    expect(restored.combat!.energy).toBe(4);
    state = restored;
    const decide = createRoguelikeDriver('safe', state.seed);
    let crossed = false;
    for (let step = 0; step < 300 && !['victory', 'defeat'].includes(state.screen); step++) {
      const previousCount = state.relicState!.ref_happy_flower;
      const next = reduceRun(state, decide(state));
      expect(next).not.toBe(state);
      if (next.screen === 'combat' && next.currentNodeId !== node.id) {
        expect(next.combat!.turn).toBe(1);
        expect(next.relicState!.ref_happy_flower).toBe(previousCount + 1);
        expect(next.combat!.relicState).toEqual(next.relicState);
        expect(next.combat!.relicCounters?.ref_happy_flower ?? 0)
          .toBe((previousCount + 1) % 3 === 0 ? 1 : 0);
        expect(deserializeRun(serializeRun(next))).toEqual(next);
        crossed = true;
        break;
      }
      state = next;
    }
    expect(crossed).toBe(true);
  });
});

describe('combined acquisition hooks preserve one coherent saved inventory', () => {
  it('a blessing card and its Bin Bon copy each trigger gold, max HP, eggs and the same persistent card counter once', () => {
    let state: RunState | undefined;
    // A controlled hook-combination fixture, distinct from the genuine saved
    // campaigns above. Every effect and confirmation uses the real reducers.
    for (let index = 0; index < 100; index++) {
      const candidate = createBlessedRun(`relic-blessing-combination-${index}`, 'berserker');
      candidate.blessing = null;
      candidate.hp = 40;
      candidate.stats.cardsAdded = 7;
      candidate.relicIds.push('ref_bin_bon', 'ref_lucky_fish', 'ref_bowler_hat',
        'ref_dragon_fruit', 'ref_five_rings', 'ref_molten_egg', 'ref_toxic_egg', 'ref_frozen_egg');
      candidate.relicState = { 'ref_five_rings:cardsAdded': 4 };
      candidate.blessing = createBlessingEncounter(candidate);
      if (candidate.blessing.options.some((option) => option.templateId === 'class_lesson')) {
        state = candidate;
        break;
      }
    }
    expect(state).toBeDefined();
    const before = structuredClone(state!);
    expect(deserializeRun(serializeRun(before))).toEqual(before);
    const option = before.blessing!.options.find((candidate) => candidate.templateId === 'class_lesson')!;
    const selected = reduceRun(before, { type: 'chooseBlessing', optionId: option.id });
    const result = reduceRun(selected, { type: 'confirmBlessing' });
    const receipt = result.blessing!.receipt!;
    expect(receipt.addedCards).toHaveLength(2);
    expect(receipt.addedCards[0].cardId).toBe(receipt.addedCards[1].cardId);
    expect(receipt.addedCards[0].uid).not.toBe(receipt.addedCards[1].uid);
    expect(receipt.addedCards.every((card) => card.upgraded)).toBe(true);
    expect(result.deck.slice(0, before.deck.length)).toEqual(before.deck);
    expect(result.deck).toHaveLength(before.deck.length + 2);
    // Lucky Fish: 15 per actual card. Bowler Hat: +25%, floor each
    // award to 18. Dragon Fruit: +1 max HP per award, not per coin.
    expect(result.gold - before.gold).toBe(36);
    expect(result.maxHp - before.maxHp).toBe(2);
    expect(result.hp - before.hp).toBe(20);
    expect(result.relicState!['ref_five_rings:cardsAdded']).toBe(6);
    expect(result.stats.cardsAdded - before.stats.cardsAdded).toBe(2);
    expect(receipt.goldChange).toBe(36);
    expect(receipt.maxHpChange).toBe(2);
    expect(receipt.hpChange).toBe(20);
    expect(reduceRun(result, { type: 'confirmBlessing' })).toBe(result);
    const restored = deserializeRun(serializeRun(result))!;
    expect(restored).toEqual(result);
    const continued = reduceRun(restored, { type: 'continueBlessing' });
    expect(continued.screen).toBe('map');
    expect(continued.deck).toEqual(result.deck);
    expect(continued.gold).toBe(result.gold);
    expect(continued.relicState).toEqual(result.relicState);
    expect(deserializeRun(serializeRun(continued))).toEqual(continued);
  });
});

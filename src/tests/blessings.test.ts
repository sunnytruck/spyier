import { describe, expect, it } from 'vitest';
import { BLESSING_CHARACTERS, BLESSING_TEMPLATES } from '../data/blessings';
import { CARD_DEFINITIONS } from '../data/cards';
import { CLASS_IDS } from '../data/classes';
import { eligibleRelicIds } from '../data/relics';
import { createBlessingEncounter, getBlessingOptionDisabledReason, getBlessingTargetCards, isBlessingOptionAvailable, isValidBlessingState, reduceBlessing } from '../engine/blessings';
import { getBlessingCardPool, getCardPool } from '../engine/cardPools';
import { createRun } from '../engine/run';
import type { ClassId } from '../types/game';
import type { BlessingOption, BlessingRun } from '../types/blessing';

function commit(state: BlessingRun, option: BlessingOption): BlessingRun {
  let next = reduceBlessing(state, { type: 'chooseBlessing', optionId: option.id });
  if (option.target) next = reduceBlessing(next, { type: 'selectBlessingTargets', cardUids: option.target.eligibleCardUids.slice(0, option.target.count) });
  return reduceBlessing(next, { type: 'confirmBlessing' });
}
function fixture(seed: string, classId: ClassId = 'berserker', act = 1): BlessingRun {
  let state: BlessingRun = createRun(seed, classId);
  state.hp -= 17;
  state.gold = 300;
  state.maxActs = 3;
  state.blessingHistory = [];
  for (let current = 1; current <= act; current++) {
    state.act = current; state.screen = 'blessing'; state.blessing = null;
    state.blessing = createBlessingEncounter(state);
    if (current < act) {
      const safe = state.blessing.options.find((option) => option.risk === 'safe' && !option.target) ?? state.blessing.options[0];
      state = reduceBlessing(commit(state, safe), { type: 'continueBlessing' });
    }
  }
  return state;
}
function offer(templateId: string, classId: ClassId = 'berserker', act = 1) {
  for (let seed = 0; seed < 200; seed++) {
    const state = fixture(`blessing-template-${seed}`, classId, act);
    const option = state.blessing!.options.find((entry) => entry.templateId === templateId);
    if (option) return { state, option };
  }
  throw new Error(`Template not offered: ${templateId}`);
}

describe('fixed and seeded act-start blessing encounters', () => {
  it.each(CLASS_IDS)('%s gets four valid unique frozen options with safe/risky choices and the first-act god', (classId) => {
    for (let seed = 0; seed < 20; seed++) {
      const state = fixture(`blessing-opening-${seed}`, classId);
      const before = JSON.stringify(state);
      const encounter = state.blessing!;
      expect(encounter.characterId).toBe('jitto_god');
      expect(BLESSING_CHARACTERS[encounter.characterId].dialogues[encounter.dialogueIndex]).toBeTruthy();
      expect(encounter.options).toHaveLength(4);
      expect(new Set(encounter.options.map((option) => option.id)).size).toBe(4);
      expect(new Set(encounter.options.map((option) => JSON.stringify(option.rewards))).size).toBe(4);
      expect(encounter.options.some((option) => option.risk === 'safe')).toBe(true);
      expect(encounter.options.some((option) => option.risk === 'risky')).toBe(true);
      expect(encounter.options.every((option) => isBlessingOptionAvailable(state, option))).toBe(true);
      expect(isValidBlessingState(state)).toBe(true);
      expect(createBlessingEncounter(state)).toEqual(encounter);
      expect(JSON.stringify(state)).toBe(before);
    }
  });

  it('later weighted characters vary across seeds and never repeat immediately', () => {
    const encountered = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      const second = fixture(`blessing-characters-${seed}`, 'oracle', 2);
      const third = fixture(`blessing-characters-${seed}`, 'oracle', 3);
      expect(second.blessing!.characterId).not.toBe('jitto_god');
      expect(third.blessing!.characterId).not.toBe(third.blessingHistory!.at(-1)!.characterId);
      expect(isValidBlessingState(second)).toBe(true);
      expect(isValidBlessingState(third)).toBe(true);
      encountered.add(second.blessing!.characterId); encountered.add(third.blessing!.characterId);
      expect(fixture(`blessing-characters-${seed}`, 'oracle', 3).blessing).toEqual(third.blessing);
    }
    expect(encountered.size).toBe(Object.keys(BLESSING_CHARACTERS).length);
  });

  it('has explicit art, scene, effect, act eligibility and multiple saved dialogue lines for all six characters', () => {
    for (const character of Object.values(BLESSING_CHARACTERS)) {
      expect(character.artId).toBe(character.id);
      expect(character.backgroundTheme).toBeTruthy(); expect(character.effectTheme).toBeTruthy();
      expect(character.dialogues.length).toBeGreaterThanOrEqual(3);
      expect(character.availableActs).toEqual(character.id === 'jitto_god' ? [1, 2, 3] : [2, 3]);
    }
    const lines = new Set<number>();
    for (let seed = 0; seed < 20; seed++) {
      const state = fixture(`blessing-dialogue-${seed}`);
      lines.add(state.blessing!.dialogueIndex);
      const restored = JSON.parse(JSON.stringify(state)) as BlessingRun;
      expect(createBlessingEncounter(restored).dialogueIndex).toBe(state.blessing!.dialogueIndex);
      expect(isValidBlessingState(restored)).toBe(true);
    }
    expect(lines.size).toBe(3);
  });

  it('does not consume run or combat random state while generating, selecting, or confirming', () => {
    const state = fixture('independent-blessing-stream') as BlessingRun & { rngState: number };
    const rng = state.rngState;
    const selected = reduceBlessing(state, { type: 'chooseBlessing', optionId: state.blessing!.options[0].id });
    expect(selected.rngState).toBe(rng);
    const applied = commit(state, state.blessing!.options[0]) as typeof state;
    expect(applied.rngState).toBe(rng);
    expect(state.rngState).toBe(rng);
  });

  it('still guarantees four affordable choices at 1 HP, no gold, one upgraded card and all relics owned', () => {
    const state = fixture('minimum-resources');
    state.blessing = null;
    state.hp = state.maxHp = 1; state.gold = 0;
    state.deck = [{ uid: 'last-card', cardId: 'berserker_strike', upgraded: true }];
    state.relicIds = eligibleRelicIds('berserker');
    state.blessing = createBlessingEncounter(state);
    expect(state.blessing.options).toHaveLength(4);
    expect(state.blessing.options.every((option) => isBlessingOptionAvailable(state, option))).toBe(true);
    expect(state.blessing.options.some((option) => option.risk === 'risky')).toBe(true);
    expect(isValidBlessingState(state)).toBe(true);
  });
});

describe('saved target selection and atomic blessing effects', () => {
  const templates = Object.keys(BLESSING_TEMPLATES).filter((id) => id !== 'exclusive_lesson');
  it.each(templates)('%s applies exactly the frozen costs/rewards once and produces a validated receipt', (templateId) => {
    const { state, option } = offer(templateId);
    const original = JSON.stringify(state);
    const next = commit(state, option);
    expect(next).not.toBe(state);
    expect(next.blessing!.stage).toBe('result');
    expect(next.blessingHistory).toHaveLength(1);
    expect(isValidBlessingState(next)).toBe(true);
    const receipt = next.blessing!.receipt!;
    expect(receipt.hpChange).toBe(next.hp - state.hp);
    expect(receipt.maxHpChange).toBe(next.maxHp - state.maxHp);
    expect(receipt.goldChange).toBe(next.gold - state.gold);
    expect(next.stats.cardsAdded - state.stats.cardsAdded).toBe(receipt.addedCards.length);
    expect(reduceBlessing(next, { type: 'confirmBlessing' })).toBe(next);
    expect(reduceBlessing(next, { type: 'chooseBlessing', optionId: state.blessing!.options[1].id })).toBe(next);
    expect(JSON.stringify(state)).toBe(original);
    const restored = JSON.parse(JSON.stringify(next)) as BlessingRun;
    expect(isValidBlessingState(restored)).toBe(true);
    expect(reduceBlessing(restored, { type: 'confirmBlessing' })).toBe(restored);
    const continued = reduceBlessing(restored, { type: 'continueBlessing' });
    expect(continued.screen).toBe('map'); expect(continued.blessing).toBeNull();
    expect(isValidBlessingState(continued)).toBe(true);
    expect(() => createBlessingEncounter(continued)).toThrow('受領済み');
  });

  it.each(['remove', 'upgrade', 'transform'] as const)('%s selection is persisted before confirmation and does not change cards or costs', (kind) => {
    const template = kind === 'remove' ? 'shed_weight' : kind === 'upgrade' ? 'polish_stone' : 'fresh_verse';
    const { state, option } = offer(template);
    const originalDeck = structuredClone(state.deck);
    const selected = reduceBlessing(state, { type: 'chooseBlessing', optionId: option.id });
    expect(selected.blessing!.stage).toBe('targets');
    expect(isValidBlessingState(selected)).toBe(true);
    const cards = getBlessingTargetCards(selected);
    expect(cards.map((card) => card.uid)).toEqual(option.target!.eligibleCardUids);
    cards[0].upgraded = !cards[0].upgraded;
    expect(selected.deck).toEqual(originalDeck);
    const pending = reduceBlessing(selected, { type: 'selectBlessingTargets', cardUids: [option.target!.eligibleCardUids[1]] });
    expect(pending.blessing!.stage).toBe('confirm');
    expect(pending.deck).toEqual(originalDeck);
    expect(pending.hp).toBe(state.hp); expect(pending.gold).toBe(state.gold);
    const restored = JSON.parse(JSON.stringify(pending)) as BlessingRun;
    expect(isValidBlessingState(restored)).toBe(true);
    const result = reduceBlessing(restored, { type: 'confirmBlessing' });
    expect(isValidBlessingState(result)).toBe(true);
    expect(result.blessing!.selectedCardUids).toEqual(pending.blessing!.selectedCardUids);
    const uid = pending.blessing!.selectedCardUids[0];
    if (kind === 'remove') expect(result.deck.some((card) => card.uid === uid)).toBe(false);
    if (kind === 'upgrade') expect(result.deck.find((card) => card.uid === uid)!.upgraded).toBe(true);
    if (kind === 'transform') expect(result.deck.find((card) => card.uid === uid)).toEqual({ uid, cardId: option.target!.replacements![uid], upgraded: false });
  });

  it('two transforms persist partial selection and retain exact replacements through switching/reloading', () => {
    const { state, option } = offer('twin_rebirth');
    let next = reduceBlessing(state, { type: 'chooseBlessing', optionId: option.id });
    const targets = option.target!.eligibleCardUids.slice(0, 2);
    next = reduceBlessing(next, { type: 'selectBlessingTargets', cardUids: [targets[0]] });
    expect(next.blessing!.stage).toBe('targets');
    expect(isValidBlessingState(next)).toBe(true);
    expect(reduceBlessing(next, { type: 'confirmBlessing' })).toBe(next);
    const restored = JSON.parse(JSON.stringify(next)) as BlessingRun;
    const alternative = restored.blessing!.options.find((entry) => entry.id !== option.id)!;
    let switched = reduceBlessing(restored, { type: 'chooseBlessing', optionId: alternative.id });
    switched = reduceBlessing(switched, { type: 'chooseBlessing', optionId: option.id });
    expect(switched.blessing!.options).toEqual(state.blessing!.options);
    switched = reduceBlessing(switched, { type: 'selectBlessingTargets', cardUids: targets });
    const result = reduceBlessing(switched, { type: 'confirmBlessing' });
    expect(result.blessing!.receipt!.transformedCards.map(({ after }) => after.cardId)).toEqual(targets.map((uid) => option.target!.replacements![uid]));
    expect(result.deck).toHaveLength(state.deck.length);
  });

  it('upgraded and unupgradable cards are excluded from the actual upgrade selection', () => {
    let { state } = offer('polish_stone');
    state.blessing = null; state.deck[0].upgraded = true;
    state.deck.push({ uid: 'curse-check', cardId: 'stone_doubt', upgraded: false });
    state.blessing = createBlessingEncounter(state);
    for (const option of state.blessing.options.filter((entry) => entry.target?.kind === 'upgrade')) {
      expect(option.target!.eligibleCardUids).not.toContain(state.deck[0].uid);
      expect(option.target!.eligibleCardUids).not.toContain('curse-check');
    }
  });

  it.each(CLASS_IDS)('%s never gains other-class/generated cards or incompatible/duplicate relics', (classId) => {
    for (let seed = 0; seed < 10; seed++) {
      const state = fixture(`blessing-class-pool-${seed}`, classId, 3);
      for (const option of state.blessing!.options) {
        for (const reward of option.rewards) {
          if (reward.kind === 'cards') {
            const pool = option.templateId === 'exclusive_lesson' ? getBlessingCardPool(classId) : getCardPool(classId, 'combat');
            expect(reward.cardIds.every((id) => pool.includes(id) && !CARD_DEFINITIONS[id].tokenOnly)).toBe(true);
            if (option.templateId === 'rare_omen' || option.templateId === 'sacred_trade') expect(reward.cardIds.every((id) => CARD_DEFINITIONS[id].rarity === 'rare')).toBe(true);
          }
          if (reward.kind === 'relic') { expect(eligibleRelicIds(classId)).toContain(reward.relicId); expect(state.relicIds).not.toContain(reward.relicId); }
        }
        for (const [uid, id] of Object.entries(option.target?.replacements ?? {})) {
          expect(getCardPool(classId, 'combat')).toContain(id);
          expect(state.deck.find((card) => card.uid === uid)!.cardId).not.toBe(id);
        }
      }
    }
  });

  it('exclusive gifts exist only when source-confirmed executable cards are registered', () => {
    const pool = getBlessingCardPool('oracle');
    if (pool.length) {
      const { state, option } = offer('exclusive_lesson', 'oracle');
      const reward = option.rewards.find((entry) => entry.kind === 'cards')!;
      expect(reward.kind === 'cards' && reward.cardIds.every((id) => pool.includes(id))).toBe(true);
      expect(isValidBlessingState(commit(state, option))).toBe(true);
    } else for (let seed = 0; seed < 10; seed++) expect(fixture(`no-exclusive-${seed}`).blessing!.options.some((entry) => entry.templateId === 'exclusive_lesson')).toBe(false);
  });

  it('source-confirmed exclusive cards have a real maximum-HP price and remain outside ordinary rewards', () => {
    const pool = getBlessingCardPool('oracle');
    expect(pool).toHaveLength(8);
    const seen = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const state = fixture(`exclusive-blessing-distribution-${seed}`, 'oracle');
      const exclusive = state.blessing!.options.find((option) => option.templateId === 'exclusive_lesson');
      if (!exclusive) continue;
      expect(exclusive.risk).toBe('risky');
      expect(exclusive.costs).toEqual([{ kind: 'maxHp', amount: 5 }]);
      const reward = exclusive.rewards.find((entry) => entry.kind === 'cards')!;
      if (reward.kind === 'cards') reward.cardIds.forEach((id) => { seen.add(id); expect(getCardPool('oracle', 'combat')).not.toContain(id); });
    }
    expect(seen.size).toBe(pool.length);
    const { state, option } = offer('exclusive_lesson', 'oracle', 3);
    expect(option.costs).toEqual([{ kind: 'maxHp', amount: 9 }]);
    const result = commit(state, option);
    expect(result.maxHp).toBe(state.maxHp - 9);
    expect(result.hp).toBe(Math.min(state.hp, state.maxHp - 9));
    expect(isValidBlessingState(result)).toBe(true);
  });

  it('a character whitelist narrows exclusive gifts, deduplicates entries and cannot admit other-class/basic/normal cards', () => {
    const god = BLESSING_CHARACTERS.jitto_god;
    const originalWhitelist = god.blessingCardIds;
    const allowed = 'blessing_ancestral_wrath';
    const foreign = CARD_DEFINITIONS.blessing_rending;
    const originalOwner = foreign.classId;
    const baseline = fixture('default-character-pool', 'oracle');
    try {
      foreign.classId = 'assassin';
      god.blessingCardIds = [allowed, allowed, foreign.id, 'berserker_strike', 'oracle_strike', 'oracle_annihilate', 'token_sword', 'missing-card'];
      expect(getBlessingCardPool('oracle', god.blessingCardIds)).toEqual([allowed]);
      const { state, option } = offer('exclusive_lesson', 'oracle');
      expect(option.rewards).toEqual([{ kind: 'cards', cardIds: [allowed] }]);
      expect(isValidBlessingState(state)).toBe(true);
      const applied = commit(state, option);
      expect(applied.blessing!.receipt!.addedCards.map((card) => card.cardId)).toEqual([allowed]);
      expect(isValidBlessingState(JSON.parse(JSON.stringify(applied)) as BlessingRun)).toBe(true);
      const forged = structuredClone(state);
      const reward = forged.blessing!.options.find((entry) => entry.id === option.id)!.rewards[0];
      if (reward.kind === 'cards') reward.cardIds = ['blessing_apotheosis'];
      expect(isValidBlessingState(forged)).toBe(false);
      expect(reduceBlessing(forged, { type: 'chooseBlessing', optionId: option.id })).toBe(forged);
    } finally {
      foreign.classId = originalOwner;
      if (originalWhitelist === undefined) delete god.blessingCardIds;
      else god.blessingCardIds = originalWhitelist;
    }
    expect(fixture('default-character-pool', 'oracle')).toEqual(baseline);
  });

  it('an explicitly empty character whitelist suppresses exclusive gifts while retaining four valid choices', () => {
    const god = BLESSING_CHARACTERS.jitto_god;
    const original = god.blessingCardIds;
    try {
      god.blessingCardIds = [];
      for (let seed = 0; seed < 10; seed++) {
        const state = fixture(`empty-character-blessing-${seed}`, 'oracle');
        expect(state.blessing!.options).toHaveLength(4);
        expect(state.blessing!.options.some((option) => option.templateId === 'exclusive_lesson')).toBe(false);
        expect(isValidBlessingState(state)).toBe(true);
      }
    } finally {
      if (original === undefined) delete god.blessingCardIds;
      else god.blessingCardIds = original;
    }
  });

  it('act-scaled reward and cost quantities come directly from authored templates', () => {
    const first = offer('blood_tithe').option;
    const third = offer('blood_tithe', 'berserker', 3).option;
    expect(first.costs).toEqual([{ kind: 'hp', amount: 10 }]);
    expect(third.costs).toEqual([{ kind: 'hp', amount: 20 }]);
    expect(third.rewards).toEqual([{ kind: 'gold', amount: 200 }]);
    expect(offer('polish_stone', 'berserker', 3).option.target!.count).toBe(2);
  });
});

describe('blessing corruption and illegal actions are rejected', () => {
  it('preserves all old runs with absent act/blessing fields', () => { expect(isValidBlessingState(createRun('legacy-blessing-compat', 'machinist'))).toBe(true); });

  it('rejects an invalid saved dialogue index and a character outside its allowed act', () => {
    const state = fixture('blessing-dialogue-corruption');
    const original = state.blessing!.dialogueIndex;
    state.blessing!.dialogueIndex = 999;
    expect(isValidBlessingState(state)).toBe(false);
    state.blessing!.dialogueIndex = original;
    state.blessing!.characterId = 'yomi_guide';
    expect(isValidBlessingState(state)).toBe(false);
  });

  it('rejects unknown actions, foreign targets, duplicate targets, early confirms and changed snapshots', () => {
    const { state, option } = offer('twin_rebirth');
    expect(reduceBlessing(state, { type: 'confirmBlessing' })).toBe(state);
    expect(reduceBlessing(state, { type: 'continueBlessing' })).toBe(state);
    expect(reduceBlessing(state, { type: 'chooseBlessing', optionId: 'not-an-option' })).toBe(state);
    const chosen = reduceBlessing(state, { type: 'chooseBlessing', optionId: option.id });
    expect(reduceBlessing(chosen, { type: 'selectBlessingTargets', cardUids: ['missing'] })).toBe(chosen);
    expect(reduceBlessing(chosen, { type: 'selectBlessingTargets', cardUids: [option.target!.eligibleCardUids[0], option.target!.eligibleCardUids[0]] })).toBe(chosen);
    chosen.gold -= 1;
    expect(getBlessingOptionDisabledReason(chosen, option)).not.toBeNull();
    expect(isValidBlessingState(chosen)).toBe(false);
  });

  it.each(['cost', 'reward', 'target', 'receipt', 'history', 'duplicate', 'missing-history', 'stage'] as const)('rejects tampered %s without trusting saved effect numbers', (kind) => {
    const { state, option } = offer('blood_tithe', 'berserker', 3);
    let broken = JSON.parse(JSON.stringify(state)) as BlessingRun;
    if (kind === 'cost') broken.blessing!.options.find((entry) => entry.id === option.id)!.costs[0].amount = 0;
    if (kind === 'reward') { const reward = broken.blessing!.options.find((entry) => entry.id === option.id)!.rewards[0]; if (reward.kind === 'gold') reward.amount += 999; }
    if (kind === 'target') broken.blessing!.options[0].target = { kind: 'remove', count: 1, eligibleCardUids: ['missing'] };
    if (kind === 'receipt') { broken = commit(broken, option); broken.blessing!.receipt!.goldChange += 1; }
    if (kind === 'history') broken.blessingHistory![0].receipt.hpChange += 1;
    if (kind === 'duplicate') broken.blessingHistory!.push(structuredClone(broken.blessingHistory![0]));
    if (kind === 'missing-history') broken.blessingHistory = [];
    if (kind === 'stage') broken.blessing!.stage = 'result';
    expect(isValidBlessingState(broken)).toBe(false);
  });

  it('does not let a forged reward option be committed directly through the pure reducer', () => {
    const { state, option } = offer('blood_tithe');
    const injected = state.blessing!.options.find((entry) => entry.id === option.id)!;
    const reward = injected.rewards[0]; if (reward.kind === 'gold') reward.amount = 900_000;
    expect(isBlessingOptionAvailable(state, injected)).toBe(false);
    expect(reduceBlessing(state, { type: 'chooseBlessing', optionId: option.id })).toBe(state);
  });
});

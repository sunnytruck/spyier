import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BlessingScreen } from '../screens/BlessingScreen';
import { BLESSING_CHARACTERS } from '../data/blessings';
import { CARD_DEFINITIONS } from '../data/cards';
import { CLASS_IDS } from '../data/classes';
import { createBlessedRun } from '../engine/run';
import { createBlessingEncounter, getBlessingTargetCards, reduceBlessing } from '../engine/blessings';
import { deserializeRun, serializeRun } from '../engine/runPersistence';
import type { RunState } from '../types/run';
import type { BlessingCharacterId, BlessingOption, BlessingTargetKind } from '../types/blessing';

const render = (state: RunState, speed: 'normal' | 'fast' | 'instant' = 'normal', reducedMotion = false) => renderToStaticMarkup(createElement(BlessingScreen, { state, onAction: () => {}, settings: { speed, reducedMotion } }));

function findOption(predicate: (option: BlessingOption) => boolean, prepare?: (state: RunState) => void) {
  for (let index = 0; index < 300; index += 1) {
    const state = createBlessedRun(`blessing-ui-option-${index}`, 'oracle');
    if (prepare) { prepare(state); state.blessing = null; state.blessing = createBlessingEncounter(state); }
    const option = state.blessing!.options.find(predicate);
    if (option) return { state, option };
  }
  throw new Error('Missing UI fixture option');
}

describe('dedicated act-entry blessing screen', () => {
  it.each(CLASS_IDS)('%s starts with four real choices and the giant jitto god scene', (classId) => {
    const state = createBlessedRun(`blessing-ui-${classId}`, classId);
    const before = JSON.stringify(state);
    const markup = render(state);
    expect(markup.match(/data-blessing-option=/g)).toHaveLength(4);
    expect(markup).toContain('data-blessing-stage="offer"');
    expect(markup).toContain('data-blessing-character="jitto_god"');
    expect(markup).toContain('data-character-id="jitto_god"');
    for (const option of state.blessing!.options) {
      expect(markup).toContain(option.title);
      expect(markup).toContain(option.description);
    }
    expect(markup).not.toContain('aria-label="祝福の確認"');
    expect(JSON.stringify(state)).toBe(before);
  });

  it.each(Object.keys(BLESSING_CHARACTERS) as BlessingCharacterId[])('%s renders its actual name, greeting and distinct artwork', (characterId) => {
    let fixture: RunState | undefined;
    for (let index = 0; index < 200 && !fixture; index += 1) {
      const state = createBlessedRun(`blessing-ui-character-${index}`, 'assassin');
      state.act = 2; state.blessing = null; state.blessing = createBlessingEncounter(state, 2);
      if (state.blessing.characterId === characterId) fixture = state;
    }
    expect(fixture).toBeDefined();
    const markup = render(fixture!);
    expect(markup).toContain(`data-character-id="${characterId}"`);
    expect(markup).toContain(BLESSING_CHARACTERS[characterId].name);
    expect(markup).toContain(BLESSING_CHARACTERS[characterId].dialogues[fixture!.blessing!.dialogueIndex]);
  });

  it.each(['remove', 'upgrade', 'transform'] as BlessingTargetKind[])('%s uses persisted eligible targets and does not apply a preview', (kind) => {
    const { state, option } = findOption((entry) => entry.target?.kind === kind, (run) => { run.deck[0].upgraded = true; });
    let selected = reduceBlessing(state, { type: 'chooseBlessing', optionId: option.id });
    expect(selected.blessing!.stage).toBe('targets');
    const cards = getBlessingTargetCards(selected);
    const before = JSON.stringify(selected);
    let markup = render(selected);
    expect(markup.match(/data-blessing-target=/g)).toHaveLength(cards.length);
    for (const card of cards) expect(markup).toContain(`data-blessing-target="${card.uid}"`);
    if (kind === 'upgrade') expect(cards.every((card) => !card.upgraded)).toBe(true);
    expect(markup).toContain('disabled="">祝福を確定して受け取る');
    expect(JSON.stringify(selected)).toBe(before);
    selected = reduceBlessing(selected, { type: 'selectBlessingTargets', cardUids: cards.slice(0, option.target!.count).map((card) => card.uid) });
    const ready = JSON.stringify(selected);
    markup = render(selected);
    expect(markup).toContain('data-blessing-stage="confirm"');
    expect(markup).toContain('確定する内容');
    if (kind === 'transform') {
      const replacement = option.target!.replacements![cards[0].uid];
      expect(markup).toContain(`data-card-id="${replacement}"`);
      expect(markup).toContain('変化後');
    }
    if (kind === 'upgrade') expect(markup).toContain('カードの強化プレビュー');
    expect(JSON.stringify(selected)).toBe(ready);
    expect(selected.hp).toBe(state.hp);
    expect(selected.gold).toBe(state.gold);
    expect(selected.deck).toEqual(state.deck);
  });

  it('shows an actual curse card preview rather than a generic price message', () => {
    const { state, option } = findOption((entry) => entry.costs.some((cost) => cost.kind === 'curse'));
    const selected = reduceBlessing(state, { type: 'chooseBlessing', optionId: option.id });
    const markup = render(selected);
    expect(markup).toContain('data-card-id="stone_doubt"');
    expect(markup).toContain(CARD_DEFINITIONS.stone_doubt.description);
    expect(markup).toContain(`呪い「${CARD_DEFINITIONS.stone_doubt.name}」`);
  });

  it('receipts display actual HP clamping and relic rewards, with only continue available', () => {
    const { state, option } = findOption((entry) => entry.templateId === 'hollow_crown');
    const selected = reduceBlessing(state, { type: 'chooseBlessing', optionId: option.id });
    const result = reduceBlessing(selected, { type: 'confirmBlessing' });
    const before = JSON.stringify(result);
    const receipt = result.blessing!.receipt!;
    const markup = render(result);
    expect(markup).toContain('data-blessing-stage="result"');
    expect(markup).toContain(`HP ${receipt.hpChange}`);
    expect(markup).toContain(`最大HP ${receipt.maxHpChange}`);
    expect(markup).toContain('blessing-relic-preview');
    expect(markup).toContain('祝福を胸に、塔を登る');
    expect(markup).not.toContain('aria-label="祝福の確認"');
    expect(markup.match(/disabled="" aria-pressed=/g)).toHaveLength(4);
    expect(JSON.stringify(result)).toBe(before);
  });

  it('receipts show the actual upgraded card, not the unconfirmed original', () => {
    const { state, option } = findOption((entry) => entry.target?.kind === 'upgrade');
    const chosen = reduceBlessing(state, { type: 'chooseBlessing', optionId: option.id });
    const cards = getBlessingTargetCards(chosen).slice(0, option.target!.count);
    const ready = reduceBlessing(chosen, { type: 'selectBlessingTargets', cardUids: cards.map((card) => card.uid) });
    const result = reduceBlessing(ready, { type: 'confirmBlessing' });
    const markup = render(result);
    for (const card of result.blessing!.receipt!.upgradedCards) {
      expect(markup).toContain(`${CARD_DEFINITIONS[card.cardId].name}＋`);
      expect(markup).toContain(CARD_DEFINITIONS[card.cardId].upgradedDescription);
    }
  });

  it.each([['normal', true], ['instant', false]] as const)('honors motion settings speed=%s reduced=%s', (speed, reducedMotion) => {
    const state = createBlessedRun('blessing-ui-motion', 'machinist');
    expect(render(state, speed, reducedMotion)).toContain('motion-reduced');
  });

  it('marks actual blessing-only cards using acquisition metadata', () => {
    const { state, option } = findOption((entry) => entry.rewards.some((reward) => reward.kind === 'cards'));
    const selected = reduceBlessing(state, { type: 'chooseBlessing', optionId: option.id });
    const markup = render(selected);
    for (const reward of option.rewards) if (reward.kind === 'cards') for (const id of reward.cardIds) {
      expect(markup).toContain(`data-card-id="${id}"`);
      expect(markup).toContain(CARD_DEFINITIONS[id].description);
    }
    const actualLimited = option.rewards.flatMap((reward) => reward.kind === 'cards' ? reward.cardIds : []).some((id) => CARD_DEFINITIONS[id].acquisition === 'blessingOnly');
    expect(markup.includes('data-acquisition="blessingOnly"')).toBe(actualLimited);
  });

  it('shows a visible limited acquisition frame for an actual exclusive reward', () => {
    const { state, option } = findOption((entry) => entry.templateId === 'exclusive_lesson');
    const selected = reduceBlessing(state, { type: 'chooseBlessing', optionId: option.id });
    const markup = render(selected);
    const ids = option.rewards.flatMap((reward) => reward.kind === 'cards' ? reward.cardIds : []);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => CARD_DEFINITIONS[id].acquisition === 'blessingOnly')).toBe(true);
    expect(markup).toContain('data-acquisition="blessingOnly"');
    expect(markup).toContain('祝福限定');
  });

  it('restores a partially selected two-card blessing with its confirm button still disabled', () => {
    const { state, option } = findOption((entry) => entry.templateId === 'silent_forge');
    const selected = reduceBlessing(state, { type: 'chooseBlessing', optionId: option.id });
    const uid = getBlessingTargetCards(selected)[0].uid;
    const partial = reduceBlessing(selected, { type: 'selectBlessingTargets', cardUids: [uid] });
    expect(partial.blessing!.stage).toBe('targets');
    const restored = deserializeRun(serializeRun(partial));
    expect(restored).not.toBeNull();
    const markup = render(restored!);
    const target = markup.match(new RegExp(`data-blessing-target="${uid}"([\\s\\S]*?)</article>`))?.[1];
    expect(target).toBeDefined();
    expect(target).toContain('choice-card');
    expect(target).toContain('is-selected');
    expect(target).toMatch(/class="choice-card-pick"[^>]*aria-pressed="true"/);
    expect(markup).toContain('選択 1 / 2枚');
    expect(markup).toContain('disabled="">祝福を確定して受け取る');
    expect(restored!.deck).toEqual(state.deck);
  });

  it.each([
    ['pilgrim_purse', 'gold'], ['gentle_growth', 'life'], ['class_lesson', 'cards'],
    ['hollow_crown', 'relic'], ['hollow_crown', 'cost'], ['polish_stone', 'upgrade'],
    ['fresh_verse', 'transform'], ['shed_weight', 'remove'],
  ])('%s renders a %s acquisition effect only from its applied receipt', (templateId, effect) => {
    const { state, option } = findOption((entry) => entry.templateId === templateId);
    let selected = reduceBlessing(state, { type: 'chooseBlessing', optionId: option.id });
    if (option.target) selected = reduceBlessing(selected, { type: 'selectBlessingTargets', cardUids: option.target.eligibleCardUids.slice(0, option.target.count) });
    const result = reduceBlessing(selected, { type: 'confirmBlessing' });
    const before = JSON.stringify(result);
    const markup = render(result);
    expect(markup).toContain(`data-blessing-fx="${effect}"`);
    expect(markup).toContain(`data-blessing-gift="${option.id}"`);
    expect(JSON.stringify(result)).toBe(before);
  });

  it('offers a nonblocking initial animation skip only when motion is enabled', () => {
    const state = createBlessedRun('blessing-ui-intro-skip', 'berserker');
    expect(render(state)).toContain('祝福演出をスキップ');
    expect(render(state, 'fast')).toContain('祝福演出をスキップ');
    expect(render(state, 'instant')).not.toContain('祝福演出をスキップ');
    expect(render(state, 'normal', true)).not.toContain('祝福演出をスキップ');
  });
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import { createCombat, reduceCombat } from '../engine';
import { getPendingChoiceCards, getPendingChoiceLabel } from '../engine/actions/choices';
import { createRun, getShopCardPrice, reduceRun, SHOP_PRICES } from '../engine/run';
import { CardView } from '../components/CardView';
import { BattleScreen } from '../screens/BattleScreen';
import { RunScreens } from '../screens/RunScreens';
import type { CardInstance, CombatState } from '../types/game';

// Pointer capture and the document-body targeting portal require a real browser.
// Keep the real battle screen, choice modal, card views, and status rendering.
vi.mock('../components/BattleHand', () => ({ BattleHand: () => null }));

const card = (uid: string, cardId: string, upgraded = false): CardInstance => ({ uid, cardId, upgraded });
const noop = () => {};
const battleMarkup = (state: CombatState) => renderToStaticMarkup(createElement(BattleScreen, {
  state, resolving: false, onPlay: noop, onEndTurn: noop, onOpenPile: noop,
  onRestart: noop, onReplay: noop, onTitle: noop, onChooseCards: noop,
}));
const textOnly = (markup: string) => markup.replace(/<[^>]*>/g, '');
const pendingCardsMarkup = (markup: string) => markup.match(/<div class="[^"]*\bpending-choice-grid\b[^"]*">([\s\S]*?)<div class="pending-choice-confirm"/)?.[1] ?? '';

function choiceFixture(sourceId: string) {
  const source = card('source', sourceId);
  const state = createCombat('roguelike-choice-ui', 'grit_scout', { classId: 'machinist' });
  state.hand = [source, card('hand-only', 'stone_strike')];
  state.drawPile = [card('draw-only', 'still_guard')];
  state.discardPile = [card('discard-a', 'machinist_boot'), card('discard-b', 'machinist_beam_cell', true)];
  state.exhaustPile = [];
  state.energy = 10;
  state.enemy.hp = state.enemy.maxHp = 500;
  return reduceCombat(state, { type: 'playCard', cardId: source.uid });
}

describe('suspended card choices show the actual source pile', () => {
  it.each([
    ['machinist_hologram', '捨て札から1枚を手札に戻す', ['machinist_boot', 'machinist_beam_cell'], '選んだ捨て札を手札に戻します。'],
    ['oracle_cosmic_indifference', '捨て札から1枚を山札の一番上に戻す', ['machinist_boot', 'machinist_beam_cell'], '次のドローで先に引きます。'],
    ['oracle_photon_cut', '手札から1枚を山札の一番上に戻す', ['stone_strike', 'still_guard'], '次のドローで先に引きます。'],
  ] as const)('%s renders a truthful instruction and candidates without committing', (sourceId, title, expectedIds, explanation) => {
    const state = choiceFixture(sourceId);
    const saved = JSON.stringify(state);
    const markup = battleMarkup(state);
    expect(getPendingChoiceLabel(state)).toBe(title);
    expect(markup).toContain(title);
    expect(markup).toContain(explanation);
    const choice = pendingCardsMarkup(markup);
    const shownIds = [...choice.matchAll(/data-card-id="([^"]+)"/g)].map((match) => match[1]);
    expect(shownIds).toEqual(expectedIds);
    expect(getPendingChoiceCards(state).map((entry) => entry.cardId)).toEqual(expectedIds);
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('disabled="">選択を確定して続ける');
    expect(choice).toContain('aria-pressed="false"');
    expect(JSON.stringify(state)).toBe(saved);
  });

  it('keeps old suspended discard saves readable when sourceZone is absent', () => {
    const state = createCombat('old-pending-choice');
    state.hand = [card('old-hand', 'stone_strike')];
    state.discardPile = [card('old-discard', 'still_guard')];
    state.pendingChoice = { mode: 'discard', amount: 1, resume: { effects: [], defense: false } };
    const saved = JSON.stringify(state);
    const markup = battleMarkup(state);
    expect(markup).toContain('手札から1枚捨てる');
    const choice = pendingCardsMarkup(markup);
    expect(choice).toContain('data-card-id="stone_strike"');
    expect(choice).not.toContain('data-card-id="still_guard"');
    expect(markup).not.toContain('aria-label="閉じる"');
    expect(JSON.stringify(state)).toBe(saved);
  });

  it('lets an unplayable curse and an unaffordable power be discarded using readable whole-card controls', () => {
    const state = createCombat('discard-unplayable-ui');
    state.hand = [card('curse', 'stone_doubt'), card('power', 'berserker_barricade')];
    state.energy = 0;
    state.pendingChoice = { mode: 'discard', amount: 1, resume: { effects: [], defense: false } };
    const saved = JSON.stringify(state);
    const choices = pendingCardsMarkup(battleMarkup(state));
    const picks = [...choices.matchAll(/<button[^>]*class="choice-card-pick"[^>]*>/g)];
    expect(picks).toHaveLength(2);
    expect(picks.every(([button]) => !button.includes('disabled'))).toBe(true);
    expect(choices).toContain('石心の迷い');
    expect(choices).toContain('使用不可');
    expect(choices).toContain('強化後を表示');
    expect(choices).not.toContain('このカードを選ぶ');
    expect(choices).not.toContain('card-etching');
    // The optional preview control is a sibling, never an invalid nested button.
    const faces = [...choices.matchAll(/<button[^>]*class="choice-card-pick"[^>]*>([\s\S]*?)<\/button>/g)];
    expect(faces.every((match) => !match[1].includes('<button'))).toBe(true);
    expect(JSON.stringify(state)).toBe(saved);
  });

  it('retains a negative strength status and explains its actual damage penalty', () => {
    const state = createCombat('negative-strength-ui', 'grit_scout', { classId: 'berserker' });
    state.player.strength = -3;
    const markup = battleMarkup(state);
    expect(markup).toContain('筋力 -3：攻撃1ヒットにつきダメージ-3。');
    expect(markup).toContain('<span>↓</span><b>-3</b>');
    expect(markup).not.toContain('ダメージ+-3');
    expect(markup).toContain('筋力 -3、HP消費カード');
  });
});

describe('new executable cards render normal and upgraded rules', () => {
  const cases = [
    ['machinist_machine_learning', [], ['天賦']],
    ['machinist_boot', ['防御', '廃棄', '天賦'], ['防御', '廃棄', '天賦']],
    ['machinist_hologram', ['防御', '廃棄'], ['防御']],
    ['necromancer_harvest', ['廃棄'], ['廃棄', '保留']],
    ['necromancer_grave_blast', ['廃棄'], []],
    ['necromancer_eradicate', ['保留'], ['保留']],
    ['colorless_production', ['廃棄'], []],
    ['assassin_backstab', ['廃棄', '天賦'], ['廃棄', '天賦']],
  ] as const;

  for (const [cardId, beforeKeywords, afterKeywords] of cases) {
    it.each([false, true])(`${cardId} matches its actual cost, description and keywords (upgraded=%s)`, (upgraded) => {
      const instance = card('inspect-source', cardId, upgraded);
      const definition = CARD_DEFINITIONS[cardId];
      const saved = JSON.stringify(instance);
      const markup = renderToStaticMarkup(createElement(CardView, { card: instance, inspect: true, showUpgradePreview: false }));
      const footer = textOnly(markup.match(/<div class="card-footer">([\s\S]*?)<\/div>/)![1]);
      const expectedKeywords = upgraded ? afterKeywords : beforeKeywords;
      const footerKeywords = footer.split('・').slice(1).map((keyword) => keyword.replace(/強化済$|◆$/u, ''));
      expect(footerKeywords).toEqual(expectedKeywords);
      expect(markup).toContain(`data-upgraded="${upgraded}"`);
      expect(markup).toContain(`<h3>${definition.name}${upgraded ? '＋' : ''}</h3>`);
      expect(markup).toContain(`<div class="card-description">${upgraded ? definition.upgradedDescription : definition.description}</div>`);
      const cost = definition.xCost ? 'X' : upgraded ? definition.upgradedCost ?? definition.cost : definition.cost;
      expect(textOnly(markup.match(/<span class="card-cost[^>]*>([\s\S]*?)<\/span>/)![1])).toBe(String(cost));
      expect(markup).not.toContain('強化後を表示');
      expect(JSON.stringify(instance)).toBe(saved);
    });
  }
});

describe('shop affordability matches the amount charged', () => {
  it.each([false, true])('shows saved stock prices and disables only unaffordable purchases (legacy=%s)', (legacy) => {
    const state = createRun('shop-price-ui', 'berserker');
    state.screen = 'shop';
    state.gold = 60;
    const cardIds = ['berserker_bash', 'berserker_shatter'];
    state.shop = {
      cardIds, ...(legacy ? {} : { cardPrices: { berserker_bash: 37, berserker_shatter: 97 } }),
      relicId: null, potionId: null, purchased: [], removed: false,
    };
    const before = JSON.stringify(state);
    const markup = renderToStaticMarkup(createElement(RunScreens, {
      state, onAction: noop, onNewRun: noop, onReplay: noop, onTitle: noop,
    }));
    const choices = [...markup.matchAll(/<div class="run-card-choice[^>]*>([\s\S]*?)<\/article>([\s\S]*?)<\/button>/g)];
    expect(choices).toHaveLength(2);
    choices.forEach((match, index) => {
      const price = legacy ? SHOP_PRICES.card : index === 0 ? 37 : 97;
      expect(match[2]).toContain(` ${price}<small>G</small>`);
      expect(match[2].includes('disabled=""')).toBe(price > state.gold);
      expect(getShopCardPrice(state, cardIds[index])).toBe(price);
    });
    const purchased = reduceRun(state, { type: 'buyCard', cardId: cardIds[0] });
    expect(purchased.gold).toBe(state.gold - (legacy ? SHOP_PRICES.card : 37));
    expect(purchased.deck.at(-1)?.cardId).toBe(cardIds[0]);
    expect(JSON.stringify(state)).toBe(before);
  });
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BLESSING_CARD_DEFINITIONS } from '../data/blessingCards';
import { CARD_DEFINITIONS } from '../data/cards';
import { CardView } from '../components/CardView';
import { BattleScreen } from '../screens/BattleScreen';
import { createCombat, getCardCost, getEnemies, getEnemyKey, predictEnemyDamage, reduceCombat } from '../engine';
import { getPendingChoiceCards, getPendingChoiceLabel } from '../engine/actions/choices';
import { deserializeGame, serializeGame } from '../engine/persistence';
import { getCardRuntimeInfo } from '../presentation/cardRuntime';
import { canUpgradeCard, getCardPresentation, getCardUpgradePreview } from '../presentation/cardUpgrade';
import type { CardInstance, CombatState } from '../types/game';

vi.mock('../components/BattleHand', () => ({ BattleHand: () => null }));

const noop = () => {};
const battleMarkup = (state: CombatState, act = 1) => renderToStaticMarkup(createElement(BattleScreen, {
  state, resolving: false, onPlay: noop, onEndTurn: noop, onOpenPile: noop,
  onRestart: noop, onReplay: noop, onTitle: noop, onChooseCards: noop,
  campaign: true, act, floor: 4,
}));
const textOnly = (html: string) => html.replace(/<[^>]*>/g, '');

function fixture(cardId: string, upgraded = false): CombatState {
  const card = { uid: 'limited', cardId, upgraded };
  const filler: CardInstance[] = Array.from({ length: 10 }, (_, index) => ({ uid: `limited-fill-${index}`, cardId: 'stone_strike', upgraded: false }));
  const state = createCombat('limited-card-ui', 'grit_scout', { deck: [card, ...filler], classId: 'berserker' });
  state.hand = [card, ...filler.slice(0, 3)];
  state.drawPile = filler.slice(3, 6);
  state.discardPile = filler.slice(6, 8);
  state.exhaustPile = filler.slice(8);
  state.energy = 10;
  state.enemy.hp = state.enemy.maxHp = 500;
  return state;
}

describe('limited card identity, upgrade flags and pure runtime details', () => {
  it.each(Object.values(BLESSING_CARD_DEFINITIONS).flatMap((definition) => [false, true].map((upgraded) => ({ definition, upgraded }))))(
    '$definition.id upgraded=$upgraded displays the canonical text, actual cost and acquisition badge without changing the battle',
    ({ definition, upgraded }) => {
      const state = fixture(definition.id, upgraded);
      const saved = serializeGame(state);
      const presentation = getCardPresentation(state.hand[0])!;
      expect(presentation.description).toBe(upgraded ? definition.upgradedDescription : definition.description);
      expect(presentation.cost).toBe(getCardCost(state.hand[0], state));
      const facts = getCardRuntimeInfo(state.hand[0], state);
      expect(facts?.facts.length).toBeGreaterThan(0);
      const markup = renderToStaticMarkup(createElement(CardView, { card: state.hand[0], state, inspect: true }));
      expect(markup).toContain('data-acquisition="blessingOnly"');
      expect(textOnly(markup)).toContain('✦ 祝福限定');
      expect(textOnly(markup)).toContain(presentation.description);
      expect(markup).toContain('class="card-runtime');
      expect(serializeGame(state)).toBe(saved);
      expect(getCardRuntimeInfo(state.hand[0], deserializeGame(saved)!)).toEqual(facts);
    },
  );

  it('shows the real removal of ethereal on upgraded apparition while retaining exhaust', () => {
    const state = fixture('blessing_apparition');
    const preview = getCardUpgradePreview(state.hand[0])!;
    expect(preview.before.keywords).toEqual(['廃棄', 'エセリアル']);
    expect(preview.after.keywords).toEqual(['廃棄']);
    expect(preview.changes.keywords).toBe(true);
    expect(preview.after.description).not.toContain('エセリアル');
    const normal = renderToStaticMarkup(createElement(CardView, { card: state.hand[0], state, inspect: true, showUpgradePreview: false }));
    const upgraded = renderToStaticMarkup(createElement(CardView, { card: { ...state.hand[0], upgraded: true }, state, inspect: true }));
    expect(textOnly(normal)).toContain('エセリアル');
    expect(textOnly(upgraded)).not.toContain('エセリアル');
  });

  it('never leaks upgradeAll into the caller card, deck or future saved state while inspecting', () => {
    const state = fixture('blessing_apotheosis');
    state.deck[1].upgraded = true;
    state.hand[1].upgraded = true;
    const original = JSON.stringify(state);
    const played = state.hand[0];
    const before = getCardPresentation(played)!;
    const info = getCardRuntimeInfo(played, state)!;
    expect(info.facts.find((entry) => entry.key.endsWith(':upgradeAll'))?.amount).toBe(10);
    expect(JSON.stringify(state)).toBe(original);
    expect(played.upgraded).toBe(false);
    expect(getCardPresentation(played)).toEqual(before);
    expect(getCardRuntimeInfo({ ...played, upgraded: true }, state)!.facts.find((entry) => entry.key.endsWith(':upgradeAll'))?.amount).toBe(9);
    expect(JSON.stringify(state)).toBe(original);
  });

  it('marks only combat-upgraded cards as temporary and shows their actual upgraded values', () => {
    const state = fixture('blessing_apotheosis');
    const after = reduceCombat(state, { type: 'playCard', cardId: 'limited' });
    const temporary = after.hand[0];
    expect(temporary.upgraded).toBe(true);
    expect(canUpgradeCard(temporary)).toBe(false);
    const markup = renderToStaticMarkup(createElement(CardView, { card: temporary, state: after, inspect: true }));
    expect(textOnly(markup)).toContain('この戦闘中のみ強化');
    expect(textOnly(markup)).toContain('一時強化');
    expect(textOnly(markup)).toContain(CARD_DEFINITIONS[temporary.cardId].upgradedDescription);
    expect(markup).not.toContain('強化後を表示');
    const permanent = renderToStaticMarkup(createElement(CardView, { card: { ...temporary, uid: 'permanent' }, state: after, inspect: true }));
    expect(textOnly(permanent)).not.toContain('この戦闘中のみ強化');
    expect(textOnly(permanent)).toContain('強化済');
  });

  it.each([false, true])('rending displays the current shared per-ID hit value and the subsequent ramp separately (%s)', (upgraded) => {
    const state = fixture('blessing_rending', upgraded);
    state.cardDamageBonuses = { blessing_rending: 4 };
    state.player.strength = 2;
    state.enemy.vulnerable = 1;
    const info = getCardRuntimeInfo(state.hand[0], state)!;
    const currentAttack = info.facts.find((entry) => entry.key.endsWith(':damage'))!;
    const ramp = info.facts.find((entry) => entry.key.endsWith(':cardDamageBonus'))!;
    const result = reduceCombat(state, { type: 'playCard', cardId: 'limited' });
    expect(currentAttack.amount! * 2).toBe(state.enemy.hp - result.enemy.hp);
    expect(currentAttack.summary).toContain('同名カードの威力＋4');
    expect(ramp.amount).toBe(result.cardDamageBonuses!.blessing_rending);
    expect(ramp.detail).toContain('この効果より前にある攻撃は上昇前');
    expect(state.cardDamageBonuses.blessing_rending).toBe(4);
  });

  it('warns about lethal max-HP payment and keeps the defeated zero-HP health bar finite', () => {
    const state = fixture('blessing_aurora');
    state.player.hp = state.player.maxHp = 1;
    state.intangible = 1;
    const cost = getCardRuntimeInfo(state.hand[0], state)!.facts.find((entry) => entry.key.endsWith(':loseMaxHp'))!;
    expect(cost).toMatchObject({ amount: 1, warning: true });
    expect(cost.summary).toContain('最大HP 1 → 0・使用すると敗北');
    const defeated = reduceCombat(state, { type: 'playCard', cardId: 'limited' });
    expect(defeated.phase).toBe('defeat');
    expect(defeated.player.maxHp).toBe(0);
    const markup = battleMarkup(defeated);
    expect(markup).not.toContain('NaN');
    expect(markup).not.toContain('Infinity');
    expect(markup).toContain('class="health-fill" style="width:0%"');
  });
});

describe('limited choice and combat status UI', () => {
  it('wish opens the actual draw-pile candidates with a truthful, non-dismissible instruction', () => {
    const state = fixture('blessing_wish');
    const pending = reduceCombat(state, { type: 'playCard', cardId: 'limited' });
    const saved = serializeGame(pending);
    const markup = battleMarkup(pending);
    expect(getPendingChoiceLabel(pending)).toBe('山札から1枚を手札に戻す');
    expect(markup).toContain('山札から1枚を手札に戻す');
    expect(markup).toContain('選んだ山札のカードを手札に加えます。山札の残りの順序は変えません。');
    const choices = markup.slice(markup.indexOf('class="pending-choice-grid"'), markup.indexOf('class="pending-choice-confirm"'));
    expect((choices.match(/data-card-id=/g) ?? []).length).toBe(state.drawPile.length);
    expect(getPendingChoiceCards(pending).map((card) => card.uid)).toEqual(state.drawPile.map((card) => card.uid));
    expect(markup).not.toContain('aria-label="閉じる"');
    expect(serializeGame(pending)).toBe(saved);
    const preview = getCardRuntimeInfo(state.hand[0], state)!;
    expect(preview.facts.find((entry) => entry.key.endsWith(':moveChoice'))?.summary).toContain('山札から1枚');
  });

  it.each([false, true])('stunned enemies show action rest, rather than an attack or skipped debuff (%s)', (multiple) => {
    const state = createCombat('stun-display', multiple ? ['seam_serpent', 'grit_scout'] : 'seam_serpent');
    state.enemy.stun = 1;
    const savedIntent = { ...state.enemy.intent };
    const html = battleMarkup(state);
    const forecast = html.slice(html.indexOf('class="enemy-intent'), html.indexOf('class="actor-status enemy-status"'));
    expect(forecast).toContain('スタン・行動休止');
    expect(forecast).not.toContain(savedIntent.label);
    expect(forecast).not.toContain('intent-extra-effects');
    expect(html).toContain('スタン 1：');
    expect(predictEnemyDamage(state, getEnemyKey(state.enemy))).toBe(0);
    expect(state.enemy.intent).toEqual(savedIntent);
    const restored = deserializeGame(serializeGame(state))!;
    expect(battleMarkup(restored)).toBe(html);
  });

  it('intangible explains its exact limits and the displayed multi-hit forecast matches real enemy damage', () => {
    // Use a real saved intent from the enemy registry by advancing to its second action.
    const started = createCombat('intangible-display', 'tower_abbot', { classId: 'necromancer' });
    const next = reduceCombat(started, { type: 'endTurn' });
    next.player.hp = next.player.maxHp;
    next.intangible = 1;
    const amount = predictEnemyDamage(next);
    expect(amount).toBe(1);
    const html = battleMarkup(next);
    expect(html).toContain('霊体 1：');
    expect(html).toContain('毒・HP消費・最大HP減少は軽減しません');
    expect(textOnly(html)).toContain('1 × 4');
    const after = reduceCombat(next, { type: 'endTurn' });
    expect(next.player.hp - after.player.hp).toBe(4);
    expect(getEnemies(after)).toHaveLength(1);
  });

  it.each([1, 2, 3])('shows the actual act %s instead of always labelling it act one', (act) => {
    const html = battleMarkup(createCombat('act-heading'), act);
    expect(textOnly(html)).toContain(`第${act}階層 · 4F`);
    expect(textOnly(html)).toContain(['じっと教の参道', '星灯りの回廊', '黄泉天上の聖域'][act - 1]);
  });
});

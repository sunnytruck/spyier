import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import { createCombat, getCardCost, getEnemies, reduceCombat } from '../engine';
import { serializeGame, deserializeGame } from '../engine/persistence';
import { getCardRuntimeInfo } from '../presentation/cardRuntime';
import { getCardPresentation } from '../presentation/cardUpgrade';
import type { CardInstance, ClassId, CombatState } from '../types/game';

function fixture(cardId: string, upgraded = false, multi = false): CombatState {
  const owner = CARD_DEFINITIONS[cardId].classId;
  const classId: ClassId = owner && owner !== 'colorless' ? owner : 'berserker';
  const state = createCombat('runtime-read-only', multi ? ['grit_scout', 'candle_moth'] : 'grit_scout', { classId });
  state.hand = [{ uid: 'runtime-card', cardId, upgraded }];
  state.deck = [...state.hand];
  state.drawPile = [];
  state.discardPile = [];
  state.exhaustPile = [];
  state.energy = 5;
  state.player.block = 0;
  for (const enemy of getEnemies(state)) {
    enemy.hp = 500;
    enemy.maxHp = 500;
    enemy.block = 0;
  }
  return state;
}

const info = (state: CombatState, card = state.hand[0]) => getCardRuntimeInfo(card, state)!;
const fact = (state: CombatState, type: string) => info(state).facts.find((entry) => entry.key.endsWith(`:${type}`))!;
const play = (state: CombatState) => reduceCombat(state, { type: 'playCard', cardId: state.hand[0].uid });

describe('runtime card facts use the actual combat rules', () => {
  it.each([false, true])('star burst reads this-turn gains, applies attack modifiers, and does not spend cumulative stars (%s)', (upgraded) => {
    const state = fixture('oracle_star_burst', upgraded, true);
    state.classResources!.stars = 99;
    state.classResources!.starsGainedThisTurn = 2;
    state.player.strength = 2;
    state.player.weak = 1;
    state.enemy.vulnerable = 1;
    const result = play(state);
    expect(fact(state, 'starBurst').amount).toBe(500 - result.enemy.hp);
    expect(fact(state, 'starBurst').summary).toContain(`今ターン✦2×${upgraded ? 4 : 3}`);
    expect(fact(state, 'starBurst').summary).toContain(getEnemies(state)[1].name);
    expect(result.classResources!.stars).toBe(99);
  });

  it('zero this-turn star gain remains a failed attack even with cumulative stars and strength', () => {
    const state = fixture('oracle_star_burst');
    state.classResources!.stars = 500;
    state.player.strength = 100;
    expect(fact(state, 'starBurst')).toMatchObject({ amount: 0, summary: '今ターンの星獲得0・攻撃は不発' });
    expect(play(state).enemy.hp).toBe(500);
  });

  it('star gains show both current and this-turn totals', () => {
    const state = fixture('oracle_awe', true);
    state.classResources!.stars = 10;
    state.classResources!.starsGainedThisTurn = 2;
    const result = play(state);
    expect(fact(state, 'gainStars').summary).toBe(`✦ 10 → ${result.classResources!.stars} ／ 今ターン ${result.classResources!.starsGainedThisTurn}`);
  });

  it.each([false, true])('holy sword facts use actual upgraded cost and forged attack (%s)', (upgraded) => {
    const state = fixture('token_sword', upgraded);
    state.classResources!.forge = 17;
    state.player.strength = 3;
    state.enemy.vulnerable = 1;
    const result = play(state);
    expect(fact(state, 'damage').amount).toBe(500 - result.enemy.hp);
    expect(getCardCost(state.hand[0], state)).toBe(upgraded ? 1 : 2);
    expect(fact(state, 'damage').summary).toContain('鍛造17');
  });

  it('manifest previews forge before fetching and preserves an existing upgraded sword', () => {
    const state = fixture('oracle_manifest');
    state.classResources!.forge = 5;
    state.exhaustPile = [{ uid: 'existing-sword', cardId: 'token_sword', upgraded: true }];
    const result = play(state);
    const sword = result.hand.find((held) => held.cardId === 'token_sword')!;
    const fetched = fact(state, 'fetchGenerated');
    expect(fetched.summary).toBe(`聖剣＋ コスト${getCardCost(sword, result)} ／ 基礎威力${10 + result.classResources!.forge}`);
    expect(sword.uid).toBe('existing-sword');
  });

  it('block attack includes actual before-card relic and attack-power bonuses', () => {
    const state = fixture('berserker_body_slam');
    state.player.block = 12;
    state.player.strength = 1;
    state.powerStacks = { blockOnAttack: 3 };
    state.relicIds = ['first_vow'];
    state.relicCounters = {};
    expect(fact(state, 'damage').amount).toBe(18);
    expect(500 - play(state).enemy.hp).toBe(18);
  });

  it.each([false, true])('knife facts include knife power, first-attack relic, strength, weak and vulnerable (%s)', (upgraded) => {
    const state = fixture('token_knife', upgraded);
    state.player.strength = 3;
    state.player.weak = 1;
    state.enemy.vulnerable = 1;
    state.powerStacks = { knifeDamage: 6 };
    state.relicIds = ['first_vow'];
    state.relicCounters = {};
    expect(fact(state, 'damage').amount).toBe(500 - play(state).enemy.hp);
    expect(fact(state, 'damage').summary).toContain('石刃の研磨＋6');
  });

  it('multihit facts show per-hit damage rather than treating the total as one blocked hit', () => {
    const state = fixture('berserker_twin');
    state.player.strength = 2;
    state.enemy.block = 3;
    expect(fact(state, 'damage').summary).toContain('7×2回');
    expect(fact(state, 'damage').amount).toBe(7);
    expect(500 - play(state).enemy.hp).toBe(11);
    expect(fact(state, 'damage').detail).toContain('敵ブロックで軽減する前');
  });

  it.each(['necromancer_poke', 'necromancer_unleash'])('summon attack %s ignores player and enemy attack modifiers', (cardId) => {
    const state = fixture(cardId);
    state.classResources!.ostyHp = 8;
    state.player.strength = 100;
    state.player.weak = 2;
    state.enemy.vulnerable = 2;
    expect(fact(state, 'summonDamage').amount).toBe(500 - play(state).enemy.hp);
    expect(fact(state, 'summonDamage').detail).toContain('敵の脆弱は適用せず');
  });

  it('an absent summon never invents an attack, and summoning shows resulting HP', () => {
    const state = fixture('necromancer_unleash');
    expect(fact(state, 'summonDamage')).toMatchObject({ amount: 0, summary: '岩霊が不在・攻撃は不発' });
    expect(play(state).enemy.hp).toBe(500);
    const summon = fixture('necromancer_bodyguard');
    summon.classResources!.ostyHp = 4;
    expect(fact(summon, 'summon').amount).toBe(play(summon).classResources!.ostyHp);
  });

  it('lethal HP payment warns and stops before later effects, without disabling a legal card', () => {
    const state = fixture('berserker_hemokinesis');
    state.player.hp = 2;
    state.player.block = 100;
    state.classResources!.ostyHp = 100;
    const result = play(state);
    expect(fact(state, 'loseHp')).toMatchObject({ amount: 2, warning: true });
    expect(info(state).facts).toHaveLength(1);
    expect(result.phase).toBe('defeat');
    expect(result.classResources!.ostyHp).toBe(100);
    expect(result.player.block).toBe(100);
    expect(result.enemy.hp).toBe(500);
  });

  it('evoke identifies the rightmost frost orb and repeats the canonical focused value', () => {
    const state = fixture('machinist_dual_cast');
    state.classResources!.orbs = ['lightning', 'frost'];
    state.classResources!.focus = 2;
    expect(fact(state, 'evoke')).toMatchObject({ amount: 7, summary: '右端の霜：7×2回解放' });
    const result = play(state);
    expect(result.classResources!.orbs).toEqual(['lightning']);
    expect(result.player.block).toBe(14);
  });

  it('empty evoke reports no effect, and negative focus clamps orb values to zero', () => {
    const empty = fixture('machinist_dual_cast');
    expect(fact(empty, 'evoke').summary).toBe('オーブがないため解放しない');
    const channel = fixture('machinist_zap');
    channel.classResources!.focus = -30;
    expect(fact(channel, 'channel').summary).toBe('雷オーブ1個 ／ 自動0・解放0');
    expect(fact(channel, 'channel').detail).toContain('ランダムな生存敵');
  });

  it.each([false, true])('X orb generation uses paid energy plus the exact upgrade bonus (%s)', (upgraded) => {
    const state = fixture('machinist_tempest', upgraded);
    state.energy = 2;
    expect(fact(state, 'xChannel').amount).toBe(upgraded ? 3 : 2);
    expect(play(state).classResources!.orbs).toHaveLength(upgraded ? 3 : 2);
  });

  it('poison application shows target accumulation and bypass-block next-tick details', () => {
    const state = fixture('assassin_deadly_poison');
    state.enemy.poison = 4;
    state.enemy.block = 100;
    expect(fact(state, 'status').amount).toBe(play(state).enemy.poison);
    expect(fact(state, 'status').detail).toContain('9HP減少');
    expect(fact(state, 'status').detail).toContain('ブロックを無視');
  });

  it('unknown cards, unplayable curses and absent combat produce no invented runtime facts', () => {
    const state = fixture('machinist_zap');
    expect(getCardRuntimeInfo(state.hand[0])).toBeNull();
    expect(getCardRuntimeInfo({ ...state.hand[0], cardId: 'missing' }, state)).toBeNull();
    const curse = Object.values(CARD_DEFINITIONS).find((definition) => definition.unplayable)!;
    expect(getCardRuntimeInfo({ uid: 'curse', cardId: curse.id, upgraded: false }, state)).toBeNull();
  });

  it('every canonical card preview is read-only, preserves text, and produces the same facts after save/load', () => {
    for (const definition of Object.values(CARD_DEFINITIONS)) {
      for (const upgraded of [false, true]) {
        const state = fixture(definition.id, upgraded);
        const card: CardInstance = state.hand[0];
        const before = JSON.stringify(state);
        const description = getCardPresentation(card)!.description;
        const preview = getCardRuntimeInfo(card, state);
        expect(JSON.stringify(state)).toBe(before);
        expect(getCardPresentation(card)!.description).toBe(description);
        const restored = deserializeGame(serializeGame(state));
        expect(restored).not.toBeNull();
        expect(getCardRuntimeInfo(card, restored!)).toEqual(preview);
      }
    }
  });
});

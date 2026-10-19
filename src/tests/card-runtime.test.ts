import { describe, expect, it } from 'vitest';
import { CARD_DEFINITIONS } from '../data/cards';
import { createCombat, getCardCost, getEnemies, getEnemyKey, reduceCombat } from '../engine';
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

function addCards(state: CombatState, zone: 'hand' | 'drawPile' | 'discardPile' | 'exhaustPile', amount: number) {
  const cards = Array.from({ length: amount }, (_, index) => ({ uid: `runtime-${zone}-${index}`, cardId: 'still_guard', upgraded: false }));
  state.deck.push(...cards);
  state[zone].push(...cards);
}

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

describe('expanded cards show canonical dynamic and delayed effects', () => {
  it.each([false, true])('hand-scaling damage excludes the card being played and preserves preview state (%s)', (upgraded) => {
    const state = fixture('assassin_focused_blade', upgraded);
    addCards(state, 'hand', 5);
    state.player.strength = 2;
    const saved = serializeGame(state);
    const preview = fact(state, 'damage');
    expect(preview.summary).toContain('他の手札5');
    expect(preview.amount).toBe(500 - play(state).enemy.hp);
    expect(serializeGame(state)).toBe(saved);
  });

  it.each(['berserker_ash_strike', 'colorless_mind_blast', 'necromancer_deadline'])('%s reads the actual discard/exhaust/draw/doom combat quantity', (cardId) => {
    const state = fixture(cardId);
    addCards(state, 'exhaustPile', 3);
    addCards(state, 'drawPile', 5);
    state.enemy.doom = 17;
    state.player.strength = 2;
    state.player.weak = 1;
    expect(fact(state, 'damage').amount).toBe(500 - play(state).enemy.hp);
  });

  it.each([false, true])('vulnerability-based damage and conditional hits follow the selected enemy (%s)', (upgraded) => {
    const state = fixture('berserker_bully', upgraded, true);
    const enemies = getEnemies(state);
    enemies[0].vulnerable = 1;
    enemies[1].vulnerable = 3;
    state.selectedEnemyId = getEnemyKey(enemies[1]);
    expect(fact(state, 'damage').amount).toBe(500 - getEnemies(play(state))[1].hp);
    const repeated = fixture('berserker_dismantle', upgraded);
    repeated.enemy.vulnerable = 1;
    repeated.player.strength = 2;
    const hit = fact(repeated, 'damage');
    expect(hit.summary).toContain(`${hit.amount}×2回`);
    expect(500 - play(repeated).enemy.hp).toBe(hit.amount! * 2);
    repeated.enemy.vulnerable = 0;
    expect(fact(repeated, 'damage').summary).not.toContain('×2回');
  });

  it.each(['berserker_whirlwind', 'assassin_skewer', 'necromancer_eradicate', 'oracle_heavenly_drill'])('%s previews X=0/2/4 and normal/upgraded actual hit counts', (cardId) => {
    for (const upgraded of [false, true]) {
      for (const energy of [0, 2, 4]) {
        const state = fixture(cardId, upgraded, true);
        state.energy = energy;
        state.player.strength = 1;
        const preview = fact(state, 'damage');
        const result = play(state);
        const hits = cardId === 'oracle_heavenly_drill' && energy >= 4 ? energy * 2 : energy;
        expect(preview.summary).toContain(`X＝${energy}`);
        if (hits === 0) {
          expect(preview.amount).toBe(0);
          expect(preview.summary).toContain('攻撃0回');
          expect(result.enemy.hp).toBe(500);
        } else {
          expect(500 - result.enemy.hp).toBe(preview.amount! * hits);
          expect(preview.summary).toContain(`×${hits}回`);
        }
        expect(result.energy).toBe(0);
      }
    }
  });

  it('all-enemy attack previews apply each enemy vulnerability separately', () => {
    const state = fixture('oracle_stellar_wave', false, true);
    getEnemies(state)[1].vulnerable = 1;
    const result = play(state);
    const summary = fact(state, 'damage').summary;
    for (const [index, enemy] of getEnemies(state).entries())
      expect(summary).toContain(`${enemy.name} ${500 - getEnemies(result)[index].hp}`);
  });

  it.each(['assassin_mirage', 'colorless_stack'])('%s previews canonical scaled block including defense gauge bonus', (cardId) => {
    const state = fixture(cardId, true, true);
    state.jitto = 50;
    state.player.block = 7;
    state.enemy.poison = 3;
    getEnemies(state)[1].poison = 5;
    addCards(state, 'discardPile', 4);
    expect(fact(state, 'block').amount).toBe(play(state).player.block - 7);
  });

  it('all-enemy doom shows exact accumulation with unique React fact keys', () => {
    const state = fixture('necromancer_deathbringer', true, true);
    state.enemy.doom = 2;
    getEnemies(state)[1].doom = 8;
    const preview = info(state);
    const result = play(state);
    const doom = preview.facts.filter((entry) => entry.key.endsWith(':doom'));
    expect(doom.map((entry) => entry.amount)).toEqual(getEnemies(result).map((enemy) => enemy.doom));
    expect(new Set(preview.facts.map((entry) => entry.key)).size).toBe(preview.facts.length);
    expect(doom[0].detail).toContain('毒を先に解決');
    expect(result.phase).toBe('player');
  });

  it('orb-count hits, enemy-count channeling and type-count focus use the same engine scalars', () => {
    const barrage = fixture('machinist_barrage');
    barrage.classResources!.orbs = ['frost', 'lightning', 'frost'];
    const hit = fact(barrage, 'damage');
    expect(hit.summary).toContain('×3回');
    expect(500 - play(barrage).enemy.hp).toBe(hit.amount! * 3);
    barrage.classResources!.orbs = [];
    expect(fact(barrage, 'damage').amount).toBe(0);
    const channel = fixture('machinist_chill', false, true);
    expect(fact(channel, 'channel').amount).toBe(2);
    expect(play(channel).classResources!.orbs).toHaveLength(2);
    const focused = fixture('machinist_synchrony');
    focused.classResources!.focus = 1;
    focused.classResources!.orbs = ['frost', 'lightning', 'frost'];
    expect(fact(focused, 'focus').amount).toBe(play(focused).classResources!.focus);
    expect(fact(focused, 'focus').summary).toBe('集中力 1 → 5（このターン）');
  });

  it.each([false, true])('X evoke includes consumed energy and handles zero-hit removal honestly (%s)', (upgraded) => {
    for (const energy of [0, 3]) {
      const state = fixture('machinist_multicast', upgraded);
      state.energy = energy;
      state.classResources!.orbs = ['lightning', 'frost'];
      state.classResources!.focus = 2;
      const times = energy + (upgraded ? 1 : 0);
      const preview = fact(state, 'evoke');
      const result = play(state);
      expect(preview.summary).toBe(`右端の霜：7×${times}回解放`);
      expect(preview.amount).toBe(times ? 7 : 0);
      expect(result.player.block).toBe(7 * times);
      expect(result.classResources!.orbs).toEqual(['lightning']);
      if (!times) expect(preview.detail).toContain('0回でもオーブは取り除きます');
    }
  });

  it('all-orb release describes the existing right-to-left order with focused values', () => {
    const state = fixture('machinist_pulverize', false, true);
    state.classResources!.orbs = ['lightning', 'lightning', 'frost'];
    state.classResources!.focus = 2;
    const preview = fact(state, 'evoke');
    expect(preview.summary).toBe('右端から全3個：霜7×1回 → 雷10×1回 → 雷10×1回');
    const result = play(state);
    expect(result.classResources!.orbs).toEqual([]);
    expect(result.player.block).toBe(7);
    expect(result.stats.damageDealt).toBe(11 * 2 + 10 * 2);
  });

  it('random attack previews show a damage range without revealing targets or depending on hidden RNG state', () => {
    const state = fixture('berserker_boomerang', false, true);
    getEnemies(state)[1].vulnerable = 1;
    const preview = info(state);
    expect(fact(state, 'damage').summary).toBe('ランダムな生存敵に3〜4×3回');
    for (const enemy of getEnemies(state)) expect(fact(state, 'damage').summary).not.toContain(enemy.name);
    expect(fact(state, 'damage').amount).toBeUndefined();
    state.rngState = (state.rngState + 101) >>> 0;
    expect(info(state)).toEqual(preview);
  });

  it.each([false, true])('poison conditional only includes the additional poison fact when active (%s)', (upgraded) => {
    const state = fixture('assassin_bubble', upgraded);
    expect(fact(state, 'conditional').warning).toBe(true);
    expect(info(state).facts.some((entry) => entry.key.endsWith(':status'))).toBe(false);
    expect(play(state).enemy.poison).toBe(0);
    state.enemy.poison = 2;
    expect(fact(state, 'conditional').warning).toBe(false);
    expect(fact(state, 'status').amount).toBe(play(state).enemy.poison);
  });

  it('attack-intent conditional uses the current announced action after preceding damage', () => {
    const state = fixture('machinist_eye_poke');
    expect(fact(state, 'status').amount).toBe(play(state).enemy.weak);
    state.enemy.intent = { kind: 'defend', label: '休む', description: '何もしない' };
    expect(fact(state, 'conditional').warning).toBe(true);
    expect(info(state).facts.some((entry) => entry.key.endsWith(':status'))).toBe(false);
  });

  it.each([
    { upgraded: false, played: 1, active: true }, { upgraded: false, played: 2, active: false },
    { upgraded: true, played: 2, active: true }, { upgraded: true, played: 3, active: false },
  ])('FTL counts this card: $played previous / upgraded=$upgraded', ({ upgraded, played, active }) => {
    const state = fixture('machinist_ftl', upgraded);
    addCards(state, 'drawPile', 3);
    state.cardsPlayedThisTurn = played;
    expect(fact(state, 'conditional').warning).toBe(!active);
    expect(info(state).facts.some((entry) => entry.key.endsWith(':draw'))).toBe(active);
    expect(play(state).hand).toHaveLength(active ? 1 : 0);
  });

  it.each([false, true])('delayed stars show the exact queued definition without applying it now (%s)', (upgraded) => {
    const state = fixture('oracle_hidden_wealth', upgraded);
    state.classResources!.stars = 10;
    const preview = fact(state, 'nextTurn');
    expect(preview.summary).toBe(`次ターン予約：星＋${upgraded ? 4 : 3}`);
    expect(preview.amount).toBeUndefined();
    const played = play(state);
    expect(played.classResources!.stars).toBe(11);
    expect(state.scheduledEffects).toBeUndefined();
    const next = reduceCombat(played, { type: 'endTurn' });
    expect(next.classResources!.starsGainedThisTurn).toBe(upgraded ? 4 : 3);
    expect(next.classResources!.stars).toBe(11 + (upgraded ? 4 : 3));
  });

  it('delayed draw, block and summon/energy summaries describe definitions rather than guessed future state', () => {
    expect(fact(fixture('oracle_guiding_star'), 'nextTurn').summary).toBe('次ターン予約：追加ドロー2枚');
    expect(fact(fixture('oracle_glittering_torrent', true), 'nextTurn').summary).toBe('次ターン予約：7ブロック');
    const state = fixture('necromancer_prayer', true);
    state.classResources!.ostyHp = 9;
    expect(fact(state, 'nextTurn').summary).toBe('次ターン予約：岩霊HP＋3 ／ エナジー＋3');
    expect(play(state).classResources!.ostyHp).toBe(9);
  });

  it('next-turn energy facts accumulate the existing queue and stay distinct from current energy', () => {
    const state = fixture('colorless_foresight', true);
    state.classResources!.nextTurnEnergy = 2;
    const preview = fact(state, 'nextTurnEnergy');
    expect(preview.amount).toBe(5);
    const played = play(state);
    expect(played.classResources!.nextTurnEnergy).toBe(5);
    expect(played.energy).toBe(state.energy - getCardCost(state.hand[0], state));
    expect(reduceCombat(played, { type: 'endTurn' }).energy).toBe(state.maxEnergy + 5);
  });

  it('temporary strength and power facts match applied values and preserve permanent stacks after expiry', () => {
    const strength = fixture('berserker_setup_strike');
    strength.player.strength = 2;
    const used = play(strength);
    expect(fact(strength, 'temporaryStatus').amount).toBe(used.player.strength);
    expect(used.player.strength).toBe(4);
    expect(reduceCombat(used, { type: 'endTurn' }).player.strength).toBe(2);
    const power = fixture('berserker_flame_barrier');
    power.powerStacks = { thorns: 2 };
    const protectedState = play(power);
    expect(fact(power, 'temporaryPower').amount).toBe(protectedState.powerStacks!.thorns);
    expect(protectedState.powerStacks!.thorns).toBe(6);
    expect(reduceCombat(protectedState, { type: 'endTurn' }).powerStacks!.thorns).toBe(2);
  });

  it.each([false, true])('energy multiplication starts after actual card payment (%s)', (upgraded) => {
    const state = fixture('machinist_double_energy', upgraded);
    expect(fact(state, 'multiply').amount).toBe(play(state).energy);
    expect(fact(state, 'multiply').summary).toBe(`エナジー ${5 - getCardCost(state.hand[0], state)} → ${play(state).energy}`);
  });

  it('draw-to and redraw counts exclude the current card and interactive choices stop later predictions', () => {
    const draw = fixture('assassin_expertise');
    addCards(draw, 'hand', 2);
    addCards(draw, 'drawPile', 10);
    expect(fact(draw, 'drawTo').amount).toBe(4);
    expect(play(draw).hand).toHaveLength(6);
    const redraw = fixture('assassin_gamble');
    addCards(redraw, 'hand', 3);
    expect(fact(redraw, 'redraw').amount).toBe(3);
    const choice = fixture('machinist_salvage');
    addCards(choice, 'hand', 2);
    const before = serializeGame(choice);
    expect(fact(choice, 'exhaustChoice').amount).toBe(1);
    expect(info(choice).facts.some((entry) => entry.key.endsWith(':pendingChoice'))).toBe(true);
    expect(info(choice).facts.some((entry) => entry.key.endsWith(':nextTurnEnergy'))).toBe(false);
    expect(serializeGame(choice)).toBe(before);
  });
});

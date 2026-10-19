import { CARD_DEFINITIONS } from '../data/cards';
import { getCardCost } from '../engine';
import { calculateDamage } from '../engine/combat/damage';
import { reactToPlayerCard } from '../engine/combat/enemyAI';
import { triggerRelics } from '../engine/combat/relics';
import { attackCardBase, nextOrbEvokeIndex, orbEffectValue, orbSlotCount } from '../engine/combat/resources';
import { gainBlock } from '../engine/combat/state';
import { findEnemy, getEnemies, normalizeInto } from '../engine/combat/targets';
import { resolveEffects } from '../engine/effects/resolve';
import type { CardInstance, CombatState, Effect, OrbType } from '../types/game';

export interface CardRuntimeFact {
  key: string;
  summary: string;
  detail: string;
  amount?: number;
  warning?: boolean;
}

export interface CardRuntimeInfo {
  facts: CardRuntimeFact[];
  /** Canonical descriptions remain unchanged; these are contextual, read-only facts. */
  explanation: string;
}

const orbName = (orb: OrbType) => orb === 'lightning' ? '雷' : '霜';
const orbOutcome = (orb: OrbType, amount: number) => orb === 'lightning'
  ? `ランダムな生存敵に${amount}ダメージ`
  : `${amount}ブロック`;

function relevant(effect: Effect, knife: boolean): boolean {
  if (effect.type === 'damage') return knife || !!effect.fromBlock || !!effect.fromForge || (effect.hits ?? 1) > 1;
  if (effect.type === 'power') return effect.power === 'knifeDamage';
  if (effect.type === 'status') return effect.status === 'poison' && effect.target !== 'player';
  if (effect.type === 'generate') return effect.cardId === 'token_knife';
  if (effect.type === 'fetchGenerated') return effect.cardId === 'token_sword';
  return ['loseHp', 'gainStars', 'starBurst', 'forge', 'summon', 'summonDamage', 'channel', 'evoke', 'focus', 'xChannel', 'multiplyPoison'].includes(effect.type)
    || (effect.type === 'draw' && !!effect.perOrbType);
}

function attackSummary(state: CombatState, base: number, all: boolean, hits = 1): string {
  const targets = all ? getEnemies(state).filter((enemy) => enemy.hp > 0) : [findEnemy(state)].filter((enemy) => enemy !== undefined);
  return targets.map((enemy) => `${enemy.name} ${calculateDamage(base, state.player, enemy)}${hits > 1 ? `×${hits}回` : ''}`).join(' ／ ');
}

/**
 * Use the existing pre-card hooks and effect resolver on an isolated clone. This
 * preserves effect order, relic bonuses and lethal HP payments without changing
 * live state, saved counters, or RNG. Random orb targets are never disclosed as
 * a guaranteed prediction. Values are labelled before enemy block, not HP loss.
 */
export function getCardRuntimeInfo(card: CardInstance, state?: CombatState): CardRuntimeInfo | null {
  const definition = CARD_DEFINITIONS[card.cardId];
  if (!state || !definition || definition.unplayable || state.phase !== 'player') return null;
  const effects = card.upgraded ? definition.upgradedEffects : definition.effects;
  const knife = !!definition.tags?.includes('knife');
  if (!effects.some((effect) => relevant(effect, knife))) return null;

  const projected = structuredClone(state);
  normalizeInto(projected);
  // Inspection can include a card in another pile or its upgrade preview.
  projected.hand = projected.hand.filter((held) => held.uid !== card.uid);
  const paidEnergy = getCardCost(card, state);
  projected.energy = Math.max(0, projected.energy - paidEnergy);
  projected.cardsPlayedThisTurn += 1;
  projected.stats.cardsPlayed += 1;
  reactToPlayerCard(projected, definition.type);
  triggerRelics(projected, 'cardPlayed', { card });
  if (definition.type === 'attack') {
    triggerRelics(projected, 'firstAttack');
    if (projected.powerStacks?.blockOnAttack) gainBlock(projected, 'player', projected.powerStacks.blockOnAttack);
  }

  const facts: CardRuntimeFact[] = [];
  for (const [index, effect] of effects.entries()) {
    if (projected.phase !== 'player' || projected.pendingChoice) break;
    const current = projected.classResources;
    const push = (fact: Omit<CardRuntimeFact, 'key'>) => facts.push({ key: `${index}:${effect.type}`, ...fact });
    switch (effect.type) {
      case 'damage': {
        if (!relevant(effect, knife)) break;
        const base = attackCardBase(projected, effect, card);
        const hits = effect.hits ?? 1;
        const source = effect.fromForge ? `鍛造${current?.forge ?? 0}`
          : effect.fromBlock ? `ブロック${projected.player.block}`
          : knife ? `石刃の研磨＋${projected.powerStacks?.knifeDamage ?? 0}` : `${hits}回の連続攻撃`;
        push({ summary: `${source} → ${attackSummary(projected, base, !!effect.all, hits)}`,
          detail: '筋力・弱体・脆弱を各ヒットに適用した、敵ブロックで軽減する前の値。敵が倒れれば残りのヒットは止まります。',
          amount: findEnemy(projected) ? calculateDamage(base, projected.player, findEnemy(projected)!) : 0 });
        break;
      }
      case 'loseHp': {
        const remaining = Math.max(0, projected.player.hp - effect.amount);
        push({ summary: `HP ${projected.player.hp} → ${remaining}${remaining === 0 ? '・使用すると敗北' : ''}`,
          detail: `HPを${effect.amount}直接消費します。ブロック・岩霊の護衛では防げません。HPが0になると後続の効果は発動しません。`,
          amount: Math.min(projected.player.hp, effect.amount), warning: remaining === 0 });
        break;
      }
      case 'gainStars':
        push({ summary: `✦ ${current?.stars ?? 0} → ${(current?.stars ?? 0) + effect.amount} ／ 今ターン ${(current?.starsGainedThisTurn ?? 0) + Math.max(0, effect.amount)}`,
          detail: '累計の星と、このターンに獲得した星を別に記録します。星を消費する追加コストはありません。', amount: effect.amount });
        break;
      case 'starBurst': {
        const gained = current?.starsGainedThisTurn ?? 0;
        const base = gained * effect.amount;
        push({ summary: gained > 0 ? `今ターン✦${gained}×${effect.amount} → ${attackSummary(projected, base, !!effect.all)}` : '今ターンの星獲得0・攻撃は不発',
          detail: '参照するのは星の累計ではなく、このターンの獲得数です。攻撃補正後・敵ブロック軽減前。星は消費しません。',
          amount: gained > 0 && findEnemy(projected) ? calculateDamage(base, projected.player, findEnemy(projected)!) : 0 });
        break;
      }
      case 'forge': {
        const forge = (current?.forge ?? 0) + effect.amount;
        const sword = CARD_DEFINITIONS.token_sword.effects.find((part) => part.type === 'damage');
        push({ summary: `鍛造 ${current?.forge ?? 0} → ${forge} ／ 聖剣の基礎威力${(sword?.amount ?? 0) + forge}`,
          detail: '鍛造はこの戦闘中の聖剣に加算します。表示した基礎威力に、使用時の筋力・弱体・対象の脆弱を適用します。', amount: forge });
        break;
      }
      case 'fetchGenerated': {
        if (effect.cardId !== 'token_sword') break;
        const sword = [...projected.hand, ...projected.drawPile, ...projected.discardPile, ...projected.exhaustPile]
          .find((held) => held.cardId === effect.cardId) ?? { uid: 'runtime-sword', cardId: effect.cardId, upgraded: false };
        const swordDefinition = CARD_DEFINITIONS[sword.cardId];
        const damage = (sword.upgraded ? swordDefinition.upgradedEffects : swordDefinition.effects).find((part) => part.type === 'damage');
        const base = damage ? attackCardBase(projected, damage, sword) : 0;
        push({ summary: `聖剣${sword.upgraded ? '＋' : ''} コスト${getCardCost(sword, projected)} ／ 基礎威力${base}`,
          detail: '既存の聖剣があれば強化状態を保って呼び戻します。手札にあれば新しく生成しません。攻撃補正は聖剣を使う時点の状態に従います。', amount: base });
        break;
      }
      case 'summon':
        push({ summary: `岩霊HP ${current?.ostyHp ?? 0} → ${(current?.ostyHp ?? 0) + effect.amount}`,
          detail: '岩霊が不在なら召喚し、召喚中ならHPを増やします。通常攻撃はブロックの残余を岩霊が肩代わりします。', amount: (current?.ostyHp ?? 0) + effect.amount });
        break;
      case 'summonDamage': {
        const hp = current?.ostyHp ?? 0;
        const amount = hp > 0 ? effect.amount + (effect.plusSummonHp ? hp : 0) : 0;
        push({ summary: hp > 0 ? `岩霊HP${hp} → ${amount}ダメージ` : '岩霊が不在・攻撃は不発',
          detail: '岩霊のHPが1以上のときだけ発動します。教祖の筋力・弱体、敵の脆弱は適用せず、敵のブロックで軽減します。', amount });
        break;
      }
      case 'channel':
      case 'xChannel': {
        const amount = effect.type === 'channel' ? effect.amount : paidEnergy + effect.bonus;
        const focus = current?.focus ?? 0;
        push({ summary: `${orbName(effect.orb)}オーブ${amount}個 ／ 自動${orbEffectValue(effect.orb, 'passive', focus)}・解放${orbEffectValue(effect.orb, 'evoke', focus)}`,
          detail: `集中力${focus}を適用済み。${orbOutcome(effect.orb, orbEffectValue(effect.orb, 'passive', focus))}。最大${orbSlotCount()}スロット。満杯なら右端を解放し、戦闘が続いていれば生成します。${effect.type === 'xChannel' ? `X＝消費エナジー${paidEnergy}。` : ''}`,
          amount });
        break;
      }
      case 'evoke': {
        const orbs = current?.orbs ?? [];
        const nextIndex = nextOrbEvokeIndex(orbs);
        const orb = nextIndex === null ? undefined : orbs[nextIndex];
        const value = orb ? orbEffectValue(orb, 'evoke', current?.focus ?? 0) : 0;
        push({ summary: orb ? `右端の${orbName(orb)}：${value}×${effect.times}回解放` : 'オーブがないため解放しない',
          detail: orb ? `${orbOutcome(orb, value)}を${effect.times}回。毎回同じ右端のオーブを発動してから1個取り除きます。雷は発動ごとに対象を抽選します。` : '空スロットには解放効果がありません。', amount: value });
        break;
      }
      case 'focus':
        push({ summary: `集中力 ${current?.focus ?? 0} → ${(current?.focus ?? 0) + effect.amount}${effect.temporary ? '（このターン）' : ''}`,
          detail: '雷・霜の自動発動と解放の両方に加算します。このターンだけの集中力も、自分のターン終了時の自動発動までは有効です。', amount: (current?.focus ?? 0) + effect.amount });
        break;
      case 'generate': {
        if (effect.cardId !== 'token_knife') break;
        const knifeDefinition = CARD_DEFINITIONS.token_knife;
        const attack = (effect.upgraded ? knifeDefinition.upgradedEffects : knifeDefinition.effects).find((part) => part.type === 'damage');
        const base = (attack?.amount ?? 0) + (projected.powerStacks?.knifeDamage ?? 0);
        push({ summary: `石刃${effect.amount}枚 ／ 基礎威力${base}（研磨込み）`,
          detail: '生成する石刃の基礎威力です。筋力・弱体・脆弱は石刃を使う時点で適用します。手札50枚を超えた分は捨て札に入ります。', amount: base });
        break;
      }
      case 'power':
        if (effect.power === 'knifeDamage') push({ summary: `石刃の研磨 ＋${projected.powerStacks?.knifeDamage ?? 0} → ＋${(projected.powerStacks?.knifeDamage ?? 0) + effect.amount}`,
          detail: 'この戦闘中、石刃の攻撃の基礎威力に加算します。通常カードの攻撃は強化しません。', amount: (projected.powerStacks?.knifeDamage ?? 0) + effect.amount });
        break;
      case 'status':
      case 'multiplyPoison': {
        if (effect.type === 'status' && (effect.status !== 'poison' || effect.target === 'player')) break;
        const targets = effect.type === 'status' && effect.target === 'allEnemies'
          ? getEnemies(projected).filter((enemy) => enemy.hp > 0) : [findEnemy(projected)].filter((enemy) => enemy !== undefined);
        for (const enemy of targets) {
          const after = effect.type === 'multiplyPoison' ? Math.max(0, Math.floor(enemy.poison * effect.amount)) : Math.max(0, enemy.poison + effect.amount);
          push({ summary: `${enemy.name} 毒${enemy.poison} → ${after}`,
            detail: `毒がこのままなら次の敵ターン開始に${Math.min(enemy.hp, after)}HP減少。ブロックを無視し、発動後に毒が1減ります。`, amount: after });
        }
        break;
      }
      case 'draw':
        if (effect.perOrbType) {
          const types = new Set(current?.orbs ?? []).size;
          push({ summary: `オーブ${types}種類 × ${effect.amount} → 最大${types * effect.amount}枚ドロー`, detail: '現在のオーブの種類数を参照します。山札と捨て札の両方が空なら、それ以上は引けません。', amount: types * effect.amount });
        }
        break;
      default:
        break;
    }
    resolveEffects(projected, [effect], definition, { sourceCard: card, xEnergy: paidEnergy });
  }
  if (!facts.length) return null;
  return { facts, explanation: '現在の戦闘状態で使用した場合の目安。対象を切り替えると更新します。攻撃値は敵ブロックによる軽減前です。' };
}

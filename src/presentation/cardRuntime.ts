import { CARD_DEFINITIONS } from '../data/cards';
import { getCardCost } from '../engine';
import { calculatePlayerAttackDamage } from '../engine/combat/damage';
import { recordCardPlay } from '../engine/combat/cardMetrics';
import { triggerCardPowers } from '../engine/combat/cardPowers';
import { reactToPlayerCard } from '../engine/combat/enemyAI';
import { beforeCardRelics, cardBlockWithRelics, getActiveRelics, relicPassiveAmount, triggerRelics } from '../engine/combat/relics';
import { getRelicStrengthBonus, getRelicXBonus } from '../engine/combat/relicModifiers';
import { attackCardBase, attackHitCount, nextOrbEvokeIndex, orbEffectValue, orbSlotCount } from '../engine/combat/resources';
import { gainBlock } from '../engine/combat/state';
import { findEnemy, getEnemies, normalizeInto } from '../engine/combat/targets';
import { resolveEffects } from '../engine/effects/resolve';
import { combatValue, meetsEffectCondition, scaledEffectAmount } from '../engine/combat/values';
import { canUpgradeCard } from './cardUpgrade';
import type { CardInstance, CombatState, CombatValue, Effect, OrbType, PowerKey } from '../types/game';

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

function relevant(effect: Effect, knife: boolean, damageRamp = false): boolean {
  if (effect.type === 'damage') return !!effect.onKill || damageRamp || knife || !!effect.fromBlock || !!effect.fromForge || !!effect.bonusPer || !!effect.hitsPer || !!effect.hitsIf || !!effect.xHits || !!effect.all || !!effect.randomTarget || !!effect.doomFromDamage || (effect.hits ?? 1) > 1;
  if (effect.type === 'block') return !!effect.bonusPer;
  if (effect.type === 'power') return true;
  if (effect.type === 'status') return !!effect.bonusPer || (effect.status === 'poison' && effect.target !== 'player') || effect.amount < 0;
  if (effect.type === 'generate') return effect.cardId === 'token_knife';
  if (effect.type === 'fetchGenerated') return effect.cardId === 'token_sword';
  return ['loseHp', 'loseEnemyHp', 'gainStars', 'starBurst', 'forge', 'summon', 'summonDamage', 'channel', 'evoke', 'focus', 'xChannel', 'multiplyPoison', 'doom', 'nextTurnEnergy', 'conditional', 'nextTurn', 'temporaryStatus', 'temporaryPower', 'multiply', 'drawTo', 'redraw', 'moveChoice', 'moveRandom', 'cardDamageBonus', 'loseMaxHp', 'upgradeAll', 'upgradeRandom', 'generateRandom', 'stun', 'intangible', 'exhaustChoice', 'exhaustRandom', 'discard', 'dexterity', 'plate', 'vigor', 'orbSlots', 'passiveOrbs', 'instanceDamageBonus', 'preventDraw', 'randomStatus', 'multiplyStatus', 'returnSelf', 'moveMatching'].includes(effect.type)
    || (effect.type === 'draw' && !!effect.perOrbType);
}

const valueLabels: Record<CombatValue, string> = {
  handSize: '他の手札', drawPileSize: '山札', discardPileSize: '捨て札', exhaustPileSize: '廃棄札',
  enemyPoison: '対象の毒', enemyWeak: '対象の弱体', enemyVulnerable: '対象の脆弱', enemyDoom: '対象の破滅',
  enemyDebuffs: '対象の状態異常の種類', totalEnemyPoison: '生存敵の毒合計',
  orbCount: '保持オーブ', distinctOrbCount: 'オーブの種類', livingEnemyCount: '生存敵',
  handSkillCount: '他の手札のスキル', skillsPlayedThisTurn: '今ターンに使用したスキル', generatedCardCount: '戦闘中に生成したカード',
  exhaustSoulCount: '廃棄済みの魂札', strikeCardCount: '全所持カードのストライク', discardedThisTurn: '今ターンに手動で捨てた枚数',
  drawnThisTurn: '今ターンのドロー枚数', etherealPlayedBattle: '戦闘中のエセリアル使用枚数', energySpentThisTurn: '今ターンに支払ったエナジー',
};
const statusLabels = { strength: '筋力', weak: '弱体', vulnerable: '脆弱', poison: '毒' };
const powerLabels: Record<PowerKey, string> = {
  stillness: '不動', thorns: '反撃', strengthOnTurn: 'ターン開始筋力', poisonAura: 'ターン開始毒',
  drawOnTurn: 'ターン開始ドロー', blockOnAttack: '攻撃時ブロック', knifeDamage: '石刃の研磨',
  knivesOnTurn: 'ターン開始石刃', focusOnTurn: 'ターン開始集中力', energyOnTurn: 'ターン開始エナジー',
  blockPerOrbTypeOnTurn: 'ターン開始オーブ種類ブロック',
  retainBlock: 'ブロック持続', retainBlockNextTurn: '次ターンのブロック保留', doomRandomOnTurn: 'ターン開始のランダム破滅',
  summonDamage: '岩霊の攻撃加算', energyOnPower: 'パワー使用時エナジー', lightningOnPower: 'パワー使用時の雷生成',
  orbPassiveOnTurn: 'ターン開始の右端オーブ発動', colorlessOnTurn: 'ターン開始の無色生成', strengthOnCardTemporary: 'カード使用時の一時筋力',
};

/** Describe delayed definitions, never guess a future HP/status/target or resolve them early. */
function scheduledSummary(effects: Effect[]): string {
  return effects.map((effect) => {
    switch (effect.type) {
      case 'draw': return `追加ドロー${effect.amount}枚${effect.perOrbType ? '×発動時のオーブ種類数' : ''}`;
      case 'block': return `${effect.amount}ブロック${effect.bonusPer ? `＋発動時の${valueLabels[effect.bonusPer.value]}×${effect.bonusPer.multiplier}` : ''}`;
      case 'energy': return `エナジー${effect.amount >= 0 ? '＋' : ''}${effect.amount}`;
      case 'gainStars': return `星${effect.amount >= 0 ? '＋' : ''}${effect.amount}`;
      case 'summon': return `岩霊HP＋${effect.amount}`;
      case 'heal': return `HP${effect.amount}回復`;
      case 'focus': return `集中力${effect.amount >= 0 ? '＋' : ''}${effect.amount}${effect.bonusPer ? `＋発動時の${valueLabels[effect.bonusPer.value]}×${effect.bonusPer.multiplier}` : ''}`;
      case 'status': return `${statusLabels[effect.status]}${effect.amount >= 0 ? '＋' : ''}${effect.amount}`;
      case 'conditional': return `発動時の条件成立時：${scheduledSummary(effect.effects)}`;
      case 'channel': return `${orbName(effect.orb)}オーブ${effect.amount}個生成`;
      case 'nextTurn': return `さらに次のターン：${scheduledSummary(effect.effects)}`;
      default: return '定義された追加効果（発動時に解決）';
    }
  }).join(' ／ ');
}

function attackSummary(state: CombatState, base: number, all: boolean, card: CardInstance, hits = 1, targetId?: string): string {
  const targets = all ? getEnemies(state).filter((enemy) => enemy.hp > 0) : [findEnemy(state, targetId)].filter((enemy) => enemy !== undefined);
  return targets.map((enemy) => `${enemy.name} ${calculatePlayerAttackDamage(state, base, enemy, 'card', card)}${hits > 1 ? `×${hits}回` : ''}`).join(' ／ ');
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
  const damageRamp = Boolean(state.vigor || relicPassiveAmount(state, 'strikeBonus') || relicPassiveAmount(state, 'upgradedAttackBonus') || getRelicStrengthBonus(state)) ||
    getActiveRelics(state).some((relic) => relic.passive?.attackEveryMultiplier || relic.passive?.vulnerableEnemyMultiplier) ||
    !!state.cardDamageBonuses?.[card.cardId] || !!state.instanceDamageBonuses?.[card.uid] || effects.some((effect) => effect.type === 'cardDamageBonus' || effect.type === 'instanceDamageBonus');
  const blockRelic = Boolean(state.dexterity || relicPassiveAmount(state, 'firstCardBlockMultiplier'));
  if (definition.playCondition && !meetsEffectCondition(state, definition.playCondition, findEnemy(state, state.selectedEnemyId))) {
    return { facts: [{ key: 'playCondition', summary: '使用条件を満たしていません', detail: definition.playCondition.type === 'drawPileEmpty' ? '山札が0枚のときだけ使用できます。コストや効果はまだ解決しません。' : 'カードに記載された使用条件を満たす必要があります。', warning: true }], explanation: '使用条件は実際の戦闘エンジンと同じ条件で確認しています。' };
  }
  if (!effects.some((effect) => relevant(effect, knife, damageRamp) || (state.drawBlocked && ['draw', 'drawTo', 'redraw'].includes(effect.type)) || effect.type === 'block' && blockRelic)) return null;

  const projected = structuredClone(state);
  // Effects such as upgradeAll may update the played card before settlement.
  // The projection must never pass the caller's live card into that resolver.
  const projectedCard = { ...card };
  normalizeInto(projected);
  // A killed selected target must not redirect later effects to a different enemy.
  const targetId = projected.selectedEnemyId;
  // An upgrade preview may supply a hypothetical upgraded instance while the
  // saved zones still contain its normal version. Keep this isolated inventory
  // coherent so upgradeAll does not count the played preview a second time.
  for (const held of [...projected.deck, ...projected.hand, ...projected.drawPile, ...projected.discardPile, ...projected.exhaustPile, ...projected.powers, ...(projected.generatedCards ?? [])]) {
    if (held.uid === card.uid) held.upgraded = card.upgraded;
  }
  // Inspection can include a card in another pile or its upgrade preview.
  projected.hand = projected.hand.filter((held) => held.uid !== card.uid);
  const paidEnergy = getCardCost(card, state);
  const xEnergy = paidEnergy + (definition.xCost ? getRelicXBonus(state) : 0);
  projected.energy = Math.max(0, projected.energy - paidEnergy);
  projected.cardsPlayedThisTurn += 1;
  projected.stats.cardsPlayed += 1;
  recordCardPlay(projected, projectedCard, paidEnergy);
  beforeCardRelics(projected, projectedCard);
  reactToPlayerCard(projected, definition.type);
  if (definition.type === 'attack' && projected.relicIds?.length) {
    projected.relicCounters ??= {};
    const key = `attacks-turn:${projected.turn}`;
    projected.relicCounters[key] = (projected.relicCounters[key] ?? 0) + 1;
  }
  triggerRelics(projected, 'cardPlayed', { card: projectedCard, amount: paidEnergy });
  triggerCardPowers(projected, projectedCard);
  if (definition.type === 'attack') {
    triggerRelics(projected, 'firstAttack');
    if (projected.powerStacks?.blockOnAttack) gainBlock(projected, 'player', projected.powerStacks.blockOnAttack);
  }

  const facts: CardRuntimeFact[] = [];
  const queue = effects.map((effect, index) => ({ effect, index: String(index), inConditional: false }));
  while (queue.length) {
    if (projected.phase !== 'player' || projected.pendingChoice) break;
    const { effect, index, inConditional } = queue.shift()!;
    const current = projected.classResources;
    let ordinal = 0;
    const push = (fact: Omit<CardRuntimeFact, 'key'>) => {
      const suffix = ordinal++;
      facts.push({ key: `${index}${suffix ? `.${suffix}` : ''}:${effect.type}`, ...fact });
    };
    if (effect.type === 'conditional') {
      const active = meetsEffectCondition(projected, effect.condition, findEnemy(projected, targetId));
      push({ summary: active ? '条件成立・追加効果が発動' : '条件未達・追加効果は発動しない',
        detail: 'このカードの先行効果と、カード使用時の処理を反映した時点で条件を判定します。', warning: !active });
      if (active) queue.unshift(...effect.effects.map((part, child) => ({ effect: part, index: `${index}.${child}`, inConditional: true })));
      continue;
    }
    switch (effect.type) {
      case 'damage': {
        if (!relevant(effect, knife, damageRamp)) break;
        if (effect.randomTarget) {
          const targets = getEnemies(projected).filter((enemy) => enemy.hp > 0);
          const amounts = targets.map((enemy) => calculatePlayerAttackDamage(projected, attackCardBase(projected, effect, projectedCard, enemy), enemy, 'card', projectedCard));
          const hits = attackHitCount(projected, effect, xEnergy);
          const low = amounts.length ? Math.min(...amounts) : 0;
          const high = amounts.length ? Math.max(...amounts) : 0;
          push({ summary: `ランダムな生存敵に${low === high ? low : `${low}〜${high}`}×${hits}回`,
            detail: '攻撃ごとに対象を抽選します。表示は生存敵それぞれの攻撃補正を使った範囲で、対象や命中回数の配分は確定していません。敵ブロックで軽減する前の値です。',
            ...(low === high ? { amount: low } : {}) });
          break;
        }
        const target = findEnemy(projected, targetId);
        const base = attackCardBase(projected, effect, projectedCard, target);
        const hits = attackHitCount(projected, effect, xEnergy, target);
        const source = effect.fromForge ? `鍛造${current?.forge ?? 0}`
          : effect.fromBlock ? `ブロック${projected.player.block}`
          : effect.bonusPer ? `${valueLabels[effect.bonusPer.value]}${combatValue(projected, effect.bonusPer.value, target)}`
          : effect.xHits ? `X＝${xEnergy}`
          : effect.hitsPer ? `${valueLabels[effect.hitsPer]}${combatValue(projected, effect.hitsPer, target)}`
          : knife ? `石刃の研磨＋${projected.powerStacks?.knifeDamage ?? 0}`
          : damageRamp ? `${effects.some((part) => part.type === 'instanceDamageBonus') || projected.instanceDamageBonuses?.[card.uid] ? 'この1枚の威力' : '同名カードの威力'}＋${(projected.cardDamageBonuses?.[card.cardId] ?? 0) + (projected.instanceDamageBonuses?.[card.uid] ?? 0)}` : `${hits}回の連続攻撃`;
        const targets = effect.all ? getEnemies(projected).filter((enemy) => enemy.hp > 0) : target ? [target] : [];
        const summary = targets.map((enemy) => {
          const eachHits = attackHitCount(projected, effect, xEnergy, enemy);
          const eachDamage = calculatePlayerAttackDamage(projected, attackCardBase(projected, effect, projectedCard, enemy), enemy, 'card', projectedCard);
          return `${enemy.name} ${eachHits === 0 ? '攻撃0回' : `${eachDamage}${eachHits > 1 ? `×${eachHits}回` : ''}`}`;
        }).join(' ／ ');
        push({ summary: `${source} → ${summary}`,
          detail: `筋力・弱体・脆弱を各ヒットに適用した、敵ブロックで軽減する前の値。敵が倒れれば残りのヒットは止まります。${effect.doomFromDamage ? '実際に減らしたHPと同じ破滅を、生き残った敵に加えます。' : ''}${effect.onKill ? `この攻撃で倒した敵ごとに${effect.onKill.stars ? `星＋${effect.onKill.stars}` : ''}${effect.onKill.energy ? `エナジー＋${effect.onKill.energy}` : ''}。` : ''}`,
          amount: target && hits > 0 ? calculatePlayerAttackDamage(projected, base, target, 'card', projectedCard) : 0 });
        break;
      }
      case 'block': {
        if (!effect.bonusPer && !blockRelic) break;
        const amount = cardBlockWithRelics(projected, scaledEffectAmount(projected, effect) + (definition.defense && projected.jitto >= 50 ? 2 : 0));
        push({ summary: `${effect.bonusPer ? `${valueLabels[effect.bonusPer.value]}${combatValue(projected, effect.bonusPer.value)} → ` : '敏捷・レリック補正後 '}${amount}ブロック`,
          detail: 'この効果の解決時点の値を参照します。防御カードのじっと・敏捷・最初のカードブロック補正も適用済みです。', amount });
        break;
      }
      case 'loseHp': {
        const loss = Math.max(0, effect.amount - relicPassiveAmount(projected, 'hpLossReduction'));
        const checkpoint = structuredClone(projected);
        resolveEffects(checkpoint, [effect], definition, { targetId, sourceCard: projectedCard, xEnergy });
        const defeated = checkpoint.phase === 'defeat';
        push({ summary: `HP ${projected.player.hp} → ${checkpoint.player.hp}${defeated ? '・使用すると敗北' : ''}`,
          detail: `HPを${loss}直接消費します${loss !== effect.amount ? '（レリックの軽減後）' : ''}。ブロック・岩霊の護衛では防げません。復活レリックがあれば、その発動も反映します。敗北すると後続の効果は発動しません。`,
          amount: Math.min(projected.player.hp, loss), warning: defeated });
        break;
      }
      case 'loseEnemyHp': {
        const target = findEnemy(projected, targetId);
        if (!target) break;
        const amount = Math.min(target.hp, Math.max(0, Math.floor(effect.amount)));
        push({ summary: `${target.name} HP ${target.hp} → ${target.hp - amount}`,
          detail: '敵のHPを直接失わせます。敵ブロック、筋力、弱体、脆弱、攻撃ダメージ倍率は適用しません。', amount });
        break;
      }
      case 'loseMaxHp': {
        const lost = Math.min(projected.player.maxHp, Math.max(0, Math.floor(effect.amount)));
        const remaining = projected.player.maxHp - lost;
        push({ summary: `最大HP ${projected.player.maxHp} → ${remaining}${remaining === 0 ? '・使用すると敗北' : ''}`,
          detail: `最大HPを${lost}直接失います。現在HPが新しい上限を超えれば同じ上限まで下がります。この最大HP減少は戦闘後も残ります。`, amount: lost, warning: remaining === 0 });
        break;
      }
      case 'cardDamageBonus': {
        const previous = projected.cardDamageBonuses?.[card.cardId] ?? 0;
        push({ summary: `同名カードの威力 ＋${previous} → ＋${previous + effect.amount}`,
          detail: 'この効果より前にある攻撃は上昇前の威力です。以後、この戦闘中の同じカードIDすべての各ヒットに加算します。別の戦闘には持ち越しません。', amount: previous + effect.amount });
        break;
      }
      case 'upgradeAll': {
        const targets = [...projected.hand, ...projected.drawPile, ...projected.discardPile, ...projected.exhaustPile, ...projected.powers, ...projected.deck, ...(projected.generatedCards ?? []), projectedCard];
        const count = new Set(targets.filter(canUpgradeCard).map((held) => held.uid)).size;
        push({ summary: `${count}枚をこの戦闘中だけ強化`,
          detail: '手札・山札・捨て札・廃棄札・使用中のカードが対象です。強化済み・強化不可のカードは変更しません。戦闘終了で、この効果による一時強化だけ元に戻ります。じっとゲージの神格化とは別の効果です。', amount: count });
        break;
      }
      case 'upgradeRandom': {
        const amount = Math.min(projected[effect.from].filter(canUpgradeCard).length, Math.max(0, Math.floor(effect.amount)));
        push({ summary: `${effect.from === 'hand' ? '他の手札' : effect.from === 'drawPile' ? '山札' : '捨て札'}からランダムに${amount}枚をこの戦闘中だけ強化`,
          detail: '対象は使用時にシード付きで抽選します。強化済み・強化不可のカードは除き、同じカードを重複して抽選しません。戦闘終了で一時強化は元に戻ります。', amount });
        break;
      }
      case 'generateRandom':
        push({ summary: `ランダムな無色カード${effect.upgraded ? '（強化済み）' : ''}を${effect.amount}枚生成`,
          detail: `取得可能な通常の無色カードだけを使用時に抽選し、${effect.destination === 'hand' ? '手札' : effect.destination === 'drawPile' ? '山札' : '捨て札'}に加えます。祝福限定・生成専用カードは含みません。手札上限を超えた分は捨て札に入ります。`, amount: effect.amount });
        break;
      case 'stun': {
        const enemy = findEnemy(projected, targetId);
        if (!enemy) break;
        const after = (enemy.stun ?? 0) + Math.max(0, Math.floor(effect.amount));
        push({ summary: `${enemy.name} スタン${enemy.stun ?? 0} → ${after}`,
          detail: '次の敵行動を1回休み、スタンを1減らして予告を次へ進めます。毒と破滅は行動を休む前に通常どおり解決します。', amount: after });
        break;
      }
      case 'intangible': {
        const after = (projected.intangible ?? 0) + Math.max(0, Math.floor(effect.amount));
        push({ summary: `霊体 ${projected.intangible ?? 0} → ${after} ／ 敵の攻撃は1ヒット最大1`,
          detail: '敵の攻撃だけを軽減し、次の敵ターン終了時に1減ります。毒・HP消費・最大HP減少は軽減しません。複数体・連続攻撃はヒットごとに最大1です。', amount: after });
        break;
      }
      case 'gainStars':
        push({ summary: `✦ ${current?.stars ?? 0} → ${(current?.stars ?? 0) + effect.amount} ／ 今ターン ${(current?.starsGainedThisTurn ?? 0) + Math.max(0, effect.amount)}`,
          detail: '累計の星と、このターンに獲得した星を別に記録します。星を消費する追加コストはありません。', amount: effect.amount });
        break;
      case 'starBurst': {
        const gained = current?.starsGainedThisTurn ?? 0;
        const base = attackCardBase(projected, { type: 'damage', amount: gained * effect.amount }, projectedCard);
        push({ summary: gained > 0 ? `今ターン✦${gained}×${effect.amount} → ${attackSummary(projected, base, !!effect.all, projectedCard, 1, targetId)}` : '今ターンの星獲得0・攻撃は不発',
          detail: '参照するのは星の累計ではなく、このターンの獲得数です。攻撃補正後・敵ブロック軽減前。星は消費しません。',
          amount: gained > 0 && findEnemy(projected, targetId) ? calculatePlayerAttackDamage(projected, base, findEnemy(projected, targetId)!, 'card', projectedCard) : 0 });
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
        const amount = hp > 0 ? effect.amount + (projected.powerStacks?.summonDamage ?? 0) + (effect.plusSummonHp ? hp : 0) : 0;
        push({ summary: hp > 0 ? `岩霊HP${hp} → ${amount}ダメージ` : '岩霊が不在・攻撃は不発',
          detail: '岩霊のHPが1以上のときだけ発動します。教祖の筋力・弱体、敵の脆弱は適用せず、敵のブロックで軽減します。', amount });
        break;
      }
      case 'channel':
      case 'xChannel': {
        const amount = Math.max(0, Math.floor(effect.type === 'channel' ? scaledEffectAmount(projected, effect) : xEnergy + effect.bonus));
        const focus = current?.focus ?? 0;
        push({ summary: `${orbName(effect.orb)}オーブ${amount}個 ／ 自動${orbEffectValue(effect.orb, 'passive', focus)}・解放${orbEffectValue(effect.orb, 'evoke', focus)}`,
          detail: `集中力${focus}を適用済み。${orbOutcome(effect.orb, orbEffectValue(effect.orb, 'passive', focus))}。最大${orbSlotCount(projected)}スロット。満杯なら右端を解放し、戦闘が続いていれば生成します。${effect.type === 'xChannel' ? `X＝消費エナジー${paidEnergy}${xEnergy !== paidEnergy ? `＋レリック補正${xEnergy - paidEnergy}` : ''}。` : ''}`,
          amount });
        break;
      }
      case 'orbSlots':
        push({ summary: `オーブスロット ${orbSlotCount(projected)} → ${orbSlotCount(projected) + effect.amount}`,
          detail: 'この戦闘中の最大スロット数を増やします。保持中のオーブの種類・順番は変えず、増設だけでは解放しません。', amount: orbSlotCount(projected) + effect.amount });
        break;
      case 'passiveOrbs': {
        const held = current?.orbs ?? [];
        const selected = findEnemy(projected, targetId);
        for (const type of ['lightning', 'frost'] as const) {
          if (effect.orb && effect.orb !== type) continue;
          const count = held.filter((orb) => orb === type).length;
          const amount = orbEffectValue(type, 'passive', current?.focus ?? 0);
          const target = type === 'frost' ? '自分にブロック' : effect.target === 'selected' ? selected ? `${selected.name}にダメージ` : '対象不在・不発' : 'ランダムな生存敵にダメージ';
          push({ summary: `${orbName(type)}オーブ${count}個 × 自動${amount} → ${target}`,
            detail: '現在の集中力を反映した自動効果です。オーブを解放・消費せず、順番も変えません。雷の自動効果に教祖の攻撃補正は適用しません。対象を倒しても別の敵には変更しません。', amount: type === 'lightning' && effect.target === 'selected' && !selected ? 0 : count * amount });
        }
        break;
      }
      case 'evoke': {
        const orbs = current?.orbs ?? [];
        const nextIndex = nextOrbEvokeIndex(orbs);
        const orb = nextIndex === null ? undefined : orbs[nextIndex];
        const value = orb ? orbEffectValue(orb, 'evoke', current?.focus ?? 0) : 0;
        const times = Math.max(0, effect.times + (effect.fromEnergy ? xEnergy : 0));
        const order = effect.all ? [...orbs].reverse() : orb ? [orb] : [];
        push({ summary: orb ? effect.all
          ? `右端から全${orbs.length}個：${order.map((type) => `${orbName(type)}${orbEffectValue(type, 'evoke', current?.focus ?? 0)}×${times}回`).join(' → ')}`
          : `右端の${orbName(orb)}：${value}×${times}回解放` : 'オーブがないため解放しない',
          detail: orb ? `${orbOutcome(orb, value)}を${times}回。毎回同じ右端のオーブを発動してから1個取り除きます。雷は発動ごとに対象を抽選します。${effect.fromEnergy ? `消費エナジー${paidEnergy}${xEnergy !== paidEnergy ? `＋レリック補正${xEnergy - paidEnergy}` : ''}。` : ''}${times === 0 ? '0回でもオーブは取り除きます。' : ''}${effect.all ? '途中で戦闘が終われば後続の解放は止まります。' : ''}` : '空スロットには解放効果がありません。', amount: times > 0 ? value : 0 });
        break;
      }
      case 'focus': {
        const amount = Math.floor(scaledEffectAmount(projected, effect));
        push({ summary: `集中力 ${current?.focus ?? 0} → ${(current?.focus ?? 0) + amount}${effect.temporary ? '（このターン）' : ''}`,
          detail: '雷・霜の自動発動と解放の両方に加算します。このターンだけの集中力も、自分のターン終了時の自動発動までは有効です。', amount: (current?.focus ?? 0) + amount });
        break;
      }
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
        else if (effect.power === 'energyOnTurn') push({ summary: `毎ターン開始エナジー ＋${projected.powerStacks?.energyOnTurn ?? 0} → ＋${(projected.powerStacks?.energyOnTurn ?? 0) + effect.amount}`,
          detail: '取得直後にはエナジーを得ません。次の自分のターンから、基本エナジー回復後に毎回加算します。', amount: (projected.powerStacks?.energyOnTurn ?? 0) + effect.amount });
        else if (effect.power === 'focusOnTurn') push({ summary: `毎ターン開始の集中力変化 ${projected.powerStacks?.focusOnTurn ?? 0} → ${(projected.powerStacks?.focusOnTurn ?? 0) + effect.amount}`,
          detail: '次の自分のターンから毎回、集中力をこの値だけ増減します。集中力は0未満にもなり、オーブ効果の最低値は0です。', amount: (projected.powerStacks?.focusOnTurn ?? 0) + effect.amount });
        else if (effect.power === 'blockPerOrbTypeOnTurn') {
          const perType = (projected.powerStacks?.blockPerOrbTypeOnTurn ?? 0) + effect.amount;
          const types = new Set(current?.orbs ?? []).size;
          push({ summary: `毎ターン開始：オーブ${types}種類 × ${perType} → 現在なら${types * perType}ブロック`,
            detail: '取得直後にはブロックを得ません。各ターン開始時に保持しているオーブの種類数を改めて数えます。同じ種類を複数保持しても1種類です。', amount: types * perType });
        }
        else push({ summary: `${powerLabels[effect.power]} ＋${effect.amount}`, detail: effect.power === 'summonDamage' ? '岩霊の命令による攻撃に加算します。プレイヤーの筋力とは別の補正です。' : 'カード定義の発動条件で作用し、同じパワーは加算されます。', amount: effect.amount });
        break;
      case 'instanceDamageBonus':
        push({ summary: `この1枚の威力 ＋${projected.instanceDamageBonuses?.[card.uid] ?? 0} → ＋${(projected.instanceDamageBonuses?.[card.uid] ?? 0) + effect.amount}`, detail: '同名の別カードとは共有せず、この戦闘中だけ積み重なります。', amount: effect.amount });
        break;
      case 'preventDraw':
        push({ summary: '使用後、このターンの追加ドローを禁止', detail: '先に記載されたドローは行い、以降のドローだけを止めます。次ターン開始時に解除します。' });
        break;
      case 'returnSelf':
        push({ summary: '解決後、このカードを山札の一番上へ', detail: '複製せず、使用した同じカードを戻します。手札へ引き戻せば再び使用できます。' });
        break;
      case 'moveMatching': {
        const matches = projected.discardPile.filter((held) => { const def = CARD_DEFINITIONS[held.cardId]; return !def.xCost && !def.unplayable && (held.upgraded ? def.upgradedCost ?? def.cost : def.cost) === effect.cost; });
        const amount = Math.min(matches.length, Math.max(0, 50 - projected.hand.length));
        push({ summary: `捨て札の0コストを最大${amount}枚回収`, detail: 'Xコストは含めません。手札50枚を超える分は捨て札に残り、回収はドローとして数えません。', amount });
        break;
      }
      case 'randomStatus':
        push({ summary: `ランダムな生存敵に${statusLabels[effect.status]}${effect.amount + relicPassiveAmount(projected, 'poisonBonus')}を${effect.hits}回`, detail: '各回、戦闘のシードで対象を抽選します。表示から抽選結果を先に確定しません。', amount: effect.amount });
        break;
      case 'multiplyStatus': {
        const enemy = findEnemy(projected, targetId);
        if (enemy) push({ summary: `${enemy.name} ${statusLabels[effect.status]} ${enemy[effect.status]} → ${Math.floor(enemy[effect.status] * effect.amount)}`, detail: '先行する効果で付与した分も含め、現在の蓄積値を参照します。', amount: Math.floor(enemy[effect.status] * effect.amount) });
        break;
      }
      case 'dexterity': {
        const amount = (projected.dexterity ?? 0) + effect.amount;
        push({ summary: `敏捷性 ${projected.dexterity ?? 0} → ${amount}${effect.temporary ? '（このターン）' : ''}`,
          detail: 'カードのブロック獲得量を増減します。オーブの自動効果、プレート、既存ブロックを倍にする効果には加算しません。', amount });
        break;
      }
      case 'vigor': {
        const amount = (projected.vigor ?? 0) + effect.amount;
        push({ summary: `活力 ${projected.vigor ?? 0} → ${amount}`,
          detail: '次のアタックカードの各ヒットの基礎威力に加算し、そのカードの解決後に消費します。', amount });
        break;
      }
      case 'plate': {
        const amount = (projected.plate ?? 0) + effect.amount;
        push({ summary: `プレート ${projected.plate ?? 0} → ${amount}`,
          detail: 'ターン終了時に残りのプレートと同じブロックを得ます。敵の攻撃でHPを失うたび1減り、毒やHP消費では減りません。', amount });
        break;
      }
      case 'status':
      case 'temporaryStatus':
      case 'multiplyPoison': {
        const targets = effect.type !== 'multiplyPoison' && effect.target === 'player' ? [projected.player]
          : effect.type !== 'multiplyPoison' && effect.target === 'allEnemies'
            ? getEnemies(projected).filter((enemy) => enemy.hp > 0) : [findEnemy(projected, targetId)].filter((enemy) => enemy !== undefined);
        for (const enemy of targets) {
          const status = effect.type === 'multiplyPoison' ? 'poison' : effect.status;
          const before = enemy[status];
          const poisonBonus = status === 'poison' && enemy !== projected.player && effect.amount > 0 && effect.type !== 'multiplyPoison'
            ? relicPassiveAmount(projected, 'poisonBonus') : 0;
          const statusAmount = effect.type === 'status' ? scaledEffectAmount(projected, effect, findEnemy(projected, targetId)) : effect.amount;
          const after = effect.type === 'multiplyPoison' ? Math.max(0, Math.floor(before * effect.amount))
            : effect.allowNegative && status === 'strength' ? before + statusAmount : Math.max(0, before + statusAmount + poisonBonus);
          push({ summary: `${enemy.name} ${statusLabels[status]}${before} → ${after}${effect.type === 'temporaryStatus' ? '（このターン）' : ''}`,
            detail: `${status === 'poison' ? `毒がこのままなら次の${enemy === projected.player ? '自分' : '敵'}ターン開始に${Math.min(enemy.hp, after)}HP減少。ブロックを無視し、発動後に毒が1減ります。` : '先行するカード効果を解決した時点の値です。'}${effect.type === 'temporaryStatus' ? '敵の行動後、次の自分のターン開始前に、この効果で変化した分を戻します。' : ''}`, amount: after });
        }
        break;
      }
      case 'doom': {
        const targets = effect.all ? getEnemies(projected).filter((enemy) => enemy.hp > 0) : [findEnemy(projected, targetId)].filter((enemy) => enemy !== undefined);
        for (const enemy of targets) {
          const amount = Math.max(0, Math.floor(scaledEffectAmount(projected, effect, enemy)));
          const after = (enemy.doom ?? 0) + amount;
          push({ summary: `${enemy.name} 破滅${enemy.doom ?? 0} → ${after}`,
            detail: '敵ターン開始に毒を先に解決し、破滅がその時点の残りHP以上なら敵を倒します。付与した瞬間には発動しません。', amount: after });
        }
        break;
      }
      case 'draw':
        if (projected.drawBlocked) push({ summary: 'このターンの追加ドローは不可', detail: 'ドロー禁止の間は山札・捨て札・乱数を動かしません。次の自分のターンから通常に戻ります。', amount: 0 });
        else if (effect.perOrbType) {
          const types = new Set(current?.orbs ?? []).size;
          push({ summary: `オーブ${types}種類 × ${effect.amount} → 最大${types * effect.amount}枚ドロー`, detail: '現在のオーブの種類数を参照します。山札と捨て札の両方が空なら、それ以上は引けません。', amount: types * effect.amount });
        }
        else if (inConditional) push({ summary: `条件成立で最大${effect.amount}枚ドロー`, detail: '山札と捨て札が空、または手札が上限ならそれ以上は引けません。', amount: effect.amount });
        break;
      case 'drawTo': {
        const amount = projected.drawBlocked ? 0 : Math.max(0, effect.amount - projected.hand.length);
        if (projected.drawBlocked) { push({ summary: 'このターンの追加ドローは不可', detail: '手札補充もドロー禁止の対象です。山札・捨て札・乱数を動かしません。', amount }); break; }
        push({ summary: `他の手札${projected.hand.length}枚 → 最大${amount}枚ドロー`, detail: `このカードを手札から出した後、手札が${effect.amount}枚になるまで引きます。山札・捨て札が尽きれば途中で止まります。`, amount });
        break;
      }
      case 'redraw':
        push({ summary: `他の手札${projected.hand.length}枚を捨て、最大${projected.drawBlocked ? 0 : projected.hand.length}枚ドロー`, detail: projected.drawBlocked ? '手札は捨てますが、ドロー禁止のため引き直せません。' : '使用中のカードは数えません。捨て札の再シャッフルや手札上限は通常のドローと同じです。', amount: projected.drawBlocked ? 0 : projected.hand.length });
        break;
      case 'multiply': {
        const before = effect.resource === 'block' ? projected.player.block : projected.energy;
        const multiplied = Math.min(1_000_000, Math.max(0, Math.floor(before * effect.amount)));
        const after = effect.resource === 'block' ? before + cardBlockWithRelics(projected, Math.max(0, multiplied - before), false, false) : multiplied;
        push({ summary: `${effect.resource === 'block' ? 'ブロック' : 'エナジー'} ${before} → ${after}`, detail: 'カードのコストと先行効果を解決した後の値に倍率を適用します。', amount: after });
        break;
      }
      case 'nextTurnEnergy':
        push({ summary: `次ターンの追加エナジー ＋${current?.nextTurnEnergy ?? 0} → ＋${(current?.nextTurnEnergy ?? 0) + effect.amount}`,
          detail: '戦闘が続いていれば、次の自分のターンの基本エナジー回復時に一度だけ加算します。今のエナジーは増やしません。', amount: (current?.nextTurnEnergy ?? 0) + effect.amount });
        break;
      case 'nextTurn':
        push({ summary: `次ターン予約：${scheduledSummary(effect.effects)}`,
          detail: '今は予約だけ行い、効果は即時発動しません。戦闘継続時の次の自分のターン開始に、エナジー回復・パワー・レリック後、通常ドロー前に解決します。防御補正や参照する状態は発動時に判定します。' });
        break;
      case 'temporaryPower': {
        const after = (projected.powerStacks?.[effect.power] ?? 0) + effect.amount;
        push({ summary: `${powerLabels[effect.power]} ${projected.powerStacks?.[effect.power] ?? 0} → ${after}（このターン）`,
          detail: `${effect.expireAt === 'playerEnd' ? 'このターンの終了時まで' : '次の自分のターン開始前まで'}有効です。既にある永続分を残し、この効果で追加した分だけ解除します。`, amount: after });
        break;
      }
      case 'discard':
      case 'exhaustChoice':
      case 'moveChoice': {
        const source = effect.type === 'moveChoice' ? effect.from : effect.type === 'exhaustChoice' ? effect.from ?? 'hand' : 'hand';
        const amount = Math.min(projected[source].length, Math.max(0, Math.floor(effect.amount)), effect.type === 'moveChoice' && effect.to === 'hand' ? Math.max(0, 50 - projected.hand.length) : Infinity);
        const destination = effect.type === 'moveChoice' ? effect.to === 'hand' ? '手札に戻す' : '山札の一番上に置く' : effect.type === 'discard' ? '捨てる' : '廃棄する';
        push({ summary: `${source === 'hand' ? '他の手札' : source === 'drawPile' ? '山札' : '捨て札'}から${amount}枚を${destination}`,
          detail: amount > 0 && amount < projected[source].length ? '対象は使用後にプレイヤーが選択します。選択に依存する後続効果の値は、選択確定後に決まります。' : '対象が全てなら自動で移動し、対象がなければこの処理を飛ばします。', amount });
        break;
      }
      case 'moveRandom': {
        const amount = Math.min(projected[effect.from].length, Math.max(0, Math.floor(effect.amount)), Math.max(0, 50 - projected.hand.length));
        push({ summary: `${effect.from === 'drawPile' ? '山札' : '捨て札'}からランダムに${amount}枚を手札に戻す`,
          detail: '対象はカード使用時にシード付きで抽選します。プレビューから対象や抽選結果を確定できません。', amount });
        break;
      }
      case 'exhaustRandom':
        push({ summary: `他の手札からランダムに${Math.min(projected.hand.length, Math.max(0, effect.amount))}枚廃棄`,
          detail: '廃棄するカードは使用時に抽選します。プレビューで抽選結果は確定・公開しません。', amount: Math.min(projected.hand.length, Math.max(0, effect.amount)) });
        break;
      default:
        break;
    }
    const previousRng = projected.rngState;
    resolveEffects(projected, [effect], definition, { targetId, sourceCard: projectedCard, xEnergy });
    if (projected.pendingChoice) {
      facts.push({ key: `${index}:pendingChoice`, summary: 'カード選択後の効果は確定後に解決',
        detail: '選択によって変わる後続の数値はここでは確定しません。プレビューではカードを移動・廃棄しません。' });
    } else if (projected.rngState !== previousRng && queue.length && ['damage', 'channel', 'evoke', 'xChannel', 'passiveOrbs', 'exhaustRandom', 'moveRandom', 'upgradeRandom', 'generateRandom', 'randomStatus'].includes(effect.type)) {
      facts.push({ key: `${index}:randomContinuation`, summary: '抽選後の追加効果は使用時に確定',
        detail: '敵やカードの抽選結果を固定の予測として見せないため、抽選に続く効果の数値は表示していません。' });
      break;
    }
  }
  if (!facts.length) return null;
  return { facts, explanation: '現在の戦闘状態で使用した場合の目安。対象を切り替えると更新します。攻撃値は敵ブロックによる軽減前です。' };
}

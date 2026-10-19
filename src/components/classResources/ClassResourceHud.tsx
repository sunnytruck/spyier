import { useCallback, useState } from 'react';
import type { CombatState } from '../../types/game';
import { getEnemies } from '../../engine/combat/targets';
import { getEnemyResourceView, getHealthSpendView, getKnifeView, getOrbView, getStarView, getSummonView } from '../../engine/combat/resourceView';
import { CLASS_DEFINITIONS } from '../../data/classes';
import { CARD_DEFINITIONS } from '../../data/cards';
import { CardView } from '../CardView';
import { ResourceDetails } from './ResourceDetails';
import './class-resources.css';

export { OrbSlots } from './OrbSlots';
export { OstyCompanion } from './OstyCompanion';

/** A small, stable player-side shelf; detailed rules stay behind touchable controls. */
export function ClassResourceHud({ state }: { state: CombatState }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (!state.classId) return null;
  const definition = CLASS_DEFINITIONS[state.classId];
  const orb = getOrbView(state);
  const stars = getStarView(state);
  const summon = getSummonView(state);
  const knife = getKnifeView(state);
  const hpSpenders = state.hand.flatMap((card) => {
    const { amount } = getHealthSpendView(state, card);
    return amount > 0 ? [{ card, amount }] : [];
  });
  const enemies = getEnemies(state).filter((enemy) => enemy.hp > 0);
  const poisoned = enemies.filter((enemy) => enemy.poison > 0);
  const resourceSummary = {
    berserker: `筋力 ${state.player.strength}、HP消費カード ${hpSpenders.length}枚`,
    assassin: `石刃強化 +${knife.bonusDamage}、手札の石刃 ${knife.cardsInHand}枚、毒 ${poisoned.length}体`,
    oracle: `鍛造 ${stars.forge}、聖剣の基礎威力 ${stars.sword.forgedBaseDamage}`,
    necromancer: `岩霊 ${summon.active ? '護衛中' : '不在'}、手札の命令 ${summon.commands.length}件`,
    machinist: `オーブ ${orb.count}/${orb.capacity}、集中力 ${orb.focus}`,
  }[state.classId];
  return <>
    <div className={`class-resource-shelf class-resource-shelf--${state.classId}`} aria-label={`${definition.displayName}の固有リソース`}>
      <span className="class-resource-profession">{definition.glyph} {definition.displayName}</span>
      <button type="button" className="class-resource-readout" onClick={() => setOpen(true)} title={`${resourceSummary}。クリック・タップで効果と条件を確認できます。`} aria-label={`${definition.displayName}、${resourceSummary}。固有リソースの詳細を表示`}>
        {state.classId === 'berserker' && <><span className="resource-stat" data-resource-hud="strength"><span className="resource-motion"><span aria-hidden="true">↑</span><b>{state.player.strength}</b></span><span>筋力</span></span><small>{hpSpenders.length ? `HP消費カード ${hpSpenders.length}枚 · 詳細` : '攻撃1ヒットごとに加算'}</small></>}
        {state.classId === 'assassin' && <><span className="resource-stat" data-resource-hud="knife"><span className="resource-motion"><span aria-hidden="true">〆</span><b>+{knife.bonusDamage}</b></span><span>石刃強化</span></span><small>手札の石刃 {knife.cardsInHand}枚 · 毒 {poisoned.length}体</small></>}
        {state.classId === 'oracle' && <><span className="resource-stat" data-resource-hud="forge"><span className="resource-motion"><span aria-hidden="true">⚒</span><b>{stars.forge}</b></span><span>鍛造</span></span><small>聖剣 {stars.sword?.forgedBaseDamage ?? '—'} 基礎威力 · 詳細</small></>}
        {state.classId === 'necromancer' && <><span className="resource-stat"><span className="resource-motion"><span aria-hidden="true">霊</span><b>{summon.active ? '護衛' : '不在'}</b></span><span>岩霊の命令</span></span><small>{summon.commands.length ? `手札に命令 ${summon.commands.length}件 · 詳細` : '召喚して、カードで攻撃を命令'}</small></>}
        {state.classId === 'machinist' && <><span className="resource-stat"><span><b>{orb.count}<i>/{orb.capacity}</i></b></span><span>オーブ</span></span><span className="resource-focus" data-resource-hud="focus"><span className="resource-motion">集中力 <b>{orb.focus > 0 ? '+' : ''}{orb.focus}</b></span>{orb.temporaryFocus !== 0 && <small>一時 {orb.temporaryFocus > 0 ? '+' : ''}{orb.temporaryFocus}</small>}</span></>}
      </button>
      {(state.classResources?.nextTurnEnergy ?? 0) > 0 && <span className="resource-next-energy">次ターンのエナジー +{state.classResources!.nextTurnEnergy}</span>}
    </div>
    {open && <ResourceDetails title={`${definition.displayName}の戦い方`} onClose={close}>
      {state.classId === 'berserker' && <><p>現在の筋力 <strong>{state.player.strength}</strong>。攻撃1ヒットごとの基礎ダメージに加算され、弱体・敵の脆弱を反映して計算します。</p><p>HP消費はブロックや岩霊で防げません。HPが0になると敗北します。</p>{hpSpenders.length ? <><h3>手札のHP消費</h3><ul>{hpSpenders.map(({ card, amount }) => <li key={card.uid}><strong>{CARD_DEFINITIONS[card.cardId].name}{card.upgraded ? '＋' : ''}</strong>：HP {amount}消費{amount >= state.player.hp && <em className="resource-lethal-warning"> · 使用すると敗北</em>}</li>)}</ul></> : <p>現在の手札にHPを消費するカードはありません。</p>}<p>ブロックを攻撃に使うカードは現在のブロックを参照します。連続攻撃では筋力が各ヒットに加算されます。</p></>}
      {state.classId === 'assassin' && <><p>石刃強化 <strong>+{knife.bonusDamage}</strong> · 手札の石刃 <strong>{knife.cardsInHand}枚</strong></p><p>通常の石刃：基礎 <strong>{knife.baseDamage}</strong>、選択中の敵への現在の攻撃値 <strong>{knife.damagePerHit}</strong>。敵ブロックで軽減されます。</p><p>石刃は使うと廃棄される生成カードです。強化版はカードに記載された基礎値を使い、同じ石刃強化が加算されます。</p><h3>次の毒・破滅の処理</h3><ul>{enemies.map((enemy) => { const view = getEnemyResourceView(enemy); return <li key={enemy.instanceId ?? enemy.id}><strong>{enemy.name}</strong>：毒 {view.poison} → 次に{view.poisonDamage}ダメージ、毒は{view.poisonAfterTick}へ{view.doomTriggers ? ' · 続いて破滅発動' : ''}</li>; })}</ul><p>毒は敵ターン開始時、ブロックを無視してHPを減らし、毒の蓄積値が1減ります。</p></>}
      {state.classId === 'oracle' && <><p>所持星 <strong>{stars.stars}</strong> · このターンの獲得星 <strong>{stars.gainedThisTurn}</strong></p><p>現在の星は消費コストではありません。星を参照するカードは<strong>このターンの獲得数</strong>を使い、星を消費しません。</p>{stars.burstCards.length > 0 && <><h3>手札の星参照カード</h3><ul>{stars.burstCards.map((card, index) => <li key={`${card.cardUid}-${index}`}><strong>{card.name}</strong>：{stars.gainedThisTurn} × {card.factor} = 基礎{card.baseDamage}、選択中の敵へ{card.damagePerHit}ダメージ{stars.gainedThisTurn === 0 && '（獲得0のため不発）'}</li>)}</ul></>}{stars.sword && <><h3>聖剣 · 現在の鍛造 {stars.forge}</h3><p>{stars.sword.generated ? '生成済みの聖剣' : '未生成 · 顕現すると生成'} · コスト <strong>{stars.sword.cost}</strong></p><p>基礎{stars.sword.baseDamage} ＋ 鍛造{stars.forge} ＝ 基礎威力 <strong>{stars.sword.forgedBaseDamage}</strong>。筋力・弱体・敵の脆弱を反映した選択中の敵への攻撃値は <strong>{stars.sword.damagePerHit}</strong>（ブロック軽減前）。</p><div className="resource-card-preview"><CardView card={stars.sword.card} state={state} inspect showUpgradePreview={false} /></div></>}</>}
      {state.classId === 'necromancer' && <><p>岩霊HP <strong>{summon.hp}</strong>。{summon.guardRule}</p><p>{summon.attackRule}</p><p>破滅は敵のターン開始時、毒の後に判定します。破滅が敵の残りHP以上なら撃破します。</p><ul>{enemies.map((enemy) => { const view = getEnemyResourceView(enemy); return <li key={enemy.instanceId ?? enemy.id}><strong>{enemy.name}</strong>：破滅 {view.doom} / 毒の後のHP {view.hpAfterPoison}{view.doomTriggers ? ' · 次の敵ターンに発動' : ''}</li>; })}</ul></>}
      {state.classId === 'machinist' && <><p>オーブ <strong>{orb.count}/{orb.capacity}</strong> · 集中力 <strong>{orb.focus}</strong>{orb.temporaryFocus !== 0 && `（一時 ${orb.temporaryFocus}）`}</p><p>オーブはスロットの順にターン終了時に自動発動します。解放は<strong>右端から</strong>。一時集中力も現在の発動値に含まれ、ターン終了処理で失われます。</p><ul>{orb.slots.map((slot) => <li key={slot.index}>スロット{slot.index + 1}：{slot.type === null ? '空き' : `${slot.type === 'lightning' ? '雷' : '霜'} · 自動${slot.passive} / 解放${slot.evoke}${slot.isNextEvoke ? ' · 次に解放' : ''}`}</li>)}</ul><p>雷はランダムな生存敵にダメージ、霜はブロックを得ます。表示値には集中力が反映されています。雷に筋力・弱体・脆弱は適用されません。</p></>}
    </ResourceDetails>}
  </>;
}

/** Stays next to ordinary energy; stars do not invent a second card cost. */
export function StarEnergyHud({ state }: { state: CombatState }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (state.classId !== 'oracle') return null;
  const view = getStarView(state);
  return <><button type="button" className="star-energy" data-resource-hud="stars" onClick={() => setOpen(true)} aria-label={`星 ${view.stars}、このターン獲得 ${view.gainedThisTurn}。星の詳細を表示`} title="星はカード効果で獲得。このターンに獲得した数を星参照カードが使います。消費しません。"><span className="star-energy-gem resource-motion"><span aria-hidden="true">✦</span><b>{view.stars}</b></span><span className="star-energy-label">星<small>今ターン <b>+{view.gainedThisTurn}</b></small></span></button>{open && <ResourceDetails title="星 · 法王の祈り" onClose={close}><p>所持星 <strong>{view.stars}</strong> · このターンの獲得星 <strong>{view.gainedThisTurn}</strong></p><p>星とエナジーは別の値です。星は消費しません。星参照カードは「このターンに得た星」を使います。</p>{view.burstCards.length > 0 && <ul>{view.burstCards.map((card, index) => <li key={`${card.cardUid}-${index}`}>{card.name}：基礎 {card.baseDamage}、選択中の敵へ {card.damagePerHit}ダメージ{view.gainedThisTurn === 0 && '（獲得0のため不発）'}</li>)}</ul>}<p>所持星と鍛造は戦闘中に蓄積し、「今ターン」の獲得数は次のターンにリセットされます。</p></ResourceDetails>}</>;
}

/** Forecasts enemy-start processing, never a guessed future attack sequence. */
export function EnemyResourceForecast({ state, enemy }: { state: CombatState; enemy: CombatState['enemy'] }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (enemy.hp <= 0 || (state.classId !== 'assassin' && state.classId !== 'necromancer')) return null;
  const view = getEnemyResourceView(enemy);
  return <><button type="button" className="enemy-resource-forecast" onClick={() => setOpen(true)} aria-label={`${enemy.name}の毒・破滅の予測の詳細を表示`}>
    {(view.poison > 0 || state.classId === 'assassin') && <span className="poison-forecast" title={`次の敵ターン開始時にブロックを無視して${view.poisonDamage}ダメージ。処理後の毒は${view.poisonAfterTick}。`}><span aria-hidden="true">☠</span> 毒 <b>{view.poison}</b><small>次に {view.poisonDamage}ダメージ</small></span>}
    {(view.doom > 0 || state.classId === 'necromancer') && <span className={`doom-forecast ${view.doomTriggers ? 'doom-ready' : ''}`} title={`敵ターン開始時、毒の後のHP ${view.hpAfterPoison}と破滅 ${view.doom}を比較。生存中の敵で破滅がHP以上なら撃破。`}><span aria-hidden="true">終</span> 破滅 <b>{view.doom}</b><small>{view.hpAfterPoison <= 0 ? '毒で撃破予定' : view.doomTriggers ? '次の敵ターンに発動' : `発動条件：破滅 ≥ HP${view.hpAfterPoison}`}</small></span>}
  </button>{open && <ResourceDetails title={`${enemy.name} · 毒と破滅`} onClose={close}>
    <p>現在HP <strong>{enemy.hp}</strong> · 毒 <strong>{view.poison}</strong> · 破滅 <strong>{view.doom}</strong></p>
    <dl><div><dt>毒の処理</dt><dd>次の敵ターン開始時、ブロックを無視して{view.poisonDamage}ダメージ。処理後の毒は{view.poisonAfterTick}、HPは{view.hpAfterPoison}になります。</dd></div><div><dt>破滅の判定</dt><dd>{view.hpAfterPoison <= 0 ? '先に毒で撃破されるため、破滅の判定は行いません。' : view.doomTriggers ? `毒の後のHP ${view.hpAfterPoison}以下なので、次の敵ターン開始時に破滅が発動して撃破します。` : `毒の後に生存している敵のHP以上に破滅が蓄積すると発動します。現在は破滅 ${view.doom} / 毒の後のHP ${view.hpAfterPoison}です。`}</dd></div></dl>
    <p>現在の状態による予測です。カード使用などでHPや状態が変わると、表示も更新されます。</p>
  </ResourceDetails>}</>;
}

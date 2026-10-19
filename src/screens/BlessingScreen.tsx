import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { CardInstance, GameSettings } from '../types/game';
import type { RunAction, RunState } from '../types/run';
import { BLESSING_CHARACTERS } from '../data/blessings';
import { CARD_DEFINITIONS } from '../data/cards';
import { RELIC_DEFINITIONS } from '../data/relics';
import { getBlessingOptionDisabledReason, getBlessingTargetCards, isBlessingOptionAvailable } from '../engine/blessings';
import { getCardAcquisitionCategory } from '../engine/cardAcquisition';
import { CardView } from '../components/CardView';
import { CardUpgradePreview } from '../components/CardUpgradePreview';
import { BlessingCharacterArt } from '../components/BlessingCharacterArt';
import { Icon } from '../components/Icon';
import '../styles/blessings.css';

type Encounter = NonNullable<RunState['blessing']>;
type Option = Encounter['options'][number];
type Cost = Option['costs'][number];
type Reward = Option['rewards'][number];
type ReceiptEffect = 'gold' | 'life' | 'cards' | 'relic' | 'upgrade' | 'transform' | 'remove' | 'cost';
const effectGlyphs: Record<ReceiptEffect, string> = { gold: '◎', life: '+', cards: '▱', relic: '✧', upgrade: '↑', transform: '◇', remove: '·', cost: '◆' };

/** Visual categories use the applied receipt, never a second reward calculation. */
function receiptEffects(receipt: NonNullable<Encounter['receipt']>): ReceiptEffect[] {
  const effects: ReceiptEffect[] = [];
  if (receipt.goldChange > 0) effects.push('gold');
  if (receipt.hpChange > 0 || receipt.maxHpChange > 0) effects.push('life');
  if (receipt.addedCards.some((card) => !CARD_DEFINITIONS[card.cardId]?.curse)) effects.push('cards');
  if (receipt.relicIds.length) effects.push('relic');
  if (receipt.upgradedCards.length) effects.push('upgrade');
  if (receipt.transformedCards.length) effects.push('transform');
  if (receipt.removedCards.length) effects.push('remove');
  if (receipt.hpChange < 0 || receipt.maxHpChange < 0 || receipt.goldChange < 0 || receipt.addedCards.some((card) => CARD_DEFINITIONS[card.cardId]?.curse)) effects.push('cost');
  return effects;
}

function cardName(cardId: string) {
  return CARD_DEFINITIONS[cardId]?.name ?? cardId;
}

function costText(cost: Cost) {
  if (cost.kind === 'curse') return `呪い「${cardName(cost.cardId)}」を${cost.amount}枚受け取る`;
  if (cost.kind === 'hp') return `HPを${cost.amount}失う`;
  if (cost.kind === 'maxHp') return `最大HP −${cost.amount}`;
  return `${cost.amount}Gを支払う`;
}

function rewardText(reward: Reward) {
  switch (reward.kind) {
    case 'maxHp': return `最大HP +${reward.amount}`;
    case 'heal': return `HPを${reward.amount}回復（最大HPまで）`;
    case 'gold': return `${reward.amount}Gを獲得`;
    case 'cards': return reward.cardIds.map(cardName).join('・');
    case 'relic': return RELIC_DEFINITIONS[reward.relicId]?.name ?? reward.relicId;
    case 'remove': return `カード${reward.amount}枚をデッキから削除`;
    case 'upgrade': return `カード${reward.amount}枚を強化`;
    case 'transform': return `カード${reward.amount}枚を変化`;
  }
}

function BlessingCard({ card }: { card: CardInstance }) {
  const definition = CARD_DEFINITIONS[card.cardId];
  const limited = !!definition && getCardAcquisitionCategory(definition) === 'blessingOnly';
  return <div className={`blessing-card-preview${limited ? ' blessing-card-limited' : ''}`} data-acquisition={limited ? 'blessingOnly' : undefined}>
    {limited && <span className="blessing-limited-label"><Icon name="sun" size={14} />祝福限定</span>}
    <CardView card={card} inspect showUpgradePreview={false} />
  </div>;
}

function RelicPreview({ relicId }: { relicId: string }) {
  const relic = RELIC_DEFINITIONS[relicId];
  if (!relic) return null;
  return <article className="blessing-relic-preview"><span aria-hidden="true">{relic.glyph}</span><div><small>レリック</small><h3>{relic.name}</h3><p>{relic.description}</p></div></article>;
}

/** The engine persists every choice. This screen only previews and confirms it. */
export function BlessingScreen({ state, onAction, settings = { speed: 'normal', reducedMotion: false } }: {
  state: RunState;
  onAction: (action: RunAction) => void;
  settings?: GameSettings;
}) {
  const blessing = state.blessing;
  const noMotion = settings.reducedMotion || settings.speed === 'instant';
  const [skipReveal, setSkipReveal] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const receiptHeading = useRef<HTMLHeadingElement>(null);
  const selected = blessing?.options.find((option) => option.id === blessing.selectedOptionId);
  const result = blessing?.stage === 'result';
  const receipt = blessing?.receipt;
  const skip = useCallback(() => { setSkipReveal(true); setRevealing(false); }, []);
  useEffect(() => {
    if (!selected || result) return;
    detailHeading.current?.focus({ preventScroll: true });
    detailHeading.current?.scrollIntoView({ block: 'start', behavior: noMotion ? 'auto' : 'smooth' });
  }, [selected?.id, result, noMotion]);
  useEffect(() => {
    if (!receipt || !result) return;
    receiptHeading.current?.focus({ preventScroll: true });
    receiptHeading.current?.closest('.blessing-receipt')?.scrollIntoView({ block: 'start', behavior: noMotion ? 'auto' : 'smooth' });
    setSkipReveal(false);
    if (noMotion) { setRevealing(false); return; }
    setRevealing(true);
    const timeout = window.setTimeout(() => setRevealing(false), settings.speed === 'fast' ? 550 : 1100);
    return () => window.clearTimeout(timeout);
  }, [receipt?.encounterId, receipt?.optionId, result, noMotion, settings.speed]);
  if (!blessing) return null;
  const character = BLESSING_CHARACTERS[blessing.characterId];
  const dialogue = character.dialogues[blessing.dialogueIndex] ?? character.greeting;
  const candidates = result ? [] : getBlessingTargetCards(state);
  const selectedTargets = state.deck.filter((card) => blessing.selectedCardUids.includes(card.uid));
  const targetReady = !selected?.target || blessing.selectedCardUids.length === selected.target.count;
  const available = !!selected && isBlessingOptionAvailable(state, selected);
  const disabledReason = selected ? getBlessingOptionDisabledReason(state, selected) : null;
  const chooseTarget = (uid: string) => {
    if (!selected?.target || result) return;
    const chosen = blessing.selectedCardUids;
    const next = chosen.includes(uid) ? chosen.filter((id) => id !== uid)
      : selected.target.count === 1 ? [uid] : chosen.length < selected.target.count ? [...chosen, uid] : chosen;
    onAction({ type: 'selectBlessingTargets', cardUids: next });
  };

  return <div className={`blessing-screen blessing-theme-${blessing.characterId}${noMotion || skipReveal ? ' motion-reduced' : ''}${settings.speed === 'fast' ? ' blessing-fast' : ''}${result ? ' blessing-resolved' : ''}${revealing && !skipReveal ? ' is-revealing' : ''}`} data-blessing-stage={blessing.stage} data-blessing-character={blessing.characterId} data-blessing-background={character.backgroundTheme} data-blessing-effect={character.effectTheme}>
    <header className="blessing-heading"><p className="eyebrow"><span className="gold-line" />ACT {blessing.act} · 塔の入口</p><h1>最初の一歩に、祝福を。</h1><p>{result ? '選んだ教えが、岩に刻まれた。' : '四つの祝福から一つを選び、受け取る内容を確認してください。'}</p>{!result && !noMotion && !skipReveal && <button type="button" className="blessing-intro-skip" onClick={skip}>祝福演出をスキップ <span aria-hidden="true">»</span></button>}</header>
    <section className="blessing-sanctuary" aria-label={`${character.name}の祭壇`}>
      <div className="blessing-scene-runes" aria-hidden="true"><span>じ</span><span>静</span><span>と</span></div>
      <div className="blessing-character-frame"><BlessingCharacterArt characterId={character.artId} reducedMotion={noMotion} /></div>
      <div className="blessing-altar" aria-hidden="true"><span>じっと教</span></div>
      <div className="blessing-character-copy"><p>{character.title}</p><h2>{character.name}</h2><blockquote>「{dialogue}」</blockquote><small>{character.description}</small></div>
    </section>
    <section className="blessing-offers" aria-label="四つの祝福">
      {blessing.options.map((option, index) => {
        const chosen = selected?.id === option.id;
        const canChoose = !result && isBlessingOptionAvailable(state, option);
        const reason = getBlessingOptionDisabledReason(state, option);
        return <article key={option.id} className={`blessing-offer${chosen ? ' is-selected' : ''}${option.risk === 'risky' ? ' has-price' : ''}`} data-blessing-option={option.id} data-selected={chosen} style={{ '--blessing-index': index } as CSSProperties}>
          <div className="blessing-offer-kicker"><span>{String(index + 1).padStart(2, '0')} · BLESSING</span><b>{chosen ? result ? '受領済み' : '選択中' : option.risk === 'risky' ? '代償あり' : '代償なし'}</b></div>
          <h2>{option.title}</h2><p className="blessing-offer-description">{option.description}</p>
          <div className="blessing-offer-benefit"><span>受け取る祝福</span><ul>{option.rewards.map((reward, number) => <li key={number}>{rewardText(reward)}</li>)}</ul></div>
          <div className={`blessing-offer-price${option.costs.length ? '' : ' is-free'}`}><span>代償</span>{option.costs.length ? <ul>{option.costs.map((cost, number) => <li key={number}>{costText(cost)}</li>)}</ul> : <p>なし</p>}</div>
          {reason && !result && <p className="blessing-disabled-reason">{reason}</p>}
          <button type="button" className={chosen ? 'primary-button' : 'secondary-button'} disabled={!canChoose} aria-pressed={chosen} onClick={() => { if (chosen) { detailHeading.current?.focus({ preventScroll: true }); detailHeading.current?.scrollIntoView({ block: 'start', behavior: noMotion ? 'auto' : 'smooth' }); } else onAction({ type: 'chooseBlessing', optionId: option.id }); }}>{result ? chosen ? 'この祝福を受け取った' : '選ばなかった祝福' : chosen ? '選択中 · 内容を確認' : 'この祝福の内容を確認'}<Icon name={chosen ? 'sun' : 'chevron'} size={16} /></button>
        </article>;
      })}
    </section>

    {!result && selected && <section className="blessing-confirm-panel" aria-label="祝福の確認">
      <header><p className="eyebrow">CONFIRM YOUR BLESSING</p><h2 ref={detailHeading} tabIndex={-1}>{selected.title}</h2><p>選んだ祝福と対象カードは保存されます。下の「祝福を確定して受け取る」を押すまで、代償も報酬も発生しません。</p></header>
      <div className="blessing-confirm-summary"><div><h3>受け取るもの</h3><ul>{selected.rewards.map((reward, index) => <li key={index}>{rewardText(reward)}</li>)}</ul></div><div><h3>支払う代償</h3>{selected.costs.length ? <ul>{selected.costs.map((cost, index) => <li key={index}>{costText(cost)}</li>)}</ul> : <p>なし</p>}</div></div>
      <div className="blessing-reward-previews">{selected.rewards.flatMap((reward) => reward.kind === 'cards' ? reward.cardIds.map((cardId, index) => <BlessingCard key={`${cardId}-${index}`} card={{ uid: `blessing-preview-${cardId}-${index}`, cardId, upgraded: false }} />) : reward.kind === 'relic' ? [<RelicPreview key={reward.relicId} relicId={reward.relicId} />] : [])}</div>
      {selected.costs.filter((cost): cost is Extract<Cost, { kind: 'curse' }> => cost.kind === 'curse').map((cost, index) => <details className="blessing-curse-detail" key={index}><summary>代償の呪い「{cardName(cost.cardId)}」の効果を見る</summary><BlessingCard card={{ uid: `blessing-curse-${index}`, cardId: cost.cardId, upgraded: false }} /></details>)}
      {selected.target && <div className="blessing-targets"><div className="blessing-target-heading"><h3>{selected.target.kind === 'remove' ? 'デッキから削除するカード' : selected.target.kind === 'upgrade' ? '強化するカード' : '変化させるカード'}を選択</h3><b>選択 {blessing.selectedCardUids.length} / {selected.target.count}枚</b></div><p>{selected.target.kind === 'upgrade' ? '強化済みのカードは候補に含まれません。選択後に強化前後の効果を確認できます。' : selected.target.kind === 'transform' ? '変化先は今回の祝福で固定されています。表示を確認してから確定できます。' : '選んだカードだけをデッキから削除します。'}</p>
        <div className="blessing-target-grid">{candidates.map((card) => { const chosen = blessing.selectedCardUids.includes(card.uid); return <article key={card.uid} className={`blessing-target-card${chosen ? ' is-selected' : ''}`} data-blessing-target={card.uid}><BlessingCard card={card} /><button type="button" className="secondary-button" aria-pressed={chosen} disabled={!chosen && selected.target!.count > 1 && blessing.selectedCardUids.length >= selected.target!.count} onClick={() => chooseTarget(card.uid)}>{chosen ? '✓ 選択中 · 解除する' : 'このカードを対象にする'}</button></article>; })}</div>
        {selectedTargets.length > 0 && <div className="blessing-selected-previews"><h3>確定する内容</h3><div>{selectedTargets.map((card) => selected.target!.kind === 'upgrade' ? <CardUpgradePreview key={card.uid} card={card} /> : selected.target!.kind === 'transform' && selected.target!.replacements?.[card.uid] ? <div className="blessing-transform-preview" key={card.uid}><div><span>変化前</span><BlessingCard card={card} /></div><span className="blessing-transform-arrow" aria-hidden="true">→</span><div><span>変化後</span><BlessingCard card={{ ...card, cardId: selected.target!.replacements[card.uid], upgraded: false }} /></div></div> : <div key={card.uid}><p className="blessing-removal-note">このカードを削除します</p><BlessingCard card={card} /></div>)}</div></div>}
      </div>}
      <div className="blessing-confirm-actions"><p>{disabledReason ?? (targetReady ? '内容を確認したら、祝福を受け取りましょう。' : `対象を${selected.target?.count}枚選んでください。`)}</p><button type="button" className="primary-button" disabled={!available || !targetReady} onClick={() => onAction({ type: 'confirmBlessing' })}>祝福を確定して受け取る<Icon name="sun" size={18} /></button></div>
    </section>}

    {result && receipt && <section className="blessing-receipt" aria-label="受け取った祝福" data-blessing-receipt={receipt.encounterId}>
      <div className="blessing-acquisition-light" aria-hidden="true" />
      <div className="blessing-type-effects" aria-hidden="true">{receiptEffects(receipt).map((kind) => <div className={`blessing-fx blessing-fx-${kind}`} data-blessing-fx={kind} key={kind}>{Array.from({ length: kind === 'gold' ? 9 : 6 }, (_, index) => <span key={index} className="blessing-fx-particle" style={{ '--particle-index': index, '--particle-x': `${(index - (kind === 'gold' ? 4 : 2.5)) * 30}px`, '--particle-turn': `${index * 61}deg` } as CSSProperties}>{effectGlyphs[kind]}</span>)}</div>)}</div>
      <header><div className="blessing-receipt-kicker"><p className="eyebrow">BLESSING RECEIVED</p>{revealing && !noMotion && !skipReveal && <button type="button" className="blessing-intro-skip" onClick={skip}>受領演出をスキップ</button>}</div><h2 ref={receiptHeading} tabIndex={-1}>{receipt.title}</h2><p>{receipt.description}</p></header>
      <div className="blessing-selected-gift" data-blessing-gift={receipt.optionId}><span className="blessing-gift-emblem" aria-hidden="true">{character.glyph}</span><span>選んだ教えが、旅の力に。</span><p>{selected?.rewards.map(rewardText).join(' · ')}</p></div>
      <div className="blessing-receipt-deltas">{receipt.hpChange !== 0 && <span className={receipt.hpChange > 0 ? 'is-gain' : 'is-loss'}>HP {receipt.hpChange > 0 ? '+' : ''}{receipt.hpChange}</span>}{receipt.maxHpChange !== 0 && <span className={receipt.maxHpChange > 0 ? 'is-gain' : 'is-loss'}>最大HP {receipt.maxHpChange > 0 ? '+' : ''}{receipt.maxHpChange}</span>}{receipt.goldChange !== 0 && <span className={receipt.goldChange > 0 ? 'is-gain' : 'is-loss'}>ゴールド {receipt.goldChange > 0 ? '+' : ''}{receipt.goldChange}G</span>}</div>
      {receipt.relicIds.length > 0 && <div className="blessing-reward-previews">{receipt.relicIds.map((id) => <RelicPreview key={id} relicId={id} />)}</div>}
      {receipt.addedCards.length > 0 && <div className="blessing-receipt-cards"><h3>デッキに加わったカード</h3><div>{receipt.addedCards.map((card) => <BlessingCard key={card.uid} card={card} />)}</div></div>}
      {receipt.upgradedCards.length > 0 && <div className="blessing-receipt-cards"><h3>強化したカード</h3><div>{receipt.upgradedCards.map((card) => <BlessingCard key={card.uid} card={card} />)}</div></div>}
      {receipt.removedCards.length > 0 && <div className="blessing-receipt-cards"><h3>デッキから削除したカード</h3><div>{receipt.removedCards.map((card) => <BlessingCard key={card.uid} card={card} />)}</div></div>}
      {receipt.transformedCards.length > 0 && <div className="blessing-receipt-cards"><h3>変化したカード</h3><div>{receipt.transformedCards.map(({ before, after }) => <div className="blessing-transform-preview" key={before.uid}><div><span>変化前</span><BlessingCard card={before} /></div><span className="blessing-transform-arrow" aria-hidden="true">→</span><div><span>変化後</span><BlessingCard card={after} /></div></div>)}</div></div>}
      <div className="blessing-receipt-actions"><button type="button" className="primary-button" onClick={(event) => { if (event.detail <= 1) onAction({ type: 'continueBlessing' }); }}>祝福を胸に、塔を登る<Icon name="arrow" size={18} /></button></div>
      <p className="blessing-saved-note">祝福は受領済みです。再読み込みしても、代償や報酬を繰り返し適用しません。</p>
    </section>}
  </div>;
}

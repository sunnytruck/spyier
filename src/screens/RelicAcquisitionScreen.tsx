import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardInstance, GameSettings } from '../types/game';
import type { RunAction, RunState } from '../types/run';
import { RELIC_DEFINITIONS } from '../data/relics';
import { reduceRelicAcquisition } from '../engine/relicAcquisition';
import { CardView } from '../components/CardView';
import { CardUpgradePreview } from '../components/CardUpgradePreview';
import { RelicIcon } from '../components/RelicIcon';
import { Icon } from '../components/Icon';
import '../styles/relic-acquisition.css';

const sourceLabels = { reward: '塔の宝物', shop: '岩の商人', event: '塔での出会い', blessing: 'Actの祝福' };
const kindLabels = { remove: '削除する', upgrade: '強化する', transform: '変化させる', copy: '複製する', chooseCard: '受け取る' };

function CardFace({ card }: { card: CardInstance }) {
  return <CardView card={card} inspect showUpgradePreview={false} />;
}

/** All offers, targets, results and partial selection come from the saved reducer state. */
export function RelicAcquisitionScreen({ state, onAction, settings = { speed: 'normal', reducedMotion: false } }: {
  state: RunState;
  onAction: (action: RunAction) => void;
  settings?: GameSettings;
}) {
  const acquisition = state.relicAcquisition;
  const heading = useRef<HTMLHeadingElement>(null);
  const [skip, setSkip] = useState(false);
  const noMotion = settings.reducedMotion || settings.speed === 'instant' || skip;
  const result = acquisition?.stage === 'result';
  useEffect(() => {
    if (result) heading.current?.focus({ preventScroll: true });
  }, [result]);
  // This pure, immutable reducer preview uses exactly the acquisition implementation.
  // Nothing is dispatched or saved, and the live RNG and deck are never changed here.
  const preview = useMemo(() => acquisition?.stage === 'select'
    ? reduceRelicAcquisition(state, { type: 'confirmRelicAcquisition' }).relicAcquisition?.receipt
    : null, [state, acquisition?.stage]);
  if (!acquisition) return null;
  const relic = RELIC_DEFINITIONS[acquisition.relicId];
  if (!relic) return null;
  const isOffer = acquisition.kind === 'chooseCard';
  const selected = isOffer ? acquisition.selectedCardIds : acquisition.selectedCardUids;
  const candidates = isOffer ? acquisition.offeredCardIds.map((cardId, index) => ({ uid: `relic-offer-${index}`, cardId, upgraded: false }))
    : state.deck.filter((card) => acquisition.eligibleCardUids.includes(card.uid));
  const selectedCards = candidates.filter((card) => selected.includes(isOffer ? card.cardId : card.uid));
  const countReady = selected.length >= acquisition.minCount && selected.length <= acquisition.count;
  const choose = (card: CardInstance) => {
    const id = isOffer ? card.cardId : card.uid;
    const next = selected.includes(id) ? selected.filter((value) => value !== id)
      : acquisition.count === 1 ? [id] : selected.length < acquisition.count ? [...selected, id] : selected;
    onAction(isOffer ? { type: 'selectRelicCards', cardIds: next } : { type: 'selectRelicCards', cardUids: next });
  };
  const receipt = acquisition.receipt;
  const confirmLabel = acquisition.kind ? `${kindLabels[acquisition.kind]}内容を確定する` : '内容を確定する';
  const offerPreview = (card: CardInstance): CardInstance => {
    if (!isOffer || acquisition.count !== 1) return card;
    const chosen = reduceRelicAcquisition(state, { type: 'selectRelicCards', cardIds: [card.cardId] });
    const projected = reduceRelicAcquisition(chosen, { type: 'confirmRelicAcquisition' });
    return projected.relicAcquisition?.receipt?.addedCards.find((added) => added.cardId === card.cardId) ?? card;
  };
  return <div className={`relic-acquisition-screen${result ? ' is-result' : ''}${noMotion ? ' motion-reduced' : ''}${settings.speed === 'fast' ? ' is-fast' : ''}`}
    data-relic-acquisition-stage={acquisition.stage} data-relic-acquisition-kind={acquisition.kind ?? 'immediate'}>
    <header className="run-screen-heading"><div><p className="eyebrow"><span className="gold-line" />RELIC · {sourceLabels[acquisition.source]}</p><h1>{result ? '岩に宿る力を、手に。' : 'レリックが求める、ひとつの選択。'}</h1><p className="run-heading-description">{result ? '獲得した効果は保存されました。' : 'カードを選び、内容を確認してから確定してください。選択途中でも再開できます。'}</p></div></header>
    <section className="relic-acquisition-altar" aria-label={`${relic.name}の獲得`}>
      <div className="relic-acquisition-rays" aria-hidden="true" />
      <RelicIcon id={relic.id} size={100} acquired={result && !noMotion} />
      <div><p className="section-kicker">{result ? 'RELIC ACQUIRED' : 'RELIC DISCOVERED'}</p><h2 ref={heading} tabIndex={-1}>{relic.name}</h2><p>{relic.description}</p></div>
      {result && !noMotion && <button type="button" className="text-button" onClick={() => setSkip(true)}>獲得演出をスキップ <span aria-hidden="true">»</span></button>}
    </section>

    {!result && acquisition.kind && <section className="relic-acquisition-selection" aria-label="レリックの対象選択">
      <header><div><h2>{kindLabels[acquisition.kind]}カードを選択</h2><p>{acquisition.minCount === acquisition.count ? `${acquisition.count}枚選択してください。` : `${acquisition.minCount}〜${acquisition.count}枚選択できます。`}{acquisition.kind === 'transform' ? ' 変化先は獲得時に決定済みです。' : acquisition.kind === 'upgrade' ? ' 強化済みカードは候補から除外しています。' : ''}</p></div><b aria-live="polite">選択 {selected.length} / {acquisition.count}枚</b></header>
      <div className="relic-acquisition-card-grid">{candidates.map((card) => {
        const chosen = selected.includes(isOffer ? card.cardId : card.uid);
        return <article className={`relic-acquisition-card${chosen ? ' is-selected' : ''}`} key={card.uid} data-relic-target={isOffer ? card.cardId : card.uid}>
          <CardFace card={offerPreview(card)} />
          <button type="button" className="secondary-button" aria-pressed={chosen} disabled={!chosen && acquisition.count > 1 && selected.length >= acquisition.count} onClick={() => choose(card)}>{chosen ? '選択中 · 解除する' : 'このカードを選ぶ'}<Icon name={chosen ? 'sun' : 'chevron'} size={15} /></button>
        </article>;
      })}</div>
      {selectedCards.length > 0 && <div className="relic-acquisition-confirm-preview"><h3>確定する内容</h3><div>{selectedCards.map((card) => {
        if (acquisition.kind === 'upgrade') return <CardUpgradePreview key={card.uid} card={card} />;
        const after = acquisition.kind === 'transform' ? preview?.addedCards.find((entry) => entry.cardId === acquisition.replacements[card.uid]) : undefined;
        if (acquisition.kind === 'transform' && after) return <div className="relic-transform-preview" key={card.uid}><div><span>変化前</span><CardFace card={card} /></div><span aria-hidden="true">→</span><div><span>変化後</span><CardFace card={after} /></div></div>;
        const awarded = preview?.addedCards.find((entry) => entry.cardId === card.cardId);
        return <div className="relic-selected-card" key={card.uid}><p>{acquisition.kind === 'remove' ? 'デッキから削除します' : acquisition.kind === 'copy' ? '複製されるカード' : 'デッキに加わります'}</p><CardFace card={(acquisition.kind === 'copy' || isOffer) && awarded ? awarded : card} /></div>;
      })}</div></div>}
      {preview && <p className="relic-acquisition-summary" role="status">{preview.description}</p>}
      <div className="relic-acquisition-actions"><p>確認中のプレビューでは、デッキや報酬は変わりません。確定後のキャンセル・再抽選はできません。</p><button type="button" className="primary-button" disabled={!countReady} onClick={(event) => { if (event.detail <= 1) onAction({ type: 'confirmRelicAcquisition' }); }}>{confirmLabel}<Icon name="sun" size={17} /></button></div>
    </section>}

    {result && receipt && <section className="relic-acquisition-receipt" aria-label="レリック獲得結果" data-relic-receipt={acquisition.acquisitionKey}>
      <h2>受け取った力</h2><p>{receipt.description}</p>
      <div className="relic-acquisition-deltas">{receipt.hpChange !== 0 && <span className={receipt.hpChange > 0 ? 'is-gain' : 'is-loss'}>HP {receipt.hpChange > 0 ? '+' : ''}{receipt.hpChange}</span>}{receipt.maxHpChange !== 0 && <span className={receipt.maxHpChange > 0 ? 'is-gain' : 'is-loss'}>最大HP {receipt.maxHpChange > 0 ? '+' : ''}{receipt.maxHpChange}</span>}{receipt.goldChange !== 0 && <span className={receipt.goldChange > 0 ? 'is-gain' : 'is-loss'}>ゴールド {receipt.goldChange > 0 ? '+' : ''}{receipt.goldChange}G</span>}</div>
      {receipt.replacedRelicIds.length > 0 && <div className="relic-starter-replacement"><h3>初期レリックの強化</h3>{receipt.replacedRelicIds.map((id) => <p key={id}><RelicIcon id={id} size={34} /><span>{RELIC_DEFINITIONS[id]?.name} を強化版へ交換しました。通常版の効果は重複しません。</span></p>)}</div>}
      {([['デッキに加わったカード', receipt.addedCards], ['強化したカード', receipt.upgradedCards], ['デッキから削除したカード', receipt.removedCards]] as const).filter(([, cards]) => cards.length > 0).map(([title, cards]) => <div className="relic-receipt-cards" key={title}><h3>{title}</h3><div>{cards.map((card) => <CardFace card={card} key={card.uid} />)}</div></div>)}
      <div className="relic-acquisition-actions"><p>効果は反映済みです。再読み込みや保存からの再開で、もう一度適用されることはありません。</p><button type="button" className="primary-button" onClick={(event) => { if (event.detail <= 1) onAction({ type: 'continueRelicAcquisition' }); }}>受け取った力とともに進む<Icon name="arrow" size={18} /></button></div>
    </section>}
  </div>;
}

import { useMemo, useState } from 'react';
import sourceCatalog from '../data/sourceCards.generated.json';
import { CARD_DEFINITIONS } from '../data/cards';
import { CLASS_DEFINITIONS, CLASS_IDS } from '../data/classes';
import type { SourceCardCatalog } from '../types/catalog';
import { CardView } from './CardView';

const sourceCards = (sourceCatalog as SourceCardCatalog).cards;
const pageSize = 30;

export function CardLibrary() {
  const [tab, setTab] = useState<'playable' | 'reference'>('playable');
  const [query, setQuery] = useState('');
  const [owner, setOwner] = useState('all');
  const [shown, setShown] = useState(pageSize);
  const cards = Object.values(CARD_DEFINITIONS);
  const collectibleCount = cards.filter((card) => !card.tokenOnly).length;
  const implemented = useMemo(() => new Set(Object.values(CARD_DEFINITIONS).flatMap((card) => card.sourceCardId ? [card.sourceCardId] : [])), []);
  const generatedSources = useMemo(() => new Set(Object.values(CARD_DEFINITIONS).flatMap((card) => card.tokenOnly && card.sourceCardId ? [card.sourceCardId] : [])), []);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredPlayable = cards.filter((card) => (owner === 'all' || (card.classId ?? 'legacy') === owner) &&
    `${card.name} ${card.description} ${card.upgradedDescription}`.toLocaleLowerCase().includes(normalizedQuery));
  const filteredReferences = sourceCards.filter((card) => (owner === 'all' || card.sourceClass === owner) &&
    `${card.sourceName} ${card.normal.effectRaw} ${card.upgraded.effectRaw}`.toLocaleLowerCase().includes(normalizedQuery));
  const sourceClassName = (id: string) => id === 'colorless' ? '無色・共通' : CLASS_IDS.includes(id as typeof CLASS_IDS[number]) ? CLASS_DEFINITIONS[id as typeof CLASS_IDS[number]].displayName : 'じっと教・既存';
  function resetPage() { setShown(pageSize); }
  return <div className="card-library-content">
    <p className="modal-intro">資料 {sourceCards.length}枚を収録。取得できるカード {collectibleCount}種類と生成専用 {cards.length - collectibleCount}種類。資料と接続済み {implemented.size}種類。未実装カードは報酬・商人に出現しません。</p>
    <div className="library-controls">
      <div className="segmented-control" aria-label="図鑑の表示内容">
        <button aria-pressed={tab === 'playable'} className={tab === 'playable' ? 'active' : ''} onClick={() => { setTab('playable'); resetPage(); }}>使用可能なカード</button>
        <button aria-pressed={tab === 'reference'} className={tab === 'reference' ? 'active' : ''} onClick={() => { setTab('reference'); resetPage(); }}>参考資料・実装状況</button>
      </div>
      <label>職業<select value={owner} onChange={(event) => { setOwner(event.target.value); resetPage(); }}><option value="all">すべて</option>{CLASS_IDS.map((id) => <option value={id} key={id}>{CLASS_DEFINITIONS[id].displayName}</option>)}<option value="colorless">無色・共通</option><option value="legacy">じっと教・既存</option></select></label>
      <label className="library-search">検索<input value={query} onChange={(event) => { setQuery(event.target.value); resetPage(); }} placeholder="カード名・効果で検索" type="search" /></label>
    </div>
    <p className="library-result-count" role="status">{tab === 'playable' ? filteredPlayable.length : filteredReferences.length}件</p>
    {tab === 'playable' ? <div className="card-library">
      {filteredPlayable.slice(0, shown).map((definition) => <div className="library-entry" key={definition.id}>
        <CardView card={{ uid: `library-${definition.id}`, cardId: definition.id, upgraded: false }} inspect />
        <p>{definition.flavor}</p>
      </div>)}
    </div> : <div className="reference-card-list">
      {filteredReferences.slice(0, shown).map((card) => {
        const playable = implemented.has(card.id);
        const generatedOnly = generatedSources.has(card.id);
        const status = generatedOnly ? '生成専用・使用可能' : playable ? '使用可能' : card.status === 'needs_review' ? '仕様確認が必要' : '未実装';
        return <article className="reference-card" key={card.id}>
          <div className="reference-card-heading"><h3>{card.sourceName}</h3><span className={`reference-status ${playable ? 'is-playable' : ''}`}>{status}</span></div>
          <p className="reference-owner">{sourceClassName(card.sourceClass)}</p>
          <dl><div><dt>通常 · コスト {card.normal.costRaw}</dt><dd>{card.normal.effectRaw}</dd></div><div><dt>強化 · コスト {card.upgraded.costRaw}</dt><dd>{card.upgraded.effectRaw}</dd></div></dl>
          {!playable && <p className="reference-unavailable">取得不可 · {card.status === 'needs_review' ? '原文の不足・曖昧な記述の確認が必要です。' : '効果処理と検証が完了するまで出現しません。'}</p>}
          {generatedOnly && <p className="reference-owner">カード効果で生成。通常の報酬・商人には出現しません。</p>}
          {card.issues.length > 0 && <details><summary>資料の確認事項 {card.issues.length}件</summary><ul>{card.issues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul></details>}
          <small>出典: {card.sourceFile} {card.sourceLine}行目 · 種別・レアリティは資料に記載なし</small>
        </article>;
      })}
    </div>}
    {shown < (tab === 'playable' ? filteredPlayable.length : filteredReferences.length) && <button className="secondary-button library-more" onClick={() => setShown((count) => count + pageSize)}>さらに{pageSize}件を表示</button>}
    {(tab === 'playable' ? filteredPlayable.length : filteredReferences.length) === 0 && <p className="run-empty-message">該当するカードがありません。</p>}
  </div>;
}

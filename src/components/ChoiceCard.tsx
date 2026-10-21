import { useEffect, useMemo, useState } from 'react';
import type { CardInstance, CombatState } from '../types/game';
import { CARD_DEFINITIONS } from '../data/cards';
import { CLASS_DEFINITIONS } from '../data/classes';
import { getCardCost } from '../engine';
import { getCardAcquisitionCategory } from '../engine/cardAcquisition';
import { diffCardText, getCardPresentation, getCardUpgradePreview } from '../presentation/cardUpgrade';
import { getCardRuntimeInfo } from '../presentation/cardRuntime';
import { Icon } from './Icon';
import '../styles/card-choices.css';

/** Readable selection/inspection face. Combat hands and card flights keep CardView. */
export function ChoiceCard({ card, state, selected = false, disabled = false, onSelect, selectionLabel = '選択する',
  showUpgradePreview = true, highlightUpgradeChanges = false, className = '' }: {
  card: CardInstance;
  state?: CombatState;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  selectionLabel?: string;
  showUpgradePreview?: boolean;
  highlightUpgradeChanges?: boolean;
  className?: string;
}) {
  const [showAfter, setShowAfter] = useState(false);
  useEffect(() => setShowAfter(false), [card.uid, card.cardId, card.upgraded]);
  const definition = CARD_DEFINITIONS[card.cardId];
  const canToggle = !!definition && showUpgradePreview && !card.upgraded && !definition.unupgradable;
  const shown = canToggle && showAfter ? { ...card, upgraded: true } : card;
  const presentation = getCardPresentation(shown);
  const preview = getCardUpgradePreview(card);
  const runtime = useMemo(() => getCardRuntimeInfo(shown, state), [card.uid, card.cardId, shown.upgraded, state]);
  if (!definition || !presentation || !preview) return null;
  const highlight = highlightUpgradeChanges || canToggle && showAfter;
  const comparison = shown.upgraded ? preview.before : preview.after;
  const difference = (value: string, before: string) => highlight
    ? diffCardText(before, value).map((part, index) => part.changed ? <mark className={`choice-card-change${shown.upgraded ? '' : ' is-before'}`} key={index}>{part.text}</mark> : part.text) : value;
  const cost = definition.unplayable ? '—' : definition.xCost ? 'X' : getCardCost(shown, state);
  const category = getCardAcquisitionCategory(definition);
  const owner = definition.classId && definition.classId !== 'colorless' ? CLASS_DEFINITIONS[definition.classId].displayName : definition.classId === 'colorless' ? '無色' : 'じっと教';
  const type = definition.type === 'attack' ? '攻撃' : definition.type === 'power' ? 'パワー' : 'スキル';
  const rarity = definition.rarity === 'rare' ? 'レア' : definition.rarity === 'uncommon' ? 'アンコモン' : 'コモン';
  const temporary = shown.upgraded && state?.temporaryUpgrades?.includes(card.uid);
  const content = <>
    <span className="choice-card-heading"><span className={`choice-card-cost${highlight && preview.changes.cost ? ' is-changed' : ''}`} title={definition.xCost ? 'X：残りのエナジー' : `コスト ${cost}`}>{cost}</span><span className="choice-card-name" role="heading" aria-level={3}>{difference(presentation.name, comparison.name)}</span><Icon name={definition.type === 'attack' ? 'sword' : definition.type === 'power' ? 'sun' : 'shield'} size={17} /></span>
    <span className="choice-card-description">{difference(presentation.description, comparison.description)}</span>
    <span className="choice-card-keywords">{type}{presentation.keywords.map((keyword) => <span key={keyword}> · {keyword}</span>)}{temporary && <span> · この戦闘中のみ強化</span>}</span>
    <span className="choice-card-provenance"><span>{owner}</span><span title={definition.metadataProvisional ? 'ゲーム用の仮設定' : undefined}>{rarity}{definition.metadataProvisional ? '（仮）' : ''}</span></span>
    {category !== 'normal' && <span className="choice-card-acquisition">{category === 'blessingOnly' ? '✦ 祝福限定' : '生成専用'}</span>}
    {onSelect && <span className="choice-card-selection" aria-hidden="true">{selected ? '✓ 選択中' : selectionLabel}</span>}
  </>;
  return <article className={`choice-card${selected ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}${canToggle && showAfter ? ' is-upgrade-preview' : ''}${canToggle ? ' has-upgrade-toggle' : ''} ${className}`}
    data-card-id={card.cardId} data-card-uid={card.uid} data-upgraded={String(shown.upgraded)} data-acquisition={category} data-card-class={definition.classId ?? 'legacy'} data-card-rarity={definition.rarity ?? 'common'}>
    {onSelect ? <button type="button" className="choice-card-pick" disabled={disabled} aria-pressed={selected}
      aria-label={`${selectionLabel}：${presentation.name}、コスト${cost}。${presentation.description}`} onClick={onSelect}>{content}</button>
      : <div className="choice-card-face">{content}</div>}
    {canToggle && <button type="button" className="choice-card-toggle" aria-pressed={showAfter} onClick={(event) => { event.stopPropagation(); setShowAfter((value) => !value); }}>
      {showAfter ? '強化前を表示' : '強化後を表示'}<span aria-hidden="true">{showAfter ? '↶' : '＋'}</span>
    </button>}
    {canToggle && showAfter && <span className="choice-card-preview-note" aria-live="polite">強化後のプレビュー</span>}
    {runtime && <details className="choice-card-runtime"><summary>現在の効果</summary><ul>{runtime.facts.map((fact) => <li key={fact.key}><strong>{fact.summary}</strong><span>{fact.detail}</span></li>)}</ul><p>{runtime.explanation}</p></details>}
  </article>;
}

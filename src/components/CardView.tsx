import { useEffect, useMemo, useState } from 'react';
import type { CardInstance, CombatState } from '../types/game';
import { CARD_DEFINITIONS } from '../data/cards';
import { canPlayCard, getCardCost } from '../engine';
import { Icon } from './Icon';
import { CLASS_DEFINITIONS } from '../data/classes';
import { diffCardText, getCardPresentation, getCardUpgradePreview } from '../presentation/cardUpgrade';
import { CardUpgradeToggle } from './CardUpgradeToggle';
import { getCardRuntimeInfo } from '../presentation/cardRuntime';
import { getCardAcquisitionCategory } from '../engine/cardAcquisition';
import { CardEtching } from './CardEtching';
import '../styles/art-cards.css';
import '../styles/card-upgrade.css';
import '../styles/card-runtime.css';

const typeLabels = { attack: '攻撃', skill: 'スキル', power: 'パワー' };


export function CardView({
  card,
  state,
  onPlay,
  inspect = false,
  position = 0,
  disabled = false,
  showUpgradePreview = true,
  highlightUpgradeChanges = false,
}: {
  card: CardInstance;
  state?: CombatState;
  onPlay?: (uid: string) => void;
  inspect?: boolean;
  position?: number;
  disabled?: boolean;
  showUpgradePreview?: boolean;
  highlightUpgradeChanges?: boolean;
}) {
  const [showAfter, setShowAfter] = useState(false);
  useEffect(() => setShowAfter(false), [card.uid, card.cardId, card.upgraded]);
  const runtime = useMemo(() => getCardRuntimeInfo(
    inspect && showUpgradePreview && showAfter && !card.upgraded
      ? { ...card, upgraded: true } : card,
    state,
  ), [card.uid, card.cardId, card.upgraded, inspect, showUpgradePreview, showAfter, state]);
  const definition = CARD_DEFINITIONS[card.cardId];
  if (!definition) return null;
  const canToggle = inspect && showUpgradePreview && !card.upgraded && !definition.unupgradable;
  const shownCard = canToggle && showAfter ? { ...card, upgraded: true } : card;
  const presentation = getCardPresentation(shownCard)!;
  const preview = getCardUpgradePreview(card)!;
  const highlight = highlightUpgradeChanges || (canToggle && showAfter);
  const comparison = shownCard.upgraded ? preview.before : preview.after;
  const renderDifference = (value: string, other: string) => highlight
    ? diffCardText(other, value).map((part, index) => part.changed
      ? <mark className={`card-upgrade-change${shownCard.upgraded ? '' : ' is-before'}`} key={index}>{part.text}</mark>
      : part.text)
    : value;
  const playable = !!state && canPlayCard(state, card.uid) && !disabled;
  const label = presentation.name;
  const text = presentation.description;
  const cost = definition.unplayable ? '—' : definition.xCost ? 'X' : getCardCost(shownCard, state);
  const rarity = definition.rarity === 'rare' ? 'レア' : definition.rarity === 'uncommon' ? 'アンコモン' : 'コモン';
  const owner = definition.classId && definition.classId !== 'colorless'
    ? CLASS_DEFINITIONS[definition.classId].displayName
    : definition.classId === 'colorless' ? '無色・共通' : 'じっと教';
  const blessingOnly = getCardAcquisitionCategory(definition) === 'blessingOnly';
  const temporaryUpgrade = shownCard.upgraded && !!state?.temporaryUpgrades?.includes(card.uid);
  const inner = (
    <>
      <div className="card-heading">
        <span className={`card-cost${highlight && preview.changes.cost ? ' card-upgrade-cost-changed' : ''}`} title={definition.xCost ? '残りのエナジーをすべて消費' : `消費エナジー ${cost}`}>
          {cost}
        </span>
        <h3>{renderDifference(label, comparison.name)}</h3>
        <span className="card-type-symbol">
          <Icon
            name={
              definition.type === 'attack'
                ? 'sword'
                : definition.type === 'power'
                  ? 'sun'
                  : 'shield'
            }
            size={15}
          />
        </span>
      </div>
      <CardEtching definition={definition} />
      {blessingOnly && <span className="card-acquisition-badge" title="祝福からのみ取得できます。通常の戦闘報酬・ショップ・イベント・ランダム生成には出現しません。">✦ 祝福限定</span>}
      <div className="card-description">{renderDifference(text, comparison.description)}</div>
      {temporaryUpgrade && <span className="card-temporary-upgrade" title="この戦闘中だけの強化です。戦闘終了時に元の強化状態へ戻ります。">◇ この戦闘中のみ強化</span>}
      {runtime && (
        <div className={`card-runtime${runtime.facts.some((fact) => fact.warning) ? ' has-risk' : ''}`} title={[runtime.explanation, ...runtime.facts.map((fact) => `${fact.summary}。${fact.detail}`)].join('\n')}>
          <span className="card-runtime-label">{canToggle && showAfter ? '強化した場合の現在の効果' : '現在の効果'}</span>
          {(inspect ? runtime.facts : runtime.facts.slice(0, 2)).map((fact, index) => (
            <div className={`card-runtime-fact${fact.warning ? ' is-risk' : ''}`} key={`${fact.key}:${index}`}>
              <span>{fact.warning ? '⚠ ' : ''}{fact.summary}</span>
              {inspect && <small>{fact.detail}</small>}
            </div>
          ))}
          {inspect && <small className="card-runtime-note">{runtime.explanation}</small>}
        </div>
      )}
      {inspect && (
        <div className="card-metadata">
          <span>{owner}{definition.tokenOnly ? '・生成専用' : ''}</span>
          <span title={definition.metadataProvisional ? '資料に種別・レアリティの記載がないため、ゲーム用の仮設定です。' : undefined}>
            {rarity}{definition.metadataProvisional ? '（仮）' : ''}
          </span>
        </div>
      )}
      <div className="card-footer">
        <span>
          {typeLabels[definition.type]}
          {presentation.keywords.map((keyword) => (
            <span key={keyword} className={highlight && !comparison.keywords.includes(keyword) ? 'card-upgrade-keyword-changed' : undefined}>・{keyword}</span>
          ))}
        </span>
        <span className="card-glyph">{temporaryUpgrade ? '一時強化' : shownCard.upgraded ? '強化済' : '◆'}</span>
      </div>
      {canToggle && (
        <div className="card-upgrade-inline">
          <span className="card-upgrade-inline-stage" aria-live="polite">{showAfter ? '強化後のプレビュー' : '強化前'}</span>
          <CardUpgradeToggle upgraded={showAfter} onToggle={() => setShowAfter((value) => !value)} />
        </div>
      )}
      {!inspect && <span className="card-shortcut">{position < 5 ? position + 1 : ''}</span>}
    </>
  );
  if (inspect)
    return (
      <article className={`game-card stone-cut-card game-card--${definition.type} inspect-card${canToggle && showAfter ? ' is-upgrade-preview' : ''}`} data-card-id={definition.id} data-upgraded={String(shownCard.upgraded)} data-acquisition={getCardAcquisitionCategory(definition)} data-card-class={definition.classId ?? 'legacy'} data-card-rarity={definition.rarity ?? 'common'}>{inner}</article>
    );
  return (
    <button
      data-card-uid={card.uid}
      data-card-class={definition.classId ?? 'legacy'}
      data-card-rarity={definition.rarity ?? 'common'}
      data-acquisition={getCardAcquisitionCategory(definition)}
      className={`game-card stone-cut-card game-card--${definition.type} ${playable ? 'is-playable' : 'is-unplayable'}`}
      onClick={() => onPlay?.(card.uid)}
      disabled={!playable}
      aria-label={`${label}、コスト${cost}。${blessingOnly ? '祝福限定。' : ''}${temporaryUpgrade ? 'この戦闘中だけ強化。' : ''}${text}${runtime ? ` 現在の効果：${runtime.facts.map((fact) => `${fact.summary}。${fact.detail}`).join(' ')}` : ''}${!playable ? '、使用できません' : ''}`}
    >
      {inner}
    </button>
  );
}

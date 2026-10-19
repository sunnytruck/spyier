import type { CardDefinition, CardInstance, CombatState } from '../types/game';
import { CARD_DEFINITIONS } from '../data/cards';
import { canPlayCard, getCardCost } from '../engine';
import { Icon } from './Icon';
import { CLASS_DEFINITIONS } from '../data/classes';

const typeLabels = { attack: '攻撃', skill: 'スキル', power: 'パワー' };

function CardArt({ definition }: { definition: CardDefinition }) {
  const isAttack = definition.type === 'attack';
  const isPower = definition.type === 'power';
  return (
    <div className={`card-art card-art--${definition.type}`} aria-hidden="true">
      <div className="card-art-halo" />
      <svg viewBox="0 0 180 100" className="card-etching">
        <path d="M10 90 37 60l16 10 29-53 36 62 24-31 29 42" fill="currentColor" opacity=".07" />
        <path
          d="M3 91h174M15 86l23-27 15 11 29-54 36 62 24-30 24 33"
          fill="none"
          stroke="currentColor"
          strokeWidth=".8"
          opacity=".25"
        />
        {isAttack ? (
          <g fill="none" stroke="currentColor" strokeLinejoin="round">
            <path d="m69 17 14 7 30 47-12 8-31-47Z" strokeWidth="2" />
            <path d="m91 72 23-14m-10 17 10 15m-1-54-40 44m-4-7 11 13" strokeWidth="3" />
            <path d="m109 17 5 19-11-8Z" fill="currentColor" opacity=".4" />
          </g>
        ) : isPower ? (
          <g fill="none" stroke="currentColor">
            <circle cx="90" cy="49" r="25" strokeWidth="2" />
            <circle cx="90" cy="49" r="32" strokeDasharray="2 7" />
            <path
              d="m90 12 0-9m0 91v-9M53 49H44m92 0h-9M65 24l-7-7m64 64-7-7m0-50 7-7M65 74l-7 7"
              strokeWidth="2"
            />
            <path d="m90 29 15 25-15 16-15-16Z" fill="currentColor" opacity=".3" />
          </g>
        ) : (
          <g fill="none" stroke="currentColor">
            <path d="m90 16-31 12v20c0 22 17 31 31 37 14-6 31-15 31-37V28Z" strokeWidth="2" />
            <path d="m90 27-21 8v14c0 14 11 23 21 28 10-5 21-14 21-28V35Z" strokeWidth=".8" />
            <path d="m78 47 9 9 16-18" strokeWidth="3" />
          </g>
        )}
        <path d="m15 15 4 4-4 4-4-4Zm145 56 3 3-3 3-3-3Z" fill="currentColor" opacity=".5" />
      </svg>
    </div>
  );
}

export function CardView({
  card,
  state,
  onPlay,
  inspect = false,
  position = 0,
  disabled = false,
}: {
  card: CardInstance;
  state?: CombatState;
  onPlay?: (uid: string) => void;
  inspect?: boolean;
  position?: number;
  disabled?: boolean;
}) {
  const definition = CARD_DEFINITIONS[card.cardId];
  if (!definition) return null;
  const playable = !!state && canPlayCard(state, card.uid) && !disabled;
  const label = `${definition.name}${card.upgraded ? '＋' : ''}`;
  const text = card.upgraded ? definition.upgradedDescription : definition.description;
  const cost = definition.xCost ? 'X' : getCardCost(card, state);
  const rarity = definition.rarity === 'rare' ? 'レア' : definition.rarity === 'uncommon' ? 'アンコモン' : 'コモン';
  const owner = definition.classId && definition.classId !== 'colorless'
    ? CLASS_DEFINITIONS[definition.classId].displayName
    : definition.classId === 'colorless' ? '無色・共通' : 'じっと教';
  const upgradedCost = definition.xCost ? 'X' : definition.upgradedCost ?? definition.cost;
  const inner = (
    <>
      <div className="card-heading">
        <span className="card-cost" title={definition.xCost ? '残りのエナジーをすべて消費' : `消費エナジー ${cost}`}>
          {cost}
        </span>
        <h3>{label}</h3>
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
      <CardArt definition={definition} />
      <div className="card-description">{text}</div>
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
          {definition.defense ? '・防御' : ''}
          {(card.upgraded ? definition.upgradedExhaust ?? definition.exhaust : definition.exhaust) ? '・廃棄' : ''}
          {(card.upgraded ? definition.upgradedRetain ?? definition.retain : definition.retain) ? '・保留' : ''}
          {definition.ethereal ? '・エセリアル' : ''}
        </span>
        <span className="card-glyph">{card.upgraded ? '強化済' : '◆'}</span>
      </div>
      {inspect && !card.upgraded && (
        <details className="card-upgrade-preview">
          <summary>強化後を確認 <span>＋</span></summary>
          <p><b>コスト {upgradedCost}</b>{definition.upgradedDescription}</p>
        </details>
      )}
      {!inspect && <span className="card-shortcut">{position < 5 ? position + 1 : ''}</span>}
    </>
  );
  if (inspect)
    return (
      <article className={`game-card game-card--${definition.type} inspect-card`} data-card-id={definition.id}>{inner}</article>
    );
  return (
    <button
      data-card-uid={card.uid}
      className={`game-card game-card--${definition.type} ${playable ? 'is-playable' : 'is-unplayable'}`}
      onClick={() => onPlay?.(card.uid)}
      disabled={!playable}
      aria-label={`${label}、コスト${cost}。${text}${!playable ? '、使用できません' : ''}`}
    >
      {inner}
    </button>
  );
}

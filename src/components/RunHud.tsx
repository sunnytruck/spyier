import { useEffect, useRef, useState } from 'react';
import type { RunState } from '../types/run';
import type { GameSettings } from '../types/game';
import type { CombatCue } from '../presentation/types';
import { RELIC_DEFINITIONS } from '../data/relics';
import { POTION_DEFINITIONS } from '../data/potions';
import { Icon } from './Icon';
import { RelicIcon } from './RelicIcon';

/** New cues carry a stable ID; the name fallback supports older presentation adapters. */
export function getActivatedRelicId(cue?: CombatCue | null): string | null {
  if (!cue) return null;
  const id = cue.resource?.startsWith('relic:') ? cue.resource.slice(6) : null;
  if (id && Object.hasOwn(RELIC_DEFINITIONS, id)) return id;
  if (cue.effect !== 'relic') return null;
  return Object.values(RELIC_DEFINITIONS).find((relic) => relic.name === cue.label)?.id ?? null;
}

export function RunHud({
  state,
  onDeck,
  onRelics,
  onPotion,
  disabled = false,
  cue,
  sequence = 0,
  settings,
}: {
  state: RunState;
  onDeck: () => void;
  onRelics: () => void;
  onPotion: (slot: number) => void;
  disabled?: boolean;
  cue?: CombatCue | null;
  sequence?: number;
  settings?: GameSettings;
}) {
  const previousRelics = useRef(new Set(state.relicIds));
  const [acquiredIds, setAcquiredIds] = useState<string[]>([]);
  const activeId = getActivatedRelicId(cue);
  const noMotion = settings?.reducedMotion || settings?.speed === 'instant';
  const relicKey = state.relicIds.join('\0');
  useEffect(() => {
    const added = state.relicIds.filter((id) => !previousRelics.current.has(id));
    previousRelics.current = new Set(state.relicIds);
    if (!added.length || noMotion) { setAcquiredIds([]); return; }
    setAcquiredIds(added);
    const timer = window.setTimeout(() => setAcquiredIds([]), settings?.speed === 'fast' ? 360 : 650);
    return () => window.clearTimeout(timer);
  }, [relicKey, noMotion, settings?.speed]);
  const highlightedId = activeId && state.relicIds.includes(activeId) ? activeId : acquiredIds[0];
  const displayedRelics = [...new Set([...(highlightedId ? [highlightedId] : []), ...state.relicIds])].slice(0, 3);
  const player =
    state.screen === 'combat' && state.combat
      ? state.combat.player
      : { hp: state.hp, maxHp: state.maxHp };
  return (
    <div className="run-hud" aria-label="探索状況">
      <span className="hud-floor" aria-label={`Act ${state.act ?? 1}・${state.floor}階 / 12階`}>
        {state.act !== undefined && <small>Act {state.act}</small>}
        <b>{String(state.floor).padStart(2, '0')}</b>
        <small>/ 12F</small>
      </span>
      <span className="hud-health" aria-label={`HP ${player.hp}/${player.maxHp}`}>
        <Icon name="heart" size={14} />
        <b>{player.hp}</b>
        <small>/{player.maxHp}</small>
      </span>
      <span className="hud-gold" aria-label={`ゴールド ${state.gold}`}>
        <span aria-hidden="true">◈</span>
        <b>{state.gold}</b>
        <small>G</small>
      </span>
      <button
        onClick={onDeck}
        aria-label={`デッキを確認 ${state.deck.length}枚`}
        title="デッキのカードを確認"
      >
        <Icon name="cards" size={17} />
        <b>{state.deck.length}</b>
      </button>
      <button
        className="hud-relics"
        onClick={onRelics}
        aria-label={`レリックを確認 ${state.relicIds.length}個`}
        title={
          state.relicIds.map((id) => RELIC_DEFINITIONS[id]?.name).join(' / ') || 'レリックを確認'
        }
      >
        {displayedRelics.length ? <span className="hud-relic-dock" aria-hidden="true">{displayedRelics.map((id) => <span className="hud-relic-token" key={`${id}-${id === activeId ? sequence : 0}`} title={`${RELIC_DEFINITIONS[id]?.name}：${RELIC_DEFINITIONS[id]?.description}`}><RelicIcon id={id} size={30} active={!noMotion && id === activeId} acquired={!noMotion && acquiredIds.includes(id)} /></span>)}</span> : <Icon name="sun" size={17} />}
        <b>{state.relicIds.length}</b>
      </button>
      {activeId && !noMotion && <span className="relic-activation-caption" key={`${activeId}-${sequence}`} role="status"><RelicIcon id={activeId} size={26} /><span>{RELIC_DEFINITIONS[activeId]?.name} が発動</span></span>}
      <div className="hud-potions" aria-label="ポーション">
        {state.potions.map((potionId, slot) => {
          const potion = potionId ? POTION_DEFINITIONS[potionId] : null;
          return (
            <button
              className={`potion-slot ${potion ? 'is-filled' : ''}`}
              data-potion-slot={slot}
              key={slot}
              disabled={disabled || !potion || state.screen !== 'combat' || state.combat?.phase !== 'player' || !!state.combat?.pendingChoice}
              onClick={() => onPotion(slot)}
              title={
                potion
                  ? `${potion.name}：${potion.description}${potion.target === 'enemy' ? ' 選択中の敵に使用。' : ''} 戦闘中にクリックして使用。`
                  : '空のポーション枠'
              }
              aria-label={
                potion
                  ? `${potion.name}を使用。${potion.description}`
                  : `空のポーション枠 ${slot + 1}`
              }
            >
              <svg
                viewBox="0 0 24 26"
                width="20"
                height="23"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                aria-hidden="true"
              >
                <path d="M9 2h6v5l5 9c2 5-1 8-8 8S2 21 4 16l5-9Z" />
                <path d="M8 2h8M6 15h12" />
                {potion && (
                  <path d="m7 17 10 0c1 3-1 5-5 5s-6-2-5-5" fill="currentColor" opacity=".45" />
                )}
              </svg>
              <span>{slot + 1}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

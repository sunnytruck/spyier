import type { RunState } from '../types/run';
import { RELIC_DEFINITIONS } from '../data/relics';
import { POTION_DEFINITIONS } from '../data/potions';
import { Icon } from './Icon';

export function RunHud({
  state,
  onDeck,
  onRelics,
  onPotion,
  disabled = false,
}: {
  state: RunState;
  onDeck: () => void;
  onRelics: () => void;
  onPotion: (slot: number) => void;
  disabled?: boolean;
}) {
  const player =
    state.screen === 'combat' && state.combat
      ? state.combat.player
      : { hp: state.hp, maxHp: state.maxHp };
  return (
    <div className="run-hud" aria-label="探索状況">
      <span className="hud-floor">
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
        <Icon name="sun" size={17} />
        <b>{state.relicIds.length}</b>
      </button>
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

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Actor, CombatState, EnemyIntent, EnemyState, GameSettings } from '../types/game';
import type { CombatCue } from '../presentation/types';
import { getEnemies, getEnemyKey, predictEnemyDamage } from '../engine';
import { Icon } from '../components/Icon';
import { ChoiceCard } from '../components/ChoiceCard';
import { BattleHand } from '../components/BattleHand';
import { Modal } from '../components/Modal';
import { RockDeity, StoneSentinel } from '../components/CharacterArt';
import { ENEMY_DEFINITIONS } from '../data/enemies';
import { getActDefinition } from '../data/acts';
import { effectivePlayerStrength } from '../engine/combat/relics';
import { getRelicEnemyWeakMultiplier, getRelicVulnerableMultiplier } from '../engine/combat/relicModifiers';
import { getDisplayedEnemyIntent } from '../engine/combat/enemyAI';
import { WorldScene } from '../components/world/WorldScene';
import '../styles/art-battle.css';
import { BattleEffects } from '../components/BattleEffects';
import { CardFlights } from '../components/CardFlights';
import { getPendingChoiceCards, getPendingChoiceLabel } from '../engine/actions/choices';
import { ClassResourceHud, EnemyResourceForecast, OrbSlots, OstyCompanion, StarEnergyHud } from '../components/classResources/ClassResourceHud';

type Pile = 'drawPile' | 'discardPile' | 'exhaustPile' | 'powers';
const keepChoiceOpen = () => {};
interface StatusView { value: number; symbol: string; label: string; detail: string; color: string; shortLabel?: string; hideValue?: boolean; kind?: string }

/** A portal keeps status explanations visible beside screen-edge enemies. */
function StatusChip({ status }: { status: StatusView }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const anchor = useRef<HTMLSpanElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const id = useId();
  const heading = `${status.label}${status.hideValue ? '' : ` ${status.value}`}`;
  useLayoutEffect(() => {
    if (!open || !anchor.current || !tooltip.current) return;
    const source = anchor.current.getBoundingClientRect();
    const bounds = tooltip.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - bounds.width - 8, source.left + source.width / 2 - bounds.width / 2));
    const below = source.bottom + 8;
    const top = Math.max(8, Math.min(window.innerHeight - bounds.height - 8, below + bounds.height <= window.innerHeight - 8 ? below : source.top - bounds.height - 8));
    setPosition({ left, top });
  }, [open, status.detail, status.value]);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const outside = (event: PointerEvent) => { if (!anchor.current?.contains(event.target as Node)) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return <>
    <span ref={anchor} className={`status-chip status-${status.color}${status.shortLabel ? ' status-chip--named' : ''}`} tabIndex={0} data-combat-status={status.kind}
      title={`${heading}：${status.detail}`}
      aria-label={`${heading}：${status.detail}`} aria-describedby={open ? id : undefined}
      onPointerEnter={(event) => { if (event.pointerType !== 'touch') setOpen(true); }}
      onPointerLeave={() => { if (document.activeElement !== anchor.current) setOpen(false); }}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)}>
      <span>{status.symbol}</span>{status.shortLabel && <span className="status-chip-label">{status.shortLabel}</span>}{!status.hideValue && <b>{status.value}</b>}
    </span>
    {open && createPortal(<span className="battle-status-tooltip" id={id} ref={tooltip} role="tooltip" style={position}>{heading}<small>{status.detail}</small></span>, document.body)}
  </>;
}
interface BattleProps {
  state: CombatState;
  resolving: boolean;
  onPlay: (uid: string, targetId?: string) => boolean | void;
  onSelectEnemy?: (targetId: string) => void;
  campaign?: boolean;
  act?: number;
  floor?: number;
  onEndTurn: () => void;
  onChooseCards?: (cardIds: string[]) => void;
  onOpenPile: (pile: Pile) => void;
  onRestart: () => void;
  onReplay: () => void;
  onTitle: () => void;
  presentation?: {
    cue: CombatCue | null;
    sequence: number;
    duration?: number;
    settings: GameSettings;
    skip: () => void;
    busy: boolean;
  };
}

/** Secondary effects come from the same saved intent that the engine executes. */
function intentExtras(intent: EnemyIntent): string {
  return [
    intent.weak ? `弱体${intent.weak}` : '',
    intent.vulnerable ? `脆弱${intent.vulnerable}` : '',
    intent.poison ? `毒${intent.poison}` : '',
    intent.block ? `自身 防御${intent.block}` : '',
    intent.strength ? `自身 筋力${intent.strength}` : '',
    intent.alliesBlock ? `味方 防御${intent.alliesBlock}` : '',
    intent.alliesStrength ? `味方 筋力${intent.alliesStrength}` : '',
    intent.allTargets ? '岩霊にも攻撃' : '',
  ].filter(Boolean).join(' / ');
}

function StatusChips({ actor, stillness = 0, intangible = 0, dexterity = 0, vigor = 0, plate = 0, drawBlocked = false, retainBlock = 0, retainBlockNextTurn = 0, weakMultiplier = 0.75, vulnerableMultiplier = 1.5 }: { actor: Actor; weakMultiplier?: number; vulnerableMultiplier?: number; stillness?: number; intangible?: number; dexterity?: number; vigor?: number; plate?: number; drawBlocked?: boolean; retainBlock?: number; retainBlockNextTurn?: number }) {
  const statuses: StatusView[] = [
    {
      value: actor.strength,
      symbol: actor.strength < 0 ? '↓' : '↑',
      label: '筋力',
      detail: `攻撃1ヒットにつきダメージ${actor.strength >= 0 ? '+' : ''}${actor.strength}。`,
      color: 'strength',
    },
    {
      value: actor.weak,
      symbol: '↘',
      label: '弱体',
      detail: `攻撃ダメージが${weakMultiplier}倍。対象のターン終了時に1減少。`,
      color: 'weak',
    },
    {
      value: actor.vulnerable,
      symbol: '◇',
      label: '脆弱',
      detail: `受ける攻撃ダメージが${vulnerableMultiplier}倍。対象のターン終了時に1減少。`,
      color: 'vulnerable',
    },
    {
      value: actor.poison,
      symbol: '☠',
      label: '毒',
      detail: '対象のターン開始時にブロックを無視してダメージを受け、1減少。',
      color: 'poison',
    },
    {
      value: stillness,
      symbol: '静',
      label: '静寂',
      detail: `自分のターン開始時に${stillness}ブロックを得る。`,
      color: 'stillness',
    },
    {
      value: (actor as EnemyState).doom ?? 0,
      symbol: '終',
      label: '破滅',
      detail: '敵のターン開始時、破滅が現在HP以上なら撃破します。ブロックの影響を受けません。',
      color: 'poison',
    },
    {
      value: (actor as EnemyState).stun ?? 0,
      symbol: 'Ⅱ',
      label: 'スタン',
      detail: '次の敵行動を1回休み、スタンを1減らして次の予告へ進みます。毒と破滅は通常どおり解決します。',
      color: 'weak',
    },
    {
      value: intangible,
      symbol: '幽',
      label: '霊体',
      detail: '敵の攻撃の各ヒットを最大1にします。次の敵ターン終了時に1減少。毒・HP消費・最大HP減少は軽減しません。',
      color: 'stillness',
    },
    {
      value: dexterity,
      symbol: '敏',
      label: '敏捷',
      detail: `カードから得るブロック${dexterity >= 0 ? '+' : ''}${dexterity}。`,
      color: 'stillness',
    },
    {
      value: vigor,
      symbol: '奮',
      label: '活力',
      detail: `次の攻撃カードの各ヒットに${vigor}ダメージを加算。攻撃カードを使用すると失われます。`,
      color: 'strength',
    },
    {
      value: plate,
      symbol: '甲',
      label: 'プレート',
      detail: `ターン終了時に${plate}ブロックを得ます。敵の攻撃でHPを失うたびに1減少します。`,
      color: 'stillness',
    },
    {
      value: drawBlocked ? 1 : 0,
      symbol: '止',
      label: 'このターンはドロー不可',
      shortLabel: 'ドロー不可',
      hideValue: true,
      kind: 'draw-blocked',
      detail: 'このターンはカードを引けません。次の自分のターン開始時に解除され、通常のドローが再開します。カードを山札や捨て札から直接手札に加える処理には影響しません。',
      color: 'weak',
    },
    {
      value: retainBlock > 0 ? 1 : 0,
      symbol: '▰',
      label: 'ブロック保持',
      shortLabel: 'ブロック保持',
      hideValue: true,
      kind: 'retain-block',
      detail: '自分のターン開始時にブロックを失いません。敵の攻撃などで消費するブロックは通常どおり減少します。',
      color: 'stillness',
    },
    {
      value: retainBlock <= 0 ? retainBlockNextTurn : 0,
      symbol: '▰',
      label: '次のターンへブロック保持',
      shortLabel: '次ターン保持',
      hideValue: retainBlockNextTurn === 1,
      kind: 'retain-block-next-turn',
      detail: `次の自分のターン開始時にブロックを失いません。残り${retainBlockNextTurn}回。敵の攻撃などで消費するブロックは通常どおり減少します。`,
      color: 'stillness',
    },
  ].filter((status) => status.value !== 0);
  return (
    <div className="status-chips">
      {statuses.map((status) => (
        <StatusChip key={status.label} status={status} />
      ))}
    </div>
  );
}

function HealthBar({ actor, player = false, onDetails }: { actor: Actor; player?: boolean; onDetails?: () => void }) {
  const healthPercent = actor.maxHp > 0 ? Math.max(0, Math.min(100, actor.hp / actor.maxHp * 100)) : 0;
  return (
    <div className={`health-info ${player ? 'health-info--player' : ''}`}>
      <div className="actor-name">
        <span>{player ? 'じっと教 教祖' : '塔の守り手'}</span>
        <h2>{actor.name}</h2>
        {onDetails && <button className="enemy-inspect-button" type="button" onClick={onDetails} aria-label={`${actor.name}の詳細を表示`} title="敵の特徴と行動を確認">ⓘ</button>}
      </div>
      <div className="health-line">
        <Icon name="heart" size={15} />
        <div
          className="health-track"
          role="progressbar"
          aria-label={`${actor.name}のHP`}
          aria-valuenow={actor.hp}
          aria-valuemin={0}
          aria-valuemax={actor.maxHp}
        >
          <span className="health-trail" style={{ width: `${healthPercent}%` }} />
          <span className="health-fill" style={{ width: `${healthPercent}%` }} />
        </div>
        <span className="health-value">
          <b>{actor.hp}</b>
          <span>/ {actor.maxHp}</span>
        </span>
        {actor.block > 0 && (
          <span className="block-value" title="ブロック：攻撃ダメージを吸収します">
            <Icon name="shield" size={17} />
            <b>{actor.block}</b>
          </span>
        )}
      </div>
    </div>
  );
}

export function BattleScreen({
  state,
  resolving,
  onPlay,
  onEndTurn,
  onChooseCards,
  onOpenPile,
  onRestart,
  onReplay,
  onTitle,
  onSelectEnemy,
  campaign = false,
  act = 1,
  floor,
  presentation,
}: BattleProps) {
  const [logOpen, setLogOpen] = useState(false);
  const [chosenCards, setChosenCards] = useState<string[]>([]);
  const [fallenActors, setFallenActors] = useState<Set<string>>(() => new Set());
  const [inspectedEnemyId, setInspectedEnemyId] = useState<string | null>(null);
  const divine = state.jitto === 100;
  const lastLog = state.log[state.log.length - 1];
  const enemies = getEnemies(state);
  const multiple = enemies.length > 1;
  const enemy = enemies[0];
  const selectedId =
    state.selectedEnemyId ?? getEnemyKey(enemies.find((actor) => actor.hp > 0) ?? enemy);
  const inspectedEnemy = enemies.find((actor) => getEnemyKey(actor) === inspectedEnemyId);
  const inspectedDefinition = inspectedEnemy ? ENEMY_DEFINITIONS[inspectedEnemy.id] : null;
  const displayedIntent = getDisplayedEnemyIntent(enemy);
  const damage = predictEnemyDamage(state, getEnemyKey(enemy));
  const intentDescription =
    displayedIntent.damage !== undefined
      ? `${damage}ダメージ${(displayedIntent.hits ?? 1) > 1 ? `を${displayedIntent.hits}回` : ''}。現在の筋力・弱体・脆弱・霊体を反映した予測値。ブロックで軽減できます。${intentExtras(displayedIntent)}`
      : displayedIntent.description;
  const intentIcon =
    displayedIntent.damage !== undefined
      ? 'sword'
      : displayedIntent.kind === 'defend'
        ? 'shield'
        : displayedIntent.kind === 'buff'
          ? 'sun'
          : 'flame';

  useEffect(() => setChosenCards([]), [state.pendingChoice]);
  useEffect(() => {
    const newlyFallen: string[] = [];
    if (presentation?.cue?.kind === 'death' && presentation.cue.targetId) newlyFallen.push(presentation.cue.targetId);
    if (!presentation?.busy) {
      if (state.player.hp <= 0) newlyFallen.push('player');
      for (const actor of getEnemies(state)) if (actor.hp <= 0) newlyFallen.push(getEnemyKey(actor));
    }
    if (newlyFallen.length) setFallenActors((current) => newlyFallen.every((id) => current.has(id)) ? current : new Set([...current, ...newlyFallen]));
  }, [presentation?.cue, presentation?.busy, state]);


  return (
    <main
      data-presentation-busy={presentation?.busy ? 'true' : 'false'}
      data-presentation-cue={presentation?.cue?.kind ?? 'idle'}
      data-player-class={state.classId ?? 'legacy'}
      className={`battle-screen compact-battle cinematic-battle art-directed-battle ${state.classId ? 'has-class-resources' : ''} ${presentation?.settings.reducedMotion || presentation?.settings.speed === 'instant' ? 'motion-reduced' : ''} ${presentation?.settings.speed === 'fast' ? 'presentation-fast' : ''} ${divine ? 'is-divine' : ''} ${resolving ? 'is-presenting' : ''} ${multiple ? 'multi-enemy' : ''} ${campaign ? 'campaign-battle' : ''}`}
    >
      {presentation && <CardFlights {...presentation} />}
      <section className="battle-heading">
        <div>
          <p className="eyebrow">
            <span className="gold-line" /> {campaign ? `第${act}階層 · ${floor}F` : '単体戦闘の練習'}{' '}
            <span className="eyebrow-separator">/</span>{' '}
            {campaign ? getActDefinition(act).name : floor === 12 ? '静寂の頂' : 'じっと教の塔'}
          </p>
          <h1 className="screen-reader-only">岩の意志を、示せ。</h1>
        </div>
        <div className="battle-progress">
          <span className="battle-mode">
            {multiple
              ? `${enemies.filter((actor) => actor.hp > 0).length}体の敵 · 対象を選択`
              : '単体戦闘'}
          </span>
          <span className="turn-tag">
            <span className="turn-dot" />
            {resolving ? '戦闘を演出中' : 'あなたのターン'}
            <b>{String(state.turn).padStart(2, '0')}</b>
          </span>
          {presentation?.busy && <button className="battle-skip-button" onClick={presentation.skip} aria-label="戦闘演出をスキップ">演出をスキップ <span>»</span></button>}
        </div>
      </section>

      <section className="battle-arena" aria-label="戦闘フィールド">
        <WorldScene variant="battle" act={act} />
        <div className="arena-scenery" aria-hidden="true">
          <div className="temple-arch" />
          <div className="temple-column column-left" />
          <div className="temple-column column-right" />
          <div className="temple-seal">静</div>
          <div className="arena-floor" />
          <span className="ember ember-one" />
          <span className="ember ember-two" />
          <span className="ember ember-three" />
        </div>
        <span className="arena-corner corner-tl" />
        <span className="arena-corner corner-tr" />
        <span className="arena-corner corner-bl" />
        <span className="arena-corner corner-br" />
        <div className="arena-label">
          <span /> {campaign ? `${floor}F · じっと教の試練` : '塔の入り口'}{' '}
          <b>ENCOUNTER {floor ? String(floor).padStart(2, '0') : '01'}</b>
        </div>
        <div className="combatant combatant--player">
          <div className="actor-status">
            <StatusChips actor={{ ...state.player, strength: effectivePlayerStrength(state) }} stillness={state.stillness} intangible={state.intangible ?? 0} dexterity={state.dexterity ?? 0} vigor={state.vigor ?? 0} plate={state.plate ?? 0} drawBlocked={state.drawBlocked} retainBlock={state.powerStacks?.retainBlock ?? 0} retainBlockNextTurn={state.powerStacks?.retainBlockNextTurn ?? 0} />
            {divine && (
              <span className="divine-tag">
                <Icon name="sun" size={13} />
                神格化
              </span>
            )}
          </div>
          <div className="character-stage">
            <div className="character-shadow" />
            <div className="actor-motion" data-battle-actor="player" data-fallen={fallenActors.has('player') || undefined}><RockDeity deified={divine} classId={state.classId} /></div>
            {state.classId === 'machinist' && <OrbSlots state={state} />}
            {state.classId === 'necromancer' && <OstyCompanion state={state} cue={presentation?.cue} />}
            {state.player.block > 0 && <div className="block-aura" aria-hidden="true" />}
          </div>
          <HealthBar actor={state.player} player />
          <ClassResourceHud state={state} />
        </div>
        <div className="arena-center">
          <span className="versus-label">試練</span>
          <div
            className={`jitto-medallion ${divine ? 'medallion-divine' : ''}`}
            title="じっとゲージ：50以上で防御カードのブロック+2。100で神格化。"
          >
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle className="medallion-track" cx="60" cy="60" r="52" />
              <circle
                className="medallion-progress"
                cx="60"
                cy="60"
                r="52"
                strokeDasharray={`${(state.jitto / 100) * 327} 327`}
              />
              <path d="M60 1v10m0 98v10M1 60h10m98 0h10" />
            </svg>
            <span className="medallion-symbol">{divine ? '神' : '静'}</span>
            <small>{divine ? '神格化' : 'じっとの心'}</small>
          </div>
          <p className="arena-quote">
            {divine
              ? '「うきき、神の時間や。」'
              : state.jitto >= 50
                ? '「ほいっと〜、いい感じや。」'
                : '「動かざること、岩のごとし。」'}
          </p>
        </div>
        {multiple ? (
          <div className="enemy-formation" aria-label="敵をクリックして攻撃対象を選択">
            {enemies.map((actor, index) => {
              const enemyId = getEnemyKey(actor);
              const incoming = predictEnemyDamage(state, enemyId);
              const visibleIntent = getDisplayedEnemyIntent(actor);
              const selected = selectedId === enemyId;
              const dead = actor.hp <= 0;
              return (
                <div
                  className={`formation-enemy enemy-tone-${index} ${dead ? 'enemy-defeated' : ''} ${selected ? 'enemy-selected' : ''}`}
                  key={enemyId}
                >
                  <div
                    className={`enemy-intent intent-${visibleIntent.kind}`}
                    title={
                      visibleIntent.damage !== undefined
                        ? `${incoming}ダメージ × ${visibleIntent.hits ?? 1}。筋力・状態異常・霊体を反映、ブロックで軽減。${intentExtras(visibleIntent)}`
                        : visibleIntent.description
                    }
                    tabIndex={0}
                  >
                    <span className="intent-icon">
                      <Icon
                        name={
                          visibleIntent.damage !== undefined
                            ? 'sword'
                            : visibleIntent.kind === 'defend'
                              ? 'shield'
                              : 'sun'
                        }
                        size={17}
                      />
                    </span>
                    <div>
                      <span className="intent-eyebrow">
                        {dead ? 'DEFEATED' : 'NEXT · 行動予告'}
                      </span>
                      <b>{dead ? '撃破' : visibleIntent.label}</b>
                      <small>
                        {dead
                          ? '行動しません'
                          : visibleIntent.damage !== undefined
                            ? `${incoming}${(visibleIntent.hits ?? 1) > 1 ? ` × ${visibleIntent.hits}` : ''} ダメージ`
                            : actor.stun ? '行動を1回休む' : intentExtras(visibleIntent) || visibleIntent.description}
                      </small>
                      {!dead && visibleIntent.damage !== undefined && intentExtras(visibleIntent) && <small className="intent-extra-effects">{intentExtras(visibleIntent)}</small>}
                    </div>
                  </div>
                  <div className="actor-status enemy-status">
                    <StatusChips actor={actor} weakMultiplier={getRelicEnemyWeakMultiplier(state)} vulnerableMultiplier={getRelicVulnerableMultiplier(state)} />
                  </div>
                  <button
                    className={`character-stage enemy-target ${selected ? 'is-targeted' : ''}`}
                    data-enemy-id={enemyId}
                    disabled={dead || resolving}
                    aria-pressed={selected}
                    aria-label={`攻撃対象に選択：${actor.name} ${index + 1}`}
                    title={`${actor.name}：${ENEMY_DEFINITIONS[actor.id]?.gimmick ?? ENEMY_DEFINITIONS[actor.id]?.description ?? ''}`}
                    onClick={() => onSelectEnemy?.(enemyId)}
                  >
                    <div className="character-shadow" />
                    <div className="actor-motion" data-battle-actor={enemyId} data-fallen={fallenActors.has(enemyId) || undefined}><StoneSentinel /></div>
                    <span className="target-label">
                      {dead ? '撃破' : selected ? '選択中' : 'クリックで選択'}
                    </span>
                  </button>
                  <HealthBar actor={actor} onDetails={() => setInspectedEnemyId(enemyId)} />
                  <EnemyResourceForecast state={state} enemy={actor} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="combatant combatant--enemy">
            <div
              className={`enemy-intent intent-${displayedIntent.kind}`}
              title={intentDescription}
              tabIndex={0}
            >
              <span className="intent-icon">
                <Icon name={intentIcon} size={22} />
              </span>
              <div>
                <span className="intent-eyebrow">NEXT · 敵の行動予告</span>
                <b>{displayedIntent.label}</b>
                <small>
                  {displayedIntent.damage !== undefined ? (
                    <>
                      <strong>
                        {damage}
                        {(displayedIntent.hits ?? 1) > 1 ? ` × ${displayedIntent.hits}` : ''}
                      </strong>{' '}
                      ダメージ
                    </>
                  ) : (
                    enemy.stun ? '行動を1回休む' : intentExtras(displayedIntent) || displayedIntent.description
                  )}
                </small>
                {displayedIntent.damage !== undefined && intentExtras(displayedIntent) && <small className="intent-extra-effects">{intentExtras(displayedIntent)}</small>}
              </div>
            </div>
            <div className="actor-status enemy-status">
              <StatusChips actor={enemy} weakMultiplier={getRelicEnemyWeakMultiplier(state)} vulnerableMultiplier={getRelicVulnerableMultiplier(state)} />
            </div>
            <button
              className={`character-stage enemy-target ${selectedId === getEnemyKey(enemy) ? 'is-targeted' : ''}`}
              data-enemy-id={getEnemyKey(enemy)}
              onClick={() => onSelectEnemy?.(getEnemyKey(enemy))}
              disabled={resolving || enemy.hp <= 0}
              aria-pressed={selectedId === getEnemyKey(enemy)}
              aria-label={`攻撃対象に選択：${enemy.name}`}
              title={`${enemy.name}：${ENEMY_DEFINITIONS[enemy.id]?.gimmick ?? ENEMY_DEFINITIONS[enemy.id]?.description ?? ''}`}
            >
              <div className="character-shadow" />
              <div className="actor-motion" data-battle-actor={getEnemyKey(enemy)} data-fallen={fallenActors.has(getEnemyKey(enemy)) || undefined}><StoneSentinel /></div>
              <span className="target-label">選択中</span>
            </button>
            <HealthBar actor={enemy} onDetails={() => setInspectedEnemyId(getEnemyKey(enemy))} />
            <EnemyResourceForecast state={state} enemy={enemy} />
          </div>
        )}
        {presentation && <BattleEffects cue={presentation.cue} sequence={presentation.sequence} settings={presentation.settings} busy={presentation.busy} duration={presentation.duration} />}
      </section>

      <section className="battle-controls" aria-label="戦闘操作">
        <div className="pile-controls">
          <button
            className="pile-button"
            data-battle-pile="drawPile"
            onClick={() => onOpenPile('drawPile')}
            aria-label={`山札を確認、${state.drawPile.length}枚`}
          >
            <Icon name="cards" size={24} />
            <span>
              山札
              <b>
                {state.drawPile.length}
                <small>枚</small>
              </b>
            </span>
          </button>
          <button
            className="pile-button"
            data-battle-pile="discardPile"
            onClick={() => onOpenPile('discardPile')}
            aria-label={`捨て札を確認、${state.discardPile.length}枚`}
          >
            <Icon name="discard" size={24} />
            <span>
              捨て札
              <b>
                {state.discardPile.length}
                <small>枚</small>
              </b>
            </span>
          </button>
          <button
            className="pile-button pile-button--minor"
            data-battle-pile="exhaustPile"
            onClick={() => onOpenPile('exhaustPile')}
            aria-label={`廃棄札を確認、${state.exhaustPile.length}枚`}
          >
            <Icon name="flame" size={18} />
            <span>
              廃棄<b>{state.exhaustPile.length}</b>
            </span>
          </button>
          {state.powers.length > 0 && (
            <button
              className="pile-button pile-button--minor"
              data-battle-pile="powers"
              onClick={() => onOpenPile('powers')}
              aria-label={`発動中のパワー、${state.powers.length}枚`}
            >
              <Icon name="sun" size={18} />
              <span>
                パワー<b>{state.powers.length}</b>
              </span>
            </button>
          )}
        </div>
        <div className="jitto-control">
          <div className="jitto-label">
            <span>
              <Icon name="sun" size={15} /> じっとゲージ
            </span>
            <b>
              {state.jitto}
              <small>/100</small>
            </b>
          </div>
          <div
            className="jitto-track"
            role="progressbar"
            aria-label="じっとゲージ"
            aria-valuenow={state.jitto}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${state.jitto}%` }} />
            <i className="gauge-mark" style={{ left: '50%' }} />
            <i className="gauge-mark" style={{ left: '99%' }} />
          </div>
          <div className="jitto-milestones">
            <span className={state.jitto >= 50 ? 'milestone-active' : ''}>50 · 防御 +2</span>
            <span className={divine ? 'milestone-active' : ''}>100 · 神格化</span>
          </div>
        </div>
        <div className="turn-controls">
          <div className="energy">
            <span className={`energy-orb ${state.energy === 0 ? 'energy-empty' : ''}`}>
              <Icon name="bolt" size={19} />
              <b>{state.energy}</b>
            </span>
            <div>
              <span>エナジー</span>
              <small>毎ターン {state.maxEnergy} 回復</small>
            </div>
          </div>
          <StarEnergyHud state={state} />
          <button
            className="end-turn-button"
            onClick={onEndTurn}
            disabled={resolving || state.phase !== 'player' || !!state.pendingChoice}
          >
            {resolving ? '演出中…' : 'ターン終了'}
            <span>
              <kbd>E</kbd>
              <Icon name="chevron" size={17} />
            </span>
          </button>
        </div>
      </section>

      <BattleHand state={state} disabled={resolving} onPlay={onPlay} settings={presentation?.settings} />

      <footer className="battle-footer">
        <button
          className={`battle-log-toggle ${logOpen ? 'active' : ''}`}
          onClick={() => setLogOpen(!logOpen)}
          aria-expanded={logOpen}
        >
          <span className="log-indicator" />
          <span>{lastLog?.text ?? '静寂の門が、開いた。'}</span>
          <Icon name="chevron" size={14} />
        </button>
        <span
          className="seed-display"
          title={`このシードで同じ初期状態を再現できます：${state.seed}`}
        >
          SEED <b>{state.seed}</b>
        </span>
        <span className="autosave-label">
          <span />
          自動保存
        </span>
      </footer>
      {logOpen && (
        <div className="battle-log-panel" role="region" aria-label="戦闘ログ">
          <header>
            <h3>戦いの記録</h3>
            <button
              className="icon-button"
              aria-label="戦闘ログを閉じる"
              onClick={() => setLogOpen(false)}
            >
              <Icon name="close" size={16} />
            </button>
          </header>
          <ol>
            {[...state.log]
              .reverse()
              .slice(0, 35)
              .map((entry) => (
                <li key={entry.id} className={`log-${entry.kind}`}>
                  <span>T{entry.turn}</span>
                  {entry.text}
                </li>
              ))}
          </ol>
        </div>
      )}

      <div className="screen-reader-only" aria-live="polite" aria-atomic="true">
        {lastLog?.text} エナジー{state.energy}。自分のHP{state.player.hp}。生存している敵
        {enemies.filter((actor) => actor.hp > 0).length}体 。じっとゲージ{state.jitto}。
      </div>

      {inspectedEnemy && <Modal title={inspectedEnemy.name} subtitle="敵の特徴と行動" onClose={() => setInspectedEnemyId(null)} className="enemy-detail-modal">
        <p className="modal-intro">{inspectedDefinition?.description ?? '塔を守る敵です。行動予告を確認して戦いましょう。'}</p>
        {inspectedDefinition?.gimmick && <p className="enemy-detail-gimmick">{inspectedDefinition.gimmick}</p>}
        {inspectedEnemy.intentPhase !== undefined && <p className="enemy-detail-gimmick">行動パターンが変化しています。</p>}
        <HealthBar actor={inspectedEnemy} />
        <StatusChips actor={inspectedEnemy} />
        <div className="enemy-detail-intent"><b>次の行動：{getDisplayedEnemyIntent(inspectedEnemy).label}</b><p>{getDisplayedEnemyIntent(inspectedEnemy).description}</p>{getDisplayedEnemyIntent(inspectedEnemy).damage !== undefined && <p>現在の攻撃予測：{predictEnemyDamage(state, getEnemyKey(inspectedEnemy))}ダメージ × {getDisplayedEnemyIntent(inspectedEnemy).hits ?? 1}回（ブロック軽減前）</p>}{intentExtras(getDisplayedEnemyIntent(inspectedEnemy)) && <p>{intentExtras(getDisplayedEnemyIntent(inspectedEnemy))}</p>}</div>
        <button className="secondary-button" onClick={() => setInspectedEnemyId(null)}>戦闘に戻る</button>
      </Modal>}

      {state.pendingChoice && !presentation?.busy && <Modal title={getPendingChoiceLabel(state)} subtitle="CHOOSE YOUR CARDS" onClose={keepChoiceOpen} dismissible={false} wide className="card-choice-modal">
        <p className="modal-intro">カードを選び、確定すると効果の続きを解決します。{state.pendingChoice.mode === 'exhaust' ? '廃棄したカードは、この戦闘では山札に戻りません。' : state.pendingChoice.mode === 'topdeck' ? '選んだカードを山札の一番上へ戻します。次のドローで先に引きます。' : state.pendingChoice.mode === 'retrieve' ? state.pendingChoice.sourceZone === 'drawPile' ? '選んだ山札のカードを手札に加えます。山札の残りの順序は変えません。' : '選んだ捨て札を手札に戻します。' : '捨てたカードは捨て札に移ります。'}</p>
        <div className="pending-choice-grid choice-card-grid">
          {getPendingChoiceCards(state).map((card) => {
            const selected = chosenCards.includes(card.uid);
            return <ChoiceCard key={card.uid} className="pending-card-choice" card={card} selected={selected}
              disabled={!selected && chosenCards.length >= state.pendingChoice!.amount}
              selectionLabel={state.pendingChoice!.mode === 'discard' ? '捨てる対象' : state.pendingChoice!.mode === 'exhaust' ? '廃棄する対象' : state.pendingChoice!.mode === 'topdeck' ? '山札に戻す対象' : '手札に加える対象'}
              onSelect={() => setChosenCards((current) => selected ? current.filter((id) => id !== card.uid) : [...current, card.uid])} />;
          })}
        </div>
        <div className="pending-choice-confirm"><span>選択 {chosenCards.length} / {state.pendingChoice.amount}枚</span><button className="primary-button" disabled={chosenCards.length !== state.pendingChoice.amount} onClick={() => onChooseCards?.(chosenCards)}>選択を確定して続ける <Icon name="arrow" size={16} /></button></div>
      </Modal>}

      {!campaign && !presentation?.busy && state.phase !== 'player' && (
        <Modal
          title={state.phase === 'victory' ? '教えは、岩をも砕く。' : '8時か、ねんねやな。'}
          subtitle={state.phase === 'victory' ? 'VICTORY · 試練突破' : 'DEFEAT · また、じっと。'}
          onClose={onTitle}
          className={`result-modal result-${state.phase}`}
        >
          <div className="result-emblem">
            <Icon name={state.phase === 'victory' ? 'sun' : 'mountain'} size={61} />
          </div>
          <p className="result-quote">
            {state.phase === 'victory'
              ? '「ほいっと〜。これが、じっと教の力や。」'
              : '岩は砕けても、意志は砕けない。'}
          </p>
          <div className="result-stats">
            <span>
              <b>{state.turn}</b>ターン
            </span>
            <span>
              <b>{state.stats.cardsPlayed}</b>使用カード
            </span>
            <span>
              <b>{state.stats.damageDealt}</b>与ダメージ
            </span>
          </div>
          <p className="result-note">
            Phase 1の試練はここまで。
            <br />
            別の手札で、もう一度じっとを極めよう。
          </p>
          <button className="primary-button" onClick={onRestart}>
            新しい戦闘へ
            <Icon name="arrow" size={19} />
          </button>
          <div className="result-secondary">
            <button className="text-button" onClick={onReplay}>
              <Icon name="repeat" size={15} />
              同じシードで再挑戦
            </button>
            <button className="text-button" onClick={onTitle}>
              タイトルへ
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

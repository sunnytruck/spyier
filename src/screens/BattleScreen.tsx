import { useEffect, useState } from 'react';
import type { Actor, CombatState, EnemyState, GameSettings } from '../types/game';
import type { CombatCue } from '../presentation/types';
import { getEnemies, getEnemyKey, predictEnemyDamage } from '../engine';
import { Icon } from '../components/Icon';
import { CardView } from '../components/CardView';
import { BattleHand } from '../components/BattleHand';
import { Modal } from '../components/Modal';
import { RockDeity, StoneSentinel } from '../components/CharacterArt';
import { CLASS_DEFINITIONS } from '../data/classes';
import { BattleEffects } from '../components/BattleEffects';
import { CardFlights } from '../components/CardFlights';

type Pile = 'drawPile' | 'discardPile' | 'exhaustPile' | 'powers';
const keepChoiceOpen = () => {};
interface BattleProps {
  state: CombatState;
  resolving: boolean;
  onPlay: (uid: string, targetId?: string) => boolean | void;
  onSelectEnemy?: (targetId: string) => void;
  campaign?: boolean;
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

function StatusChips({ actor, stillness = 0 }: { actor: Actor; stillness?: number }) {
  const statuses = [
    {
      value: actor.strength,
      symbol: '↑',
      label: '筋力',
      detail: `攻撃1ヒットにつきダメージ+${actor.strength}。`,
      color: 'strength',
    },
    {
      value: actor.weak,
      symbol: '↘',
      label: '弱体',
      detail: '攻撃ダメージが0.75倍。対象のターン終了時に1減少。',
      color: 'weak',
    },
    {
      value: actor.vulnerable,
      symbol: '◇',
      label: '脆弱',
      detail: '受ける攻撃ダメージが1.5倍。対象のターン終了時に1減少。',
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
  ].filter((status) => status.value > 0);
  return (
    <div className="status-chips">
      {statuses.map((status) => (
        <span
          key={status.label}
          className={`status-chip status-${status.color}`}
          title={`${status.label} ${status.value}：${status.detail}`}
          tabIndex={0}
          aria-label={`${status.label} ${status.value}：${status.detail}`}
        >
          <span>{status.symbol}</span>
          <b>{status.value}</b>
          <span className="tooltip">
            {status.label} {status.value}
            <small>{status.detail}</small>
          </span>
        </span>
      ))}
    </div>
  );
}

function HealthBar({ actor, player = false }: { actor: Actor; player?: boolean }) {
  return (
    <div className={`health-info ${player ? 'health-info--player' : ''}`}>
      <div className="actor-name">
        <span>{player ? 'じっと教 教祖' : '塔の守り手'}</span>
        <h2>{actor.name}</h2>
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
          <span className="health-trail" style={{ width: `${Math.max(0, actor.hp / actor.maxHp) * 100}%` }} />
          <span className="health-fill" style={{ width: `${Math.max(0, actor.hp / actor.maxHp) * 100}%` }} />
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
  floor,
  presentation,
}: BattleProps) {
  const [logOpen, setLogOpen] = useState(false);
  const [chosenCards, setChosenCards] = useState<string[]>([]);
  const [fallenActors, setFallenActors] = useState<Set<string>>(() => new Set());
  const divine = state.jitto === 100;
  const lastLog = state.log[state.log.length - 1];
  const enemies = getEnemies(state);
  const multiple = enemies.length > 1;
  const enemy = enemies[0];
  const selectedId =
    state.selectedEnemyId ?? getEnemyKey(enemies.find((actor) => actor.hp > 0) ?? enemy);
  const damage = predictEnemyDamage(state, getEnemyKey(enemy));
  const intentDescription =
    enemy.intent.damage !== undefined
      ? `${damage}ダメージ${(enemy.intent.hits ?? 1) > 1 ? `を${enemy.intent.hits}回` : ''}。現在の筋力・弱体・脆弱を反映した予測値。ブロックで軽減できます。`
      : enemy.intent.description;
  const intentIcon =
    enemy.intent.damage !== undefined
      ? 'sword'
      : enemy.intent.kind === 'defend'
        ? 'shield'
        : enemy.intent.kind === 'buff'
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
      className={`battle-screen cinematic-battle ${presentation?.settings.reducedMotion || presentation?.settings.speed === 'instant' ? 'motion-reduced' : ''} ${presentation?.settings.speed === 'fast' ? 'presentation-fast' : ''} ${divine ? 'is-divine' : ''} ${resolving ? 'is-presenting' : ''} ${multiple ? 'multi-enemy' : ''} ${campaign ? 'campaign-battle' : ''}`}
    >
      {presentation && <CardFlights {...presentation} />}
      <section className="battle-heading">
        <div>
          <p className="eyebrow">
            <span className="gold-line" /> {campaign ? `第1階層 · ${floor}F` : '単体戦闘の練習'}{' '}
            <span className="eyebrow-separator">/</span>{' '}
            {floor === 12 ? '静寂の頂' : 'じっと教の塔'}
          </p>
          <h1>岩の意志を、示せ。</h1>
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

      {state.classId && state.classResources && <section className="class-combat-resources" aria-label="職業固有リソース">
        <span className="class-resource-name">{CLASS_DEFINITIONS[state.classId].glyph} {CLASS_DEFINITIONS[state.classId].displayName}</span>
        {state.classId === 'berserker' && <span title="筋力は攻撃1ヒットごとのダメージに加算されます。">筋力 <b>{state.player.strength}</b> <small>HPの消費も力に変える</small></span>}
        {state.classId === 'assassin' && <span title="ナイフは生成カードです。使用すると廃棄され、戦闘終了後はデッキに残りません。">ナイフ強化 <b>+{state.powerStacks?.knifeDamage ?? 0}</b> <small>毒・ドロー・連撃</small></span>}
        {state.classId === 'oracle' && <><span title="星はカード効果で獲得する、この職業のリソースです。">✦ 星 <b>{state.classResources.stars}</b></span><span>今ターンの✦ <b>{state.classResources.starsGainedThisTurn}</b></span><span title="鍛造は聖剣のダメージを強化します。">鍛造 <b>{state.classResources.forge}</b></span></>}
        {state.classId === 'necromancer' && <span title="召喚カードでオスティのHPを増やします。HPが0の間は、オスティによる攻撃は発動しません。">岩霊オスティ HP <b>{state.classResources.ostyHp}</b> <small>召喚・破滅・ソウル</small></span>}
        {state.classId === 'machinist' && <><span title="集中力はライトニングとフロストの効果量を増減します。一時集中力はターン終了時に失われます。">集中力 <b>{state.classResources.focus}</b></span><span className="orb-resource-list" title="オーブは最大3個。上限を超えると右端を解放します。">オーブ {state.classResources.orbs.length ? state.classResources.orbs.map((orb, index) => <b className={`orb-resource orb-${orb}`} key={index}>{orb === 'lightning' ? '⚡' : '❄'}</b>) : <small>なし</small>}</span></>}
        {state.classResources.nextTurnEnergy > 0 && <span>次ターン ⚡+{state.classResources.nextTurnEnergy}</span>}
      </section>}

      <section className="battle-arena" aria-label="戦闘フィールド">
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
            <StatusChips actor={state.player} stillness={state.stillness} />
            {divine && (
              <span className="divine-tag">
                <Icon name="sun" size={13} />
                神格化
              </span>
            )}
          </div>
          <div className="character-stage">
            <div className="character-shadow" />
            <div className="actor-motion" data-battle-actor="player" data-fallen={fallenActors.has('player') || undefined}><RockDeity deified={divine} /></div>
            {state.player.block > 0 && <div className="block-aura" aria-hidden="true" />}
          </div>
          <HealthBar actor={state.player} player />
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
              const selected = selectedId === enemyId;
              const dead = actor.hp <= 0;
              return (
                <div
                  className={`formation-enemy enemy-tone-${index} ${dead ? 'enemy-defeated' : ''} ${selected ? 'enemy-selected' : ''}`}
                  key={enemyId}
                >
                  <div
                    className={`enemy-intent intent-${actor.intent.kind}`}
                    title={
                      actor.intent.damage !== undefined
                        ? `${incoming}ダメージ × ${actor.intent.hits ?? 1}。筋力・状態異常を反映、ブロックで軽減。`
                        : actor.intent.description
                    }
                    tabIndex={0}
                  >
                    <span className="intent-icon">
                      <Icon
                        name={
                          actor.intent.damage !== undefined
                            ? 'sword'
                            : actor.intent.kind === 'defend'
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
                      <b>{dead ? '撃破' : actor.intent.label}</b>
                      <small>
                        {dead
                          ? '行動しません'
                          : actor.intent.damage !== undefined
                            ? `${incoming}${(actor.intent.hits ?? 1) > 1 ? ` × ${actor.intent.hits}` : ''} ダメージ`
                            : actor.intent.description}
                      </small>
                    </div>
                  </div>
                  <div className="actor-status enemy-status">
                    <StatusChips actor={actor} />
                  </div>
                  <button
                    className={`character-stage enemy-target ${selected ? 'is-targeted' : ''}`}
                    data-enemy-id={enemyId}
                    disabled={dead || resolving}
                    aria-pressed={selected}
                    aria-label={`攻撃対象に選択：${actor.name} ${index + 1}`}
                    onClick={() => onSelectEnemy?.(enemyId)}
                  >
                    <div className="character-shadow" />
                    <div className="actor-motion" data-battle-actor={enemyId} data-fallen={fallenActors.has(enemyId) || undefined}><StoneSentinel /></div>
                    <span className="target-label">
                      {dead ? '撃破' : selected ? '選択中' : 'クリックで選択'}
                    </span>
                  </button>
                  <HealthBar actor={actor} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="combatant combatant--enemy">
            <div
              className={`enemy-intent intent-${enemy.intent.kind}`}
              title={intentDescription}
              tabIndex={0}
            >
              <span className="intent-icon">
                <Icon name={intentIcon} size={22} />
              </span>
              <div>
                <span className="intent-eyebrow">NEXT · 敵の行動予告</span>
                <b>{enemy.intent.label}</b>
                <small>
                  {enemy.intent.damage !== undefined ? (
                    <>
                      <strong>
                        {damage}
                        {(enemy.intent.hits ?? 1) > 1 ? ` × ${enemy.intent.hits}` : ''}
                      </strong>{' '}
                      ダメージ{enemy.intent.weak ? ` / 弱体${enemy.intent.weak}` : ''}
                    </>
                  ) : (
                    enemy.intent.description
                  )}
                </small>
              </div>
            </div>
            <div className="actor-status enemy-status">
              <StatusChips actor={enemy} />
            </div>
            <button
              className={`character-stage enemy-target ${selectedId === getEnemyKey(enemy) ? 'is-targeted' : ''}`}
              data-enemy-id={getEnemyKey(enemy)}
              onClick={() => onSelectEnemy?.(getEnemyKey(enemy))}
              disabled={resolving || enemy.hp <= 0}
              aria-pressed={selectedId === getEnemyKey(enemy)}
              aria-label={`攻撃対象に選択：${enemy.name}`}
            >
              <div className="character-shadow" />
              <div className="actor-motion" data-battle-actor={getEnemyKey(enemy)} data-fallen={fallenActors.has(getEnemyKey(enemy)) || undefined}><StoneSentinel /></div>
              <span className="target-label">選択中</span>
            </button>
            <HealthBar actor={enemy} />
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

      {state.pendingChoice && !presentation?.busy && <Modal title={`手札から${state.pendingChoice.amount}枚${state.pendingChoice.mode === 'discard' ? '捨てる' : '廃棄する'}`} subtitle="CHOOSE YOUR CARDS" onClose={keepChoiceOpen} dismissible={false} wide>
        <p className="modal-intro">カードを選び、確定すると効果の続きを解決します。{state.pendingChoice.mode === 'exhaust' ? '廃棄したカードは、この戦闘では山札に戻りません。' : '捨てたカードは捨て札に移ります。'}</p>
        <div className="pending-choice-grid">
          {state.hand.map((card) => {
            const selected = chosenCards.includes(card.uid);
            return <div className={`pending-card-choice ${selected ? 'is-selected' : ''}`} key={card.uid}>
              <CardView card={card} inspect />
              <button className="secondary-button" aria-pressed={selected} disabled={!selected && chosenCards.length >= state.pendingChoice!.amount} onClick={() => setChosenCards((current) => selected ? current.filter((id) => id !== card.uid) : [...current, card.uid])}>{selected ? '✓ 選択中・解除する' : 'このカードを選ぶ'}</button>
            </div>;
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

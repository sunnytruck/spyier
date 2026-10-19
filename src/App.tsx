import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CardInstance, ClassId, CombatAction, CombatState, GameSettings } from './types/game';
import type { RunAction, RunState } from './types/run';
import { createRun, reduceRun } from './engine/run';
import { loadRun, saveRun, clearRun, getRunSaveWarning } from './engine/runPersistence';
import { RELIC_DEFINITIONS } from './data/relics';
import { RunHud } from './components/RunHud';
import { RunScreens } from './screens/RunScreens';
import { createCombat, reduceCombat } from './engine';
import {
  clearGame,
  getSaveWarning,
  loadGame,
  loadSettings,
  saveGame,
  saveSettings,
} from './engine/persistence';
import { CLASS_IDS } from './data/classes';
import { ClassSelectionScreen } from './screens/ClassSelectionScreen';
import { Icon } from './components/Icon';
import { CardView } from './components/CardView';
import { Modal } from './components/Modal';
import { RockDeity } from './components/CharacterArt';
import { BattleScreen } from './screens/BattleScreen';
import { captureCombatTransition } from './presentation/trace';
import { useBattlePresentation } from './presentation/useBattlePresentation';
import { useReducedMotion } from './presentation/useReducedMotion';
import type { CombatCue } from './presentation/types';
import './styles/game.css';
import './styles/campaign.css';
import './styles/class-system.css';
import './styles/readability.css';
import './styles/expansion.css';

const CardLibrary = lazy(() => import('./components/CardLibrary').then((module) => ({ default: module.CardLibrary })));

type ModalName =
  | 'help'
  | 'settings'
  | 'library'
  | 'drawPile'
  | 'discardPile'
  | 'exhaustPile'
  | 'powers'
  | 'deck'
  | 'relics'
  | null;

function freshSeed() {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return `IWASON-${buffer[0].toString(36).toUpperCase()}`;
}

export default function App() {
  const [practice, setPractice] = useState<CombatState | null>(() => loadGame());
  const [run, setRun] = useState<RunState | null>(() => loadRun());
  const [screen, setScreen] = useState<'title' | 'classes' | 'battle' | 'run'>(() => (run ? 'run' : 'title'));
  const combat = screen === 'run' ? (run?.combat ?? null) : practice;
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [modal, setModal] = useState<ModalName>(null);
  const [sessionId, setSessionId] = useState(0);
  const [seed, setSeed] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<ClassId>(CLASS_IDS[0]);
  const [storageWarning, setStorageWarning] = useState<string | null>(
    () => getRunSaveWarning() ?? getSaveWarning(),
  );
  const actionLocked = useRef(false);
  const systemReducedMotion = useReducedMotion();
  const motionSettings = useMemo(() => ({ ...settings, reducedMotion: settings.reducedMotion || systemReducedMotion }), [settings, systemReducedMotion]);
  const presentation = useBattlePresentation(motionSettings);
  const { play: playPresentation, cancel: cancelPresentation } = presentation;
  const resolving = presentation.busy;
  const shownCombat = presentation.displayState ?? combat;
  const latest = useRef({ run, practice, screen, modal });
  latest.current = { run, practice, screen, modal };
  const closeModal = useCallback(() => setModal(null), []);

  useEffect(() => {
    if (practice) {
      saveGame(practice);
      setStorageWarning(getRunSaveWarning() ?? getSaveWarning());
    }
  }, [practice]);
  useEffect(() => {
    if (run) {
      saveRun(run);
      setStorageWarning(getRunSaveWarning() ?? getSaveWarning());
    }
  }, [run]);
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const showEntrance = useCallback((state: CombatState) => {
    const opening = { ...state, hand: [], drawPile: [...state.drawPile, ...state.hand] };
    actionLocked.current = true;
    playPresentation(opening, [{ kind: 'draw', sourceId: 'player', targetId: 'player', cards: state.hand,
      fromZone: 'drawPile', toZone: 'hand', label: '最初の手札', frame: state }], state,
      () => { actionLocked.current = false; });
  }, [playPresentation]);

  function startGame(sameSeed?: string) {
    cancelPresentation();
    actionLocked.current = false;
    const next = createCombat(sameSeed ?? (seed.trim() || freshSeed()));
    latest.current.practice = next;
    setPractice(next);
    saveGame(next);
    setSessionId((current) => current + 1);
    setScreen('battle');
    setModal(null);
    showEntrance(next);
  }

  function startRun(sameSeed?: string, classId?: ClassId) {
    cancelPresentation();
    actionLocked.current = false;
    const next = createRun(sameSeed ?? (seed.trim() || freshSeed()), classId);
    latest.current.run = next;
    setRun(next);
    setSessionId((current) => current + 1);
    setScreen('run');
    setModal(null);
  }

  const dispatch = useCallback(
    (action: CombatAction) => {
      const current = latest.current;
      const before = current.screen === 'run' ? current.run?.combat : current.practice;
      if (!before || before.phase !== 'player' || actionLocked.current || current.modal || document.querySelector('.class-resource-modal')) return false;
      actionLocked.current = true;
      let after: CombatState;
      let cues: CombatCue[];
      if (current.screen === 'run' && current.run) {
        const transition = captureCombatTransition(before, () => reduceRun(current.run!, { type: 'combat', action }));
        if (transition.result === current.run) { actionLocked.current = false; return false; }
        latest.current.run = transition.result;
        setRun(transition.result);
        saveRun(transition.result);
        after = transition.result.combat!;
        cues = transition.cues;
      } else {
        const transition = captureCombatTransition(before, () => reduceCombat(before, action));
        if (transition.result === before) { actionLocked.current = false; return false; }
        latest.current.practice = transition.result;
        setPractice(transition.result);
        saveGame(transition.result);
        after = transition.result;
        cues = transition.cues;
      }
      // The authoritative result is already saved. Only its presentation is delayed.
      playPresentation(before, cues, after, () => { actionLocked.current = false; });
      return true;
    },
    [playPresentation],
  );

  const dispatchRun = useCallback((action: RunAction) => {
    if (action.type === 'combat') { dispatch(action.action); return; }
    if (action.type === 'usePotion') {
      dispatch({ type: 'usePotion', slot: action.slot, targetId: action.targetId }); return;
    }
    if (actionLocked.current) return;
    const current = latest.current.run;
    if (!current) return;
    const next = reduceRun(current, action);
    if (next === current) return;
    latest.current.run = next;
    setRun(next);
    saveRun(next);
    if (next.screen === 'combat' && current.screen !== 'combat' && next.combat) showEntrance(next.combat);
  }, [dispatch, showEntrance]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.repeat ||
        document.querySelector('[role="dialog"]') ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
        target.isContentEditable ||
        modal ||
        (screen !== 'battle' && !(screen === 'run' && run?.screen === 'combat')) ||
        combat?.phase !== 'player'
      )
        return;
      if (event.key.toLowerCase() === 'e') {
        event.preventDefault();
        dispatch({ type: 'endTurn' });
      }
      const index = Number(event.key) - 1;
      if (index >= 0 && index < 5 && combat.hand[index]) {
        event.preventDefault();
        dispatch({
          type: 'playCard',
          cardId: combat.hand[index].uid,
          targetId: combat.selectedEnemyId,
        });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combat, dispatch, modal, screen, run?.screen]);

  const pileLabels = {
    drawPile: '山札',
    discardPile: '捨て札',
    exhaustPile: '廃棄札',
    powers: '発動中のパワー',
  };
  const isPileModal =
    modal === 'drawPile' ||
    modal === 'discardPile' ||
    modal === 'exhaustPile' ||
    modal === 'powers';
  const pileCards: CardInstance[] = shownCombat && isPileModal ? shownCombat[modal] : [];
  const shownRun = run && presentation.displayState
    ? { ...run, screen: 'combat' as const, hp: presentation.displayState.player.hp, combat: presentation.displayState }
    : run;

  return (
    <div
      className={`app ${motionSettings.reducedMotion ? 'reduced-motion' : ''} speed-${settings.speed} effects-${settings.effectsQuality ?? 'auto'}`}
    >
      <header className="topbar">
        <button
          className="brand"
          onClick={() => {
            if (!resolving) setScreen('title');
          }}
          aria-label="タイトル画面へ"
        >
          <span className="brand-mark">
            <Icon name="mountain" size={29} />
          </span>
          <span className="brand-title">
            IWASON <b>SPIRE</b>
            <small>じっと教の塔</small>
          </span>
        </button>
        {screen === 'run' && shownRun ? (
          <RunHud
            state={shownRun}
            disabled={resolving}
            onDeck={() => setModal('deck')}
            onRelics={() => setModal('relics')}
            onPotion={(slot) =>
              dispatchRun({ type: 'usePotion', slot, targetId: combat?.selectedEnemyId })
            }
          />
        ) : (
          <span className="prototype-label">
            <span /> ACT 1 <b>じっと教の塔</b>
          </span>
        )}
        <nav aria-label="メインメニュー">
          <button className="nav-button" aria-label="カード図鑑" onClick={() => setModal('library')}>
            <Icon name="book" size={17} />
            <span>カード図鑑</span>
          </button>
          <button className="nav-button" aria-label="遊び方" onClick={() => setModal('help')}>
            <Icon name="help" size={17} />
            <span>遊び方</span>
          </button>
          <button className="icon-button" onClick={() => setModal('settings')} aria-label="設定">
            <Icon name="gear" size={19} />
          </button>
        </nav>
      </header>

      {screen === 'title' ? (
        <main className="title-screen">
          <div className="title-copy">
            <p className="eyebrow">
              <span className="gold-line" /> じっとしているだけじゃ、終われない。
            </p>
            <h1>
              IWASON
              <br />
              <span>SPIRE</span>
            </h1>
            <p className="title-japanese">— じっと教の塔 —</p>
            <p className="title-description">
              岩の意志。手のひらの戦略。
              <br />
              教祖・岩尊けいとと、12階の試練へ。
            </p>
            <div className="title-actions">
              <button className="primary-button title-start" onClick={() => setScreen('classes')}>
                第1階層へ進む
                <Icon name="arrow" size={21} />
              </button>
              {run && (
                <button className="secondary-button" onClick={() => setScreen('run')}>
                  <Icon name="repeat" size={17} />
                  探索を再開 · {run.floor}F / 12F
                </button>
              )}
              <button className="practice-start text-button" onClick={() => startGame()}>
                単体戦闘で練習 <Icon name="arrow" size={15} />
              </button>
              {practice && (
                <button className="text-button practice-resume" onClick={() => setScreen('battle')}>
                  前回の練習を再開 · {practice.turn}ターン目
                </button>
              )}
            </div>
            <label className="seed-field">
              <span>シード</span>
              <input
                value={seed}
                onChange={(event) => setSeed(event.target.value)}
                maxLength={64}
                placeholder="空欄なら、運命にまかせる"
                aria-label="新しい探索のシード"
              />
            </label>
            <div className="title-facts">
              <span>
                <b>5</b>つの職業
              </span>
              <span>
                <b>12</b>フロアの試練
              </span>
              <span>
                <Icon name="sun" size={22} />
                <b>100</b>で神格化
              </span>
            </div>
          </div>
          <div className="title-art">
            <div className="title-halo" />
            <span className="title-orbit title-orbit-one" />
            <span className="title-orbit title-orbit-two" />
            <p className="title-vertical">動かざること、岩のごとし。</p>
            <RockDeity />
            <div className="title-ground" />
            <div className="character-signature">
              <span>じっと教 教祖</span>
              <b>岩尊けいと</b>
              <small>「ほいっと〜」</small>
            </div>
          </div>
          <div className="title-footer">
            <span>
              <i /> ACT 1 — じっと教の塔
            </span>
            <span>デッキを育て、分岐を選び、塔のボスを打ち砕こう。</span>
            <button onClick={() => setModal('help')}>
              最初の教え
              <Icon name="arrow" size={16} />
            </button>
          </div>
        </main>
      ) : screen === 'classes' ? (
        <ClassSelectionScreen selected={selectedClassId} onSelect={setSelectedClassId}
          onStart={() => startRun(undefined, selectedClassId)} onBack={() => setScreen('title')} />
      ) : screen === 'run' && run && run.screen !== 'combat' && !resolving ? (
        <RunScreens
          state={run}
          onAction={dispatchRun}
          onNewRun={() => { if (run.classId) setSelectedClassId(run.classId); setSeed(''); setScreen('classes'); }}
          onReplay={() => startRun(run.seed, run.classId)}
          onTitle={() => setScreen('title')}
        />
      ) : shownCombat ? (
        <BattleScreen
          key={`${sessionId}-${screen === 'run' ? run?.currentNodeId : 'practice'}`}
          state={shownCombat}
          campaign={screen === 'run'}
          floor={screen === 'run' ? run?.floor : undefined}
          resolving={resolving}
          presentation={{ cue: presentation.activeCue, sequence: presentation.activeSequence,
            duration: presentation.activeDuration, settings: motionSettings, skip: presentation.skip, busy: resolving }}
          onPlay={(cardId, targetId) => dispatch({ type: 'playCard', cardId, targetId })}
          onSelectEnemy={(targetId) => dispatch({ type: 'selectEnemy', targetId })}
          onEndTurn={() => dispatch({ type: 'endTurn' })}
          onChooseCards={(cardIds) => dispatch({ type: 'chooseCards', cardIds })}
          onOpenPile={(pile) => setModal(pile)}
          onRestart={() => startGame(freshSeed())}
          onReplay={() => startGame(shownCombat.seed)}
          onTitle={() => setScreen('title')}
        />
      ) : null}

      {storageWarning && (
        <div className="storage-warning" role="status">
          {storageWarning}
        </div>
      )}

      {modal === 'settings' && (
        <Modal title="ひと息、設定。" subtitle="SETTINGS" onClose={closeModal}>
          <div className="settings-content">
            <div className="setting-row">
              <div>
                <h3>戦闘の速度</h3>
                <p>ターン終了とカードの演出時間を調整します。</p>
              </div>
              <div className="segmented-control">
                {(['normal', 'fast', 'instant'] as const).map((speed) => (
                  <button
                    key={speed}
                    className={settings.speed === speed ? 'active' : ''}
                    aria-pressed={settings.speed === speed}
                    onClick={() => setSettings((current) => ({ ...current, speed }))}
                  >
                    {speed === 'normal' ? 'ふつう' : speed === 'fast' ? 'はやい' : '即時'}
                  </button>
                ))}
              </div>
            </div>
            <div className="setting-row">
              <div>
                <h3>演出の負荷</h3>
                <p>軽量では粒子数と描画解像度を抑えます。戦闘の結果は変わりません。</p>
              </div>
              <div className="segmented-control" aria-label="演出品質">
                {(['auto', 'full', 'low'] as const).map((quality) => (
                  <button key={quality} aria-pressed={(settings.effectsQuality ?? 'auto') === quality}
                    className={(settings.effectsQuality ?? 'auto') === quality ? 'active' : ''}
                    onClick={() => setSettings((current) => ({ ...current, effectsQuality: quality }))}>
                    {quality === 'auto' ? '自動' : quality === 'full' ? '標準' : '軽量'}
                  </button>
                ))}
              </div>
            </div>
            <label className="setting-row">
              <div>
                <h3>アニメーションを短縮</h3>
                <p>揺れ・拡大・浮遊演出を抑え、即時に進行します。</p>
              </div>
              <input
                className="toggle-input"
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, reducedMotion: event.target.checked }))
                }
              />
            </label>
            <div className="save-info">
              <Icon name="shield" size={20} />
              <div>
                <b>探索・戦闘は自動保存されます</b>
                <p>各操作後に、このブラウザへ保存します。画面・敵・手札もそのまま再開します。</p>
              </div>
            </div>
            {(practice || run) && (
              <button
                className="text-button danger-text"
                onClick={() => {
                  cancelPresentation();
                  actionLocked.current = false;
                  clearGame();
                  clearRun();
                  setPractice(null);
                  setRun(null);
                  setScreen('title');
                  setModal(null);
                }}
              >
                探索・練習データを削除してタイトルへ
              </button>
            )}
          </div>
        </Modal>
      )}

      {modal === 'help' && (
        <Modal title="最初の教え" subtitle="HOW TO PLAY" onClose={closeModal} wide>
          <div className="help-grid">
            <article>
              <span className="help-number">01</span>
              <h3>カードで、ほいっと。</h3>
              <p>
                カードはクリック、または対象へドラッグして使用します。左上の数字だけエナジーを消費します。攻撃や毒のカードは敵へ、防御などはフィールドへ放してください。無効な場所へ放すと消費せず戻ります。
              </p>
              <small>
                <kbd>1</kbd>〜<kbd>5</kbd> 手札を使用
              </small>
            </article>
            <article>
              <span className="help-number">02</span>
              <h3>予告を見て、じっと。</h3>
              <p>
                敵の次の行動は頭上に表示。ブロックで攻撃を受け止めましょう。ブロックは自分の次のターンに消えます。
              </p>
              <small>
                <kbd>E</kbd> ターン終了
              </small>
            </article>
            <article>
              <span className="help-number">03</span>
              <h3>信仰をためて、神へ。</h3>
              <p>
                カードの効果でじっとゲージが増減。50以上で防御カードのブロック+2。100で神格化し、専用カードが強化されます。
              </p>
              <small>ターン経過だけでは増えません</small>
            </article>
            <article>
              <span className="help-number">04</span>
              <h3>手札は、めぐる。</h3>
              <p>
                毎ターン、エナジー3・手札5枚。手札はターン終了時に捨て札へ。山札が尽きたら捨て札をシャッフルします。
              </p>
              <small>パワーカードは戦闘中ずっと有効</small>
            </article>
          </div>
          <div className="status-guide">
            <h3>塔の歩きかた</h3>
            <p>
              マップでは、線でつながった次の階のノードだけ選択できます。戦闘の報酬でカードを増やし、商人で購入・除去、休憩所でHP回復か1枚強化。12Fのボスを倒せば第1階層クリアです。画面上部からデッキ・レリックを確認でき、ポーションは戦闘中に使用できます。対象を選ぶポーションは、敵を先にクリックしてください。
            </p>
            <h3 style={{ marginTop: 15 }}>状態異常の読みかた</h3>
            <p>
              <b>筋力</b>：攻撃ごとにダメージ加算　<b>弱体</b>：与える攻撃ダメージ×0.75　<b>脆弱</b>
              ：受ける攻撃ダメージ×1.5　<b>毒</b>
              ：対象のターン開始時にブロックを無視してダメージ、その後1減少。弱体・脆弱は対象のターン終了時に1減少します。
            </p>
          </div>
          <button className="primary-button modal-primary" onClick={closeModal}>
            わかった、ほいっと〜
            <Icon name="arrow" size={18} />
          </button>
        </Modal>
      )}

      {modal === 'library' && (
        <Modal
          title="岩に刻まれた、教えの記録。"
          subtitle="CARD LIBRARY · ACT 1"
          onClose={closeModal}
          wide
        >
          <Suspense fallback={<p className="modal-intro" role="status">教えの記録を読み込み中…</p>}><CardLibrary /></Suspense>
        </Modal>
      )}

      {modal === 'deck' && (
        <Modal
          title={`あなたの教え · ${run?.deck.length ?? practice?.deck.length ?? 0}枚`}
          subtitle="YOUR DECK"
          onClose={closeModal}
          wide
        >
          <p className="modal-intro">
            ＋は強化済み。探索の報酬や商人で増やし、休憩所で強化できます。
          </p>
          <div className="pile-grid">
            {(run?.deck ?? practice?.deck ?? []).map((card) => (
              <CardView card={card} key={card.uid} state={shownCombat?.phase === 'player' ? shownCombat : undefined} inspect />
            ))}
          </div>
        </Modal>
      )}
      {modal === 'relics' && (
        <Modal
          title={`岩の遺物 · ${run?.relicIds.length ?? 0}個`}
          subtitle="YOUR RELICS"
          onClose={closeModal}
        >
          <div className="relic-collection">
            {run?.relicIds.map((id) => {
              const relic = RELIC_DEFINITIONS[id];
              return relic ? (
                <article key={id}>
                  <span>{relic.glyph}</span>
                  <div>
                    <h3>{relic.name}</h3>
                    <p>{relic.description}</p>
                  </div>
                </article>
              ) : null;
            })}
            {!run?.relicIds.length && (
              <p className="modal-intro">宝箱やエリート戦闘で、力を宿す遺物を集めましょう。</p>
            )}
          </div>
        </Modal>
      )}

      {isPileModal && (
        <Modal
          title={`${pileLabels[modal]} · ${pileCards.length}枚`}
          subtitle="YOUR CARDS"
          onClose={closeModal}
          wide
        >
          <p className="modal-intro">
            {modal === 'drawPile'
              ? '内容を一覧表示しています。表示順は次のドロー順を表しません。'
              : modal === 'powers'
                ? '戦闘が終わるまで効果が続きます。'
                : modal === 'discardPile'
                  ? '山札がなくなると、このカードをシャッフルして山札に戻します。'
                  : 'この戦闘では、もう山札に戻りません。'}
          </p>
          {pileCards.length ? (
            <div className="pile-grid">
              {[...pileCards]
                .sort((a, b) => a.cardId.localeCompare(b.cardId))
                .map((card) => (
                  <CardView key={card.uid} card={card} state={shownCombat ?? undefined} inspect />
                ))}
            </div>
          ) : (
            <div className="empty-pile">
              <Icon name={modal === 'exhaustPile' ? 'flame' : 'cards'} size={40} />
              <h3>まだ、ここには何も。</h3>
              <p>岩もカードも、焦らずじっと。</p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { CARD_DEFINITIONS } from '../data/cards';
import { canPlayCard, getEnemies, getEnemyKey } from '../engine';
import { cardTargetMode, resolveCardDrop } from '../presentation/targeting';
import { getHandPreviewBounds } from '../presentation/handLayout';
import type { CardDropResult } from '../presentation/targeting';
import type { CardInstance, CombatState, GameSettings } from '../types/game';
import { CardView } from './CardView';
import { Icon } from './Icon';
import '../styles/battle-hand.css';
import '../styles/art-cards.css';

interface BattleHandProps {
  state: CombatState;
  disabled: boolean;
  onPlay: (uid: string, targetId?: string) => boolean | void;
  settings?: GameSettings;
}

interface PointerSession {
  pointerId: number;
  uid: string;
  card: CardInstance;
  source: HTMLButtonElement;
  startX: number;
  startY: number;
  x: number;
  y: number;
  ghostX: number;
  ghostY: number;
  previousX: number;
  tilt: number;
  width: number;
  height: number;
  started: boolean;
  ghost: HTMLElement | null;
  frame: number;
  result: CardDropResult | null;
  highlight: Element | null;
  cleanListeners: () => void;
}

const DRAG_THRESHOLD = 7;

export function BattleHand({ state, disabled, onPlay, settings }: BattleHandProps) {
  const root = useRef<HTMLElement>(null);
  const cardsRoot = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const curve = useRef<SVGPathElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const session = useRef<PointerSession | null>(null);
  const latest = useRef({ state, disabled, onPlay, settings });
  latest.current = { state, disabled, onPlay, settings };
  const ghosts = useRef(new Set<HTMLElement>());
  const suppressClickUntil = useRef(0);
  const suppressedUid = useRef<string | null>(null);
  const [draggingUid, setDraggingUid] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ uid: string; pinned: boolean; anchor: DOMRect } | null>(null);
  const [scrollable, setScrollable] = useState(false);
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewPanel = useRef<HTMLDivElement>(null);
  const previewReturnFocus = useRef<HTMLElement | null>(null);
  const pointerType = useRef('mouse');
  const pointerOrigin = useRef({ x: 0, y: 0 });
  const previewCard = state.hand.find((card) => card.uid === preview?.uid);
  const markerId = `target-${useId().replace(/:/g, '')}`;
  const noMotion = settings?.reducedMotion || settings?.speed === 'instant';
  const fanHand = viewport.width >= 1100 && state.hand.length > 1 && state.hand.length <= 8;

  function cancelPreviewClose() {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = null;
  }

  function closePreview(restoreFocus = false) {
    cancelPreviewClose();
    setPreview(null);
    if (restoreFocus) previewReturnFocus.current?.focus({ preventScroll: true });
  }

  function showPreview(uid: string, source: HTMLElement, pinned = false) {
    if (session.current?.started || draggingUid || (preview?.pinned && !pinned)) return;
    cancelPreviewClose();
    if (pinned) previewReturnFocus.current = source;
    setPreview({ uid, pinned, anchor: source.getBoundingClientRect() });
  }

  function schedulePreviewClose() {
    cancelPreviewClose();
    previewTimer.current = setTimeout(() => setPreview((current) => current?.pinned ? current : null), 140);
  }

  function scrollHand(direction: number) {
    closePreview();
    const hand = cardsRoot.current;
    hand?.scrollBy({ left: direction * Math.max(160, hand.clientWidth * .65), behavior: noMotion ? 'instant' : 'smooth' });
  }

  function removeGhost(ghost: HTMLElement) {
    ghost.remove();
    ghosts.current.delete(ghost);
  }

  function makeGhost(source: HTMLElement) {
    const rect = source.getBoundingClientRect();
    const ghost = document.createElement('div');
    ghost.className = 'battle-card-ghost';
    if (source.closest('.compact-battle')) ghost.classList.add('is-compact-hand-card');
    if (latest.current.settings?.effectsQuality === 'low') ghost.classList.add('is-lightweight');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    const card = source.cloneNode(true) as HTMLElement;
    card.removeAttribute('data-card-uid');
    card.removeAttribute('aria-label');
    card.removeAttribute('disabled');
    card.setAttribute('tabindex', '-1');
    ghost.appendChild(card);
    document.body.appendChild(ghost);
    ghosts.current.add(ghost);
    return ghost;
  }

  function settleGhost(ghost: HTMLElement, source: HTMLElement, valid: boolean, target?: Element | null) {
    if (latest.current.settings?.reducedMotion || latest.current.settings?.speed === 'instant') {
      removeGhost(ghost);
      return;
    }
    const rect = (valid ? target : source)?.getBoundingClientRect() ?? source.getBoundingClientRect();
    const destination = valid
      ? `translate3d(${rect.left + rect.width / 2 - ghost.offsetWidth / 2}px, ${rect.top + rect.height / 2 - ghost.offsetHeight / 2}px, 0) rotate(8deg) scale(.42)`
      : `translate3d(${rect.left}px, ${rect.top}px, 0) rotate(0deg) scale(1)`;
    const animation = ghost.animate([
      { transform: ghost.style.transform, opacity: 1 },
      { transform: destination, opacity: valid ? 0 : 1 },
    ], {
      duration: latest.current.settings?.speed === 'fast' ? 110 : valid ? 180 : 240,
      easing: valid ? 'cubic-bezier(.25,.6,.3,1)' : 'cubic-bezier(.2,.85,.25,1)',
      fill: 'forwards',
    });
    void animation.finished.catch(() => {}).then(() => removeGhost(ghost));
  }

  function finishSession(cancelled: boolean, updateState = true) {
    const drag = session.current;
    if (!drag) return;
    session.current = null;
    drag.cleanListeners();
    cancelAnimationFrame(drag.frame);
    drag.highlight?.removeAttribute('data-card-drop');
    root.current?.closest('.battle-screen')?.removeAttribute('data-card-drag');
    if (overlay.current) overlay.current.style.opacity = '0';
    if (drag.source.hasPointerCapture(drag.pointerId)) drag.source.releasePointerCapture(drag.pointerId);
    if (updateState) setDraggingUid(null);
    if (!drag.started) return;
    // Browsers synthesize a click after pointerup even when the pointer was captured.
    suppressClickUntil.current = Date.now() + 550;
    suppressedUid.current = drag.uid;
    const snapshot = latest.current;
    const hit = hitTest(drag.x, drag.y);
    const drop = resolveCardDrop(snapshot.state, drag.card, hit.location);
    const valid = !cancelled && !snapshot.disabled && drop.valid;
    const accepted = valid && snapshot.onPlay(drag.uid, drop.targetId) !== false;
    if (drag.ghost) settleGhost(drag.ghost, drag.source, accepted, hit.element);
  }

  function hitTest(x: number, y: number) {
    const element = document.elementFromPoint(x, y);
    const arena = element?.closest('.battle-arena') ?? null;
    const enemy = element?.closest<HTMLElement>('[data-enemy-id]') ?? null;
    const player = element?.closest('.combatant--player') ?? null;
    return {
      location: { inArena: !!arena, enemyId: enemy?.dataset.enemyId, overPlayer: !!player },
      element: enemy ?? player ?? arena,
    };
  }

  function updateFrame() {
    const drag = session.current;
    if (!drag?.started || !drag.ghost) return;
    const instant = latest.current.settings?.reducedMotion || latest.current.settings?.speed === 'instant';
    const targetX = drag.x - drag.width / 2;
    const targetY = drag.y - drag.height * .62;
    drag.ghostX += (targetX - drag.ghostX) * (instant ? 1 : .43);
    drag.ghostY += (targetY - drag.ghostY) * (instant ? 1 : .43);
    const desiredTilt = instant ? 0 : Math.max(-11, Math.min(11, (drag.x - drag.previousX) * .55));
    drag.tilt += (desiredTilt - drag.tilt) * .2;
    drag.previousX = drag.x;
    drag.ghost.style.transform = `translate3d(${drag.ghostX}px, ${drag.ghostY}px, 0) rotate(${drag.tilt}deg) scale(1.1)`;

    // A narrow screen may not show the whole arena and hand at once.
    // Edge scrolling keeps targets reachable without releasing the card.
    const edge = 56;
    if (drag.y < edge) window.scrollBy(0, -Math.ceil((edge - drag.y) * .18));
    else if (drag.y > window.innerHeight - edge) window.scrollBy(0, Math.ceil((drag.y - window.innerHeight + edge) * .18));

    const hit = hitTest(drag.x, drag.y);
    const result = resolveCardDrop(latest.current.state, drag.card, hit.location);
    if (drag.highlight !== hit.element || drag.result?.valid !== result.valid) {
      drag.highlight?.removeAttribute('data-card-drop');
      drag.highlight = hit.element;
      hit.element?.setAttribute('data-card-drop', result.valid ? 'valid' : 'invalid');
    }
    drag.result = result;
    overlay.current?.setAttribute('data-valid', String(drag.result.valid));
    const arena = root.current?.closest('.battle-screen')?.querySelector('.battle-arena');
    const arenaRect = arena?.getBoundingClientRect();
    const sourceRect = drag.source.getBoundingClientRect();
    const originX = sourceRect.left + sourceRect.width / 2;
    const originY = Math.min(sourceRect.top + 20, (arenaRect?.bottom ?? sourceRect.top) + 65);
    const bend = Math.max(45, Math.abs(originY - drag.y) * .5);
    curve.current?.setAttribute('d', `M ${originX} ${originY} C ${originX} ${originY - bend}, ${drag.x} ${drag.y + bend * .35}, ${drag.x} ${drag.y}`);
    if (tip.current) {
      tip.current.style.transform = `translate3d(${Math.min(window.innerWidth - 195, Math.max(8, drag.x - 75))}px, ${Math.max(10, drag.y - drag.height * .72 - 27)}px, 0)`;
      tip.current.textContent = drag.result.valid ? '離して使用' : drag.result.mode === 'enemy' ? '生きている敵に重ねる' : '戦闘フィールドに重ねる';
    }
    drag.frame = requestAnimationFrame(updateFrame);
  }

  function beginPointer(event: ReactPointerEvent<HTMLDivElement>) {
    pointerType.current = event.pointerType;
    pointerOrigin.current = { x: event.clientX, y: event.clientY };
    if ((event.target as Element).closest('.battle-card-detail-button')) return;
    if (event.button !== 0 || !event.isPrimary || disabled || session.current) return;
    const source = (event.target as Element).closest<HTMLButtonElement>('button[data-card-uid]');
    const card = state.hand.find((candidate) => candidate.uid === source?.dataset.cardUid);
    if (!source || !card || !canPlayCard(state, card.uid) || source.disabled) return;
    // A new deliberate pointer gesture is distinct from the previous release click.
    suppressClickUntil.current = 0;
    const rect = source.getBoundingClientRect();
    const drag: PointerSession = {
      pointerId: event.pointerId, uid: card.uid, card, source,
      startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
      ghostX: rect.left, ghostY: rect.top, previousX: event.clientX, tilt: 0,
      width: rect.width, height: rect.height, started: false, ghost: null,
      frame: 0, result: null, highlight: null, cleanListeners: () => {},
    };
    session.current = drag;
    const move = (pointer: PointerEvent) => {
      if (pointer.pointerId !== drag.pointerId || session.current !== drag) return;
      const deltaX = pointer.clientX - drag.startX;
      const deltaY = pointer.clientY - drag.startY;
      if (!drag.started) {
        if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
        // Keep horizontal swipes available for narrow-screen hand scrolling.
        if (pointer.pointerType === 'touch' && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
          finishSession(true);
          return;
        }
        drag.started = true;
        closePreview();
        drag.ghost = makeGhost(source);
        source.setPointerCapture(drag.pointerId);
        setDraggingUid(card.uid);
        root.current?.closest('.battle-screen')?.setAttribute('data-card-drag', cardTargetMode(CARD_DEFINITIONS[card.cardId], card.upgraded));
        if (overlay.current) overlay.current.style.opacity = '1';
        drag.frame = requestAnimationFrame(updateFrame);
      }
      pointer.preventDefault();
      drag.x = pointer.clientX;
      drag.y = pointer.clientY;
    };
    const end = (pointer: PointerEvent) => {
      if (pointer.pointerId !== drag.pointerId) return;
      drag.x = pointer.clientX;
      drag.y = pointer.clientY;
      finishSession(pointer.type !== 'pointerup');
    };
    const lost = (pointer: PointerEvent) => {
      // Touch initially captures the SVG/text descendant. Moving capture to the
      // card emits a bubbling loss for that descendant; the card still owns it.
      if (pointer.target !== source || pointer.pointerId !== drag.pointerId) return;
      if (session.current === drag && drag.started && !source.hasPointerCapture(drag.pointerId)) finishSession(true);
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    source.addEventListener('lostpointercapture', lost);
    drag.cleanListeners = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      source.removeEventListener('lostpointercapture', lost);
    };
  }

  function clickPlay(uid: string) {
    const snapshot = latest.current;
    if (snapshot.disabled || !canPlayCard(snapshot.state, uid)) return;
    const card = snapshot.state.hand.find((candidate) => candidate.uid === uid)!;
    const mode = cardTargetMode(CARD_DEFINITIONS[card.cardId], card.upgraded);
    const enemy = getEnemies(snapshot.state).find((candidate) => candidate.hp > 0 && getEnemyKey(candidate) === snapshot.state.selectedEnemyId)
      ?? getEnemies(snapshot.state).find((candidate) => candidate.hp > 0);
    const targetId = mode === 'enemy' && enemy ? getEnemyKey(enemy) : undefined;
    const source = root.current?.querySelector<HTMLButtonElement>(`[data-card-uid="${CSS.escape(uid)}"]`);
    const screen = root.current?.closest('.battle-screen');
    const target = targetId ? screen?.querySelector(`[data-enemy-id="${CSS.escape(targetId)}"]`) : screen?.querySelector('.combatant--player');
    const accepted = snapshot.onPlay(uid, targetId) !== false;
    if (accepted) closePreview();
    if (accepted && source && !noMotion) settleGhost(makeGhost(source), source, true, target);
    // The reducer/UI action gate prevents repeated clicks and keyboard activation.
  }

  useEffect(() => {
    if (disabled) finishSession(true);
  }, [disabled]);

  useEffect(() => {
    const hand = cardsRoot.current;
    if (!hand) return;
    const measure = () => setScrollable(hand.scrollWidth > hand.clientWidth + 2);
    const observer = new ResizeObserver(measure);
    observer.observe(hand);
    measure();
    return () => observer.disconnect();
  }, [state.hand.length]);

  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (!preview?.pinned || !previewCard) return;
    previewPanel.current?.querySelector<HTMLButtonElement>('.battle-card-inspector-close')?.focus({ preventScroll: true });
  }, [preview?.pinned, preview?.uid]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      // Touch focuses its source immediately before dispatching the compatible
      // click. Opening a hover portal during that focus can steal the click.
      // A later Tab restores the normal keyboard focus preview on hybrid devices.
      if (event.key === 'Tab') pointerType.current = 'keyboard';
      if (event.key === 'Escape') { finishSession(true); closePreview(true); }
    };
    const blur = () => finishSession(true);
    window.addEventListener('keydown', escape);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', escape);
      window.removeEventListener('blur', blur);
      finishSession(true, false);
      for (const ghost of ghosts.current) ghost.remove();
      ghosts.current.clear();
      cancelPreviewClose();
    };
  }, []);

  return <section className="hand-section battle-hand" aria-label="手札" aria-busy={disabled} data-hand-fan={fanHand ? 'true' : 'false'} data-hand-size={state.hand.length} ref={root} data-motion={noMotion ? 'instant' : settings?.speed ?? 'normal'}>
    <div className="hand-heading">
      <div><h2>手札 <span>{state.hand.length}枚</span></h2></div>
      <p><span className="hand-pointer-instruction">{state.energy === 0 ? 'エナジー 0' : 'ドラッグ / クリックで使用'}</span><span className="hand-touch-instruction">タップで詳細・確認して使用</span>
        <span className="shortcut-hint"><kbd>1</kbd>〜<kbd>5</kbd> でも使用</span>
      </p>
      {scrollable && <div className="hand-scroll-controls" aria-label="手札をスクロール">
        <button type="button" aria-label="前の手札を表示" onClick={() => scrollHand(-1)}>‹</button>
        <button type="button" aria-label="次の手札を表示" onClick={() => scrollHand(1)}>›</button>
      </div>}
    </div>
    <div className="hand-cards battle-hand-cards" ref={cardsRoot} onPointerDown={beginPointer} onScroll={() => { if (!preview?.pinned) closePreview(); }}
      onPointerUpCapture={(event) => {
        // Disabled card buttons do not emit click, but their details still need
        // to be reachable by touch without enabling an unaffordable card.
        if (event.pointerType !== 'touch' || Math.hypot(event.clientX - pointerOrigin.current.x, event.clientY - pointerOrigin.current.y) >= DRAG_THRESHOLD) return;
        const button = (event.target as Element).closest<HTMLButtonElement>('button[data-card-uid]');
        if (button?.disabled && button.dataset.cardUid) showPreview(button.dataset.cardUid, button, true);
      }}
      onClickCapture={(event) => {
        const uid = (event.target as Element).closest<HTMLElement>('[data-card-uid]')?.dataset.cardUid;
        if (event.detail > 0 && uid === suppressedUid.current && Date.now() < suppressClickUntil.current) {
          event.preventDefault(); event.stopPropagation();
          return;
        }
        if (pointerType.current === 'touch' && uid && !(event.target as Element).closest('.battle-card-detail-button')) {
          event.preventDefault(); event.stopPropagation();
          const source = (event.target as Element).closest<HTMLElement>('.battle-hand-slot');
          if (source) showPreview(uid, source, true);
        }
      }}>
      {state.hand.map((card, index) => <div key={card.uid}
        className={`battle-hand-slot ${draggingUid === card.uid ? 'is-card-dragging' : ''}`}
        onPointerEnter={(event) => { if (event.pointerType !== 'touch') showPreview(card.uid, event.currentTarget); }}
        onPointerLeave={schedulePreviewClose}
        onFocusCapture={(event) => { if (pointerType.current !== 'touch' && !(event.target as Element).closest('.battle-card-detail-button')) showPreview(card.uid, event.currentTarget); }}
        onBlurCapture={schedulePreviewClose}
        style={{ '--fan-angle': `${fanHand ? (index - (state.hand.length - 1) / 2) / Math.max(1, (state.hand.length - 1) / 2) * 4 : 0}deg`, '--fan-rise': `${fanHand ? Math.pow((index - (state.hand.length - 1) / 2) / Math.max(1, (state.hand.length - 1) / 2), 2) * 7 : 0}px`, '--draw-delay': `${Math.min(index * 24, 120)}ms` } as CSSProperties}>
        <CardView card={card} state={state} onPlay={clickPlay} position={index} disabled={disabled || (!!draggingUid && draggingUid !== card.uid)} />
        <button className="battle-card-detail-button" type="button" aria-label={`${CARD_DEFINITIONS[card.cardId]?.name ?? 'カード'}の詳細を表示`}
          aria-haspopup="dialog" onClick={(event) => { event.stopPropagation(); showPreview(card.uid, event.currentTarget, true); }}><Icon name="book" size={12} /><span>詳細</span></button>
      </div>)}
      {!state.hand.length && <div className="empty-hand"><Icon name="cards" size={32} /><p>手札を使い切りました。<br /><span>ターンを終了すると、新しく5枚ドローします。</span></p></div>}
    </div>
    {preview && previewCard && !draggingUid && createPortal(<>
      {preview.pinned && <div className="battle-card-inspector-backdrop" onPointerDown={() => closePreview(true)} />}
      <div className={`battle-card-inspector${preview.pinned ? ' is-pinned' : ''}`} ref={previewPanel}
        role={preview.pinned ? 'dialog' : 'tooltip'} aria-modal={preview.pinned || undefined} aria-label="手札カードの詳細"
        style={getHandPreviewBounds(preview.anchor, viewport)} data-motion={noMotion ? 'instant' : settings?.speed ?? 'normal'}
        onPointerEnter={cancelPreviewClose} onPointerLeave={schedulePreviewClose}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.stopPropagation(); closePreview(true); }
          if (preview.pinned && event.key === 'Tab') {
            const buttons = previewPanel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
            if (!buttons?.length) return;
            if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
            else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
          }
        }}>
        {preview.pinned && <button className="battle-card-inspector-close" type="button" onClick={() => closePreview(true)} aria-label="カード詳細を閉じる"><Icon name="close" size={17} /></button>}
        <CardView card={previewCard} state={state} inspect showUpgradePreview={false} />
        {preview.pinned ? <div className="battle-card-inspector-actions">
          <p>{cardTargetMode(CARD_DEFINITIONS[previewCard.cardId], previewCard.upgraded) === 'enemy'
            ? `対象：${(getEnemies(state).find((enemy) => getEnemyKey(enemy) === state.selectedEnemyId && enemy.hp > 0) ?? getEnemies(state).find((enemy) => enemy.hp > 0))?.name ?? '敵'}`
            : '対象：カードの効果に従う'}</p>
          <button type="button" disabled={disabled || !canPlayCard(state, previewCard.uid)} onClick={() => clickPlay(previewCard.uid)}>
            {canPlayCard(state, previewCard.uid) ? 'このカードを使用' : '現在は使用できません'}
          </button>
        </div> : <p className="battle-card-inspector-hint">詳細ボタンで固定表示 / カードをクリックで使用</p>}
      </div>
    </>, document.body)}
    {createPortal(<div className="card-drag-overlay" ref={overlay} aria-hidden="true" data-quality={settings?.effectsQuality}>
      <svg className="card-targeting-curve" width="100%" height="100%">
        <defs><marker id={markerId} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="currentColor" strokeWidth="1.4" /></marker></defs>
        <path ref={curve} fill="none" markerEnd={`url(#${markerId})`} />
      </svg>
      <div className="card-drop-hint" ref={tip} />
    </div>, document.body)}
  </section>;
}

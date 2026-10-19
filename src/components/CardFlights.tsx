import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { CardInstance, GameSettings } from '../types/game';
import type { CombatCue } from '../presentation/types';
import { generatedCardEffect } from '../presentation/classEffects';
import { CardView } from './CardView';
import '../styles/card-flights.css';

interface CardFlightsProps {
  cue: CombatCue | null;
  sequence: number;
  duration?: number;
  settings: GameSettings;
  busy: boolean;
}

interface CardGeometry {
  rect: DOMRect;
  face: HTMLElement;
}

interface Flight {
  element: HTMLElement;
  animations: Animation[];
  arrival?: HTMLElement;
  visibility?: string;
  timer: ReturnType<typeof setTimeout>;
}

const TRANSPORT = new Set(['draw', 'discard', 'exhaust', 'generate']);

/** DOM card faces travel over the board; neither animation nor cleanup changes game state. */
export function CardFlights({ cue, sequence, duration = 220, settings, busy }: CardFlightsProps) {
  const layer = useRef<HTMLDivElement>(null);
  const templates = useRef<HTMLDivElement>(null);
  const geometry = useRef(new Map<string, CardGeometry>());
  const flights = useRef(new Set<Flight>());
  const lastSequence = useRef(-1);
  const noMotion = settings.reducedMotion || settings.speed === 'instant';
  const cards = cue?.cards ?? (cue?.card ? [cue.card] : []);

  function finish(flight: Flight) {
    if (!flights.current.delete(flight)) return;
    clearTimeout(flight.timer);
    flight.animations.forEach((animation) => animation.cancel());
    flight.element.remove();
    // Preserve an existing inline visibility rule, including when another UI owns it.
    if (flight.arrival?.dataset.cardFlightHidden === 'true') {
      flight.arrival.style.visibility = flight.visibility ?? '';
      delete flight.arrival.dataset.cardFlightHidden;
    }
  }

  function clear() {
    [...flights.current].forEach(finish);
  }

  function captureHand() {
    document.querySelectorAll<HTMLElement>('.battle-hand [data-card-uid]').forEach((element) => {
      const uid = element.dataset.cardUid;
      if (!uid) return;
      geometry.current.set(uid, { rect: element.getBoundingClientRect(), face: element.cloneNode(true) as HTMLElement });
    });
    // A combat can generate many temporary cards. The cache is cosmetic and bounded.
    while (geometry.current.size > 160) geometry.current.delete(geometry.current.keys().next().value!);
  }

  useLayoutEffect(() => {
    if (!busy || noMotion) {
      clear();
      captureHand();
      return;
    }
    const movingPower = cue?.kind === 'power' && cue.fromZone === 'played';
    if (!cue || (!TRANSPORT.has(cue.kind) && !movingPower) || lastSequence.current === sequence) {
      captureHand();
      return;
    }
    lastSequence.current = sequence;
    const root = layer.current;
    const hand = document.querySelector<HTMLElement>('.battle-hand-cards');
    if (!root || !hand) return;
    const handRect = hand.getBoundingClientRect();
    const low = settings.effectsQuality === 'low' || (settings.effectsQuality !== 'full' && navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4);
    const shown = cards.slice(0, low ? 6 : 12);

    const pileRect = (zone?: string) => document.querySelector<HTMLElement>(`[data-battle-pile="${zone ?? 'drawPile'}"]`)?.getBoundingClientRect();
    const center = (rect: DOMRect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    const handCenter = center(handRect);
    const sourcePile = pileRect(cue.fromZone);
    const destinationPile = pileRect(cue.toZone);
    const incoming = cue.toZone === 'hand';
    const batchDuration = Math.max(1, duration);
    const stagger = Math.min(32, batchDuration * .12 / Math.max(1, shown.length - 1));

    shown.forEach((card, index) => {
      const handElement = document.querySelector<HTMLElement>(`.battle-hand [data-card-uid="${CSS.escape(card.uid)}"]`);
      if (incoming && handElement) {
        // Replace the hand's generic entrance with this complete pile-to-slot flight.
        // Finishing only that animation also gives us the destination's final geometry.
        handElement.closest('.battle-hand-slot')?.getAnimations().forEach((animation) => {
          if ('animationName' in animation && animation.animationName === 'hand-card-arrive') animation.finish();
        });
      }
      const current = handElement ? { rect: handElement.getBoundingClientRect(), face: handElement } : undefined;
      const cached = geometry.current.get(card.uid);
      const template = templates.current?.children[index]?.firstElementChild as HTMLElement | null;
      const source = current ?? cached;
      const face = source?.face ?? template;
      if (!face) return;
      const width = source?.rect.width || Math.min(155, Math.max(110, window.innerWidth * .12));
      const height = source?.rect.height || width * 1.3;
      const destination = incoming && current
        ? center(current.rect)
        : destinationPile ? center(destinationPile)
          : { x: handCenter.x + (index - (shown.length - 1) / 2) * 32, y: handRect.top + height / 2 };
      const generatedEffect = generatedCardEffect(card.cardId);
      const resourceOrigin = cue.kind === 'generate' && generatedEffect.hudId
        ? document.querySelector<HTMLElement>(`[data-resource-hud="${generatedEffect.hudId}"]`)?.getBoundingClientRect()
        : undefined;
      const origin = cue.kind === 'generate'
        ? resourceOrigin ? center(resourceOrigin) : { x: handCenter.x, y: Math.max(height * .6 + 10, handRect.top - height * .48) }
        : sourcePile && cue.fromZone !== 'hand' && cue.fromZone !== 'played'
          ? center(sourcePile)
          : cached ? center(cached.rect)
            : { x: handCenter.x, y: handRect.top - height * .3 };
      const element = document.createElement('div');
      element.className = `card-flight card-flight--${cue.kind}${cue.kind === 'generate' ? ` card-flight--${generatedEffect.motif}` : ''}${low ? ' card-flight--light' : ''}`;
      element.dataset.cardFlight = card.uid;
      element.dataset.generatedEffect = cue.kind === 'generate' ? generatedEffect.motif : '';
      element.dataset.toZone = cue.toZone ?? '';
      element.setAttribute('aria-hidden', 'true');
      element.inert = true;
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;
      const front = document.createElement('div');
      front.className = face.className;
      front.classList.remove('is-unplayable', 'inspect-card');
      front.classList.add('card-flight-face');
      front.innerHTML = face.innerHTML;
      front.querySelectorAll('[data-card-uid], [id], [tabindex]').forEach((child) => {
        child.removeAttribute('data-card-uid'); child.removeAttribute('id'); child.removeAttribute('tabindex');
      });
      front.querySelectorAll('details, .card-metadata, .card-shortcut').forEach((child) => child.remove());
      element.appendChild(front);
      const animations: Animation[] = [];
      if (cue.kind === 'draw' && cue.fromZone === 'drawPile') {
        const back = document.createElement('div');
        back.className = 'card-flight-back';
        back.textContent = '静';
        element.appendChild(back);
        animations.push(back.animate([{ opacity: 1 }, { opacity: 1, offset: .22 }, { opacity: 0, offset: .5 }, { opacity: 0 }], { duration: batchDuration, fill: 'both' }));
      }
      root.appendChild(element);
      const delay = index * stagger;
      const travelDuration = Math.max(1, batchDuration - delay);
      const startScale = cue.kind === 'generate' ? .42 : sourcePile && cue.fromZone !== 'hand' ? .27 : 1;
      const endScale = incoming ? 1 : .19;
      const sign = destination.x >= origin.x ? 1 : -1;
      const transform = (x: number, y: number, scale: number, rotation: number) => `translate3d(${x - width / 2}px, ${y - height / 2}px, 0) rotate(${rotation}deg) scale(${scale})`;
      const arcHeight = low ? 32 : Math.min(95, Math.abs(destination.x - origin.x) * .13 + 45);
      const motion = element.animate([
        { transform: transform(origin.x, origin.y, startScale, -sign * 13), opacity: cue.kind === 'generate' ? 0 : 1 },
        { transform: transform(origin.x + (destination.x - origin.x) * .43, Math.min(origin.y, destination.y) - arcHeight, Math.max(startScale, endScale) * .92, sign * 8), opacity: 1, offset: .48 },
        { transform: transform(destination.x, destination.y, endScale, incoming ? 0 : sign * 26), opacity: incoming ? 1 : 0 },
      ], { duration: travelDuration, delay, easing: 'cubic-bezier(.22,.67,.27,1)', fill: 'both' });
      animations.push(motion);
      if (cue.kind === 'exhaust' && !low) animations.push(front.animate([
        { filter: 'brightness(1)', clipPath: 'inset(0 0 0 0)' },
        { filter: 'brightness(2.5) sepia(1)', clipPath: 'inset(0 0 0 0)', offset: .48 },
        { filter: 'brightness(3) sepia(1)', clipPath: 'inset(0 0 100% 0)' },
      ], { duration: travelDuration, delay, fill: 'both' }));
      const visibility = handElement?.style.visibility;
      if (incoming && handElement) {
        handElement.dataset.cardFlightHidden = 'true';
        handElement.style.visibility = 'hidden';
      }
      const flight: Flight = {
        element, animations, arrival: incoming ? handElement ?? undefined : undefined, visibility,
        timer: setTimeout(() => finish(flight), batchDuration),
      };
      flights.current.add(flight);
      void motion.finished.then(() => finish(flight), () => finish(flight));
    });
    captureHand();
    // Individual flights finish naturally across adjacent cue boundaries.
    // Only skip, instant/reduced mode, idle, or unmount clears every flight.
  }, [cue, sequence, duration, busy, noMotion, settings.effectsQuality]);

  useLayoutEffect(() => () => {
    clear();
    geometry.current.clear();
  }, []);

  return createPortal(<div className="card-flights-overlay" aria-hidden="true">
    <div className="card-flight-templates" ref={templates}>{cards.map((card: CardInstance) => <div key={card.uid}><CardView card={card} inspect showUpgradePreview={false} /></div>)}</div>
    <div ref={layer} className="card-flights-layer" />
  </div>, document.body);
}

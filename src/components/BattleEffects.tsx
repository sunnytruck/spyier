import { useEffect, useRef, useState } from 'react';
import type { GameSettings } from '../types/game';
import type { CombatCue } from '../presentation/types';
import { generatedCardEffect, getClassEffectRoute, type BattleEffectMotif } from '../presentation/classEffects';
import '../styles/battle-effects.css';

interface Point { x: number; y: number }
type Motif = BattleEffectMotif;
interface Burst {
  motif: Motif;
  orbType?: 'lightning' | 'frost';
  from: Point;
  to: Point;
  started: number;
  duration: number;
  seed: number;
  color: string;
  count: number;
}
interface FloatingLabel extends Point { id: number; text: string; detail: string; kind: string; compact: boolean }
interface Props { cue: CombatCue | null; sequence: number; settings: GameSettings; busy: boolean; duration?: number }

const palette: Record<Motif, string> = {
  slash: '#ffe0a0', impact: '#ffb76e', shield: '#9cdbec', poison: '#b9ed73',
  rock: '#ffac6c', sacrifice: '#f17d7d', forge: '#ffd77d', guard: '#b9b6ff', doom: '#b8a1f4',
  heal: '#a7f0b5', strength: '#f5b777', debuff: '#d8a0c9', power: '#e8c47b', stars: '#ffe1a6', sword: '#d6b6ff', knife: '#d6efe8',
  ghost: '#aaacff', lightning: '#ffe38b', frost: '#b9f3fc', death: '#a8a08a', card: '#e8d19c',
};
const TAU = Math.PI * 2;
const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));
const easeOut = (n: number) => 1 - (1 - n) ** 3;

/** Deterministic visual noise; presentation never consumes the game's seeded RNG. */
function noise(seed: number): number { const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }
function polygon(context: CanvasRenderingContext2D, x: number, y: number, radius: number, sides: number, rotation = 0) {
  context.beginPath();
  for (let index = 0; index < sides; index++) {
    const angle = index / sides * TAU + rotation;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (index === 0) context.moveTo(px, py); else context.lineTo(px, py);
  }
  context.closePath();
}
function star(context: CanvasRenderingContext2D, x: number, y: number, radius: number, rotation = 0) {
  context.beginPath();
  for (let index = 0; index < 8; index++) {
    const angle = index / 8 * TAU + rotation;
    const size = index % 2 === 0 ? radius : radius * 0.22;
    const px = x + Math.cos(angle) * size;
    const py = y + Math.sin(angle) * size;
    if (!index) context.moveTo(px, py); else context.lineTo(px, py);
  }
  context.closePath();
  context.fill();
}
/** Canvas owns all per-frame work; React only receives discrete combat cues. */
export function BattleEffects({ cue, sequence, settings, busy, duration }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bursts = useRef<Burst[]>([]);
  const animationFrame = useRef<number>(0);
  const dimensions = useRef({ width: 1, height: 1, ratio: 1 });
  const animations = useRef(new Set<Animation>());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const previousSequence = useRef(-1);
  const [labels, setLabels] = useState<FloatingLabel[]>([]);
  const quality = (settings as GameSettings & { effectsQuality?: 'auto' | 'full' | 'low' }).effectsQuality ?? 'auto';
  const lowQuality = quality === 'low' || (quality === 'auto' && (navigator.hardwareConcurrency || 8) <= 4);
  const reduced = settings.reducedMotion || settings.speed === 'instant';

  function cancelEffects() {
    for (const animation of animations.current) animation.cancel();
    animations.current.clear();
    bursts.current = [];
    cancelAnimationFrame(animationFrame.current);
    animationFrame.current = 0;
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.closest<HTMLElement>('.battle-arena');
    if (!canvas || !host) return;
    function resize() {
      if (!canvas || !host) return;
      const bounds = host.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, lowQuality ? 1 : 2);
      dimensions.current = { width: bounds.width, height: bounds.height, ratio };
      canvas.width = Math.max(1, Math.round(bounds.width * ratio));
      canvas.height = Math.max(1, Math.round(bounds.height * ratio));
    }
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    return () => observer.disconnect();
  }, [lowQuality]);

  useEffect(() => () => {
    cancelEffects();
    for (const timer of timers.current) clearTimeout(timer);
    timers.current.clear();
  }, []);

  useEffect(() => {
    const reset = () => {
      cancelEffects();
      for (const timer of timers.current) clearTimeout(timer);
      timers.current.clear();
      setLabels([]);
    };
    window.addEventListener('iwason:presentation-reset', reset);
    if (reduced) reset();
    return () => window.removeEventListener('iwason:presentation-reset', reset);
  }, [reduced]);

  useEffect(() => {
    if (!cue || previousSequence.current === sequence || reduced || !busy) return;
    previousSequence.current = sequence;
    const canvas = canvasRef.current;
    const host = canvas?.closest<HTMLElement>('.battle-arena');
    if (!canvas || !host) return;
    const bounds = host.getBoundingClientRect();
    const actor = (id?: string) => Array.from(host.querySelectorAll<HTMLElement>('[data-battle-actor]')).find((node) => node.dataset.battleActor === id);
    const locate = (node?: Element | null): Point => {
      const rect = (node?.querySelector('.character-art, .resource-motion') ?? node)?.getBoundingClientRect();
      return rect ? { x: rect.left + rect.width / 2 - bounds.left, y: rect.top + rect.height * 0.46 - bounds.top } : { x: bounds.width / 2, y: bounds.height / 2 };
    };
    const route = getClassEffectRoute(cue);
    const sourceActor = actor(route.sourceId);
    const targetActor = actor(route.targetId);
    const from = locate(sourceActor);
    const to = locate(targetActor);
    const motif = route.motif;
    const activeDuration = duration;
    const speed = settings.speed === 'fast' ? 0.55 : 1;
    const animate = (element: Element | undefined, keyframes: Keyframe[], fallbackDuration: number, extraDuration = 1) => {
      if (!element || !element.animate) return;
      const animation = element.animate(keyframes, { duration: (activeDuration ?? fallbackDuration * speed) * extraDuration, easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'none' });
      animations.current.add(animation);
      animation.finished.then(() => animations.current.delete(animation), () => animations.current.delete(animation));
    };
    const addBurst = (kind: Motif, origin = to, destination = origin, duration = 420, orbType?: Burst['orbType']) => {
      bursts.current.push({ motif: kind, orbType, from: origin, to: destination, started: performance.now(), duration: duration * speed, seed: sequence * 53, color: palette[kind], count: lowQuality ? 9 : 23 });
      bursts.current = bursts.current.slice(-12);
    };
    const innerMotion = (element?: HTMLElement) => element?.querySelector<HTMLElement>('.resource-motion') ?? element;
    for (const hudId of route.hudIds) {
      document.querySelectorAll<HTMLElement>(`[data-resource-hud="${hudId}"]`).forEach((hud) => {
        animate(innerMotion(hud), [
          { transform: 'scale(1)', filter: 'brightness(1)' },
          { transform: 'scale(1.11)', filter: 'brightness(1.65)', offset: .32 },
          { transform: 'scale(1)', filter: 'brightness(1)' },
        ], 320);
      });
    }

    if (cue.kind === 'attack') {
      const direction = to.x >= from.x ? 1 : -1;
      const travel = Math.min(44, Math.abs(to.x - from.x) * 0.15);
      // A clear wind-up, quick acceleration, contact, and weighted recovery.
      const directAttack = route.motion === 'lunge' || route.motion === 'dart';
      if (directAttack) animate(sourceActor, route.motion === 'dart' ? [
        { transform: 'translateX(0) skewX(0deg)', opacity: 1 },
        { transform: `translate(${direction * travel * 1.8}px,-7px) skewX(${-direction * 8}deg)`, opacity: .55, offset: .32 },
        { transform: `translate(${direction * travel}px,-2px) skewX(0deg)`, opacity: 1, offset: .5 },
        { transform: 'translateX(0) skewX(0deg)', opacity: 1 },
      ] : [
        { transform: 'translate(0,0) rotate(0deg)', offset: 0 },
        { transform: `translate(${-direction * 9}px,2px) rotate(${-direction * 2}deg)`, offset: 0.2 },
        { transform: `translate(${direction * travel}px,-4px) rotate(${direction * 4}deg)`, offset: 0.58 },
        { transform: `translate(${direction * travel * 0.76}px,0) rotate(${direction * 2}deg)`, offset: 0.72 },
        { transform: 'translate(0,0) rotate(0deg)', offset: 1 },
      ], 260, 1.6);
      const flightDuration = activeDuration ? activeDuration / speed : 220;
      if (directAttack) {
        addBurst(motif, from, to, flightDuration);
      } else if (['orbLightning', 'orbFrost', 'summonDamage'].includes(cue.effect ?? '')) {
        if (route.motion === 'summon') animate(innerMotion(sourceActor), [
          { transform: 'translateX(0) scale(1)' },
          { transform: `translate(${direction * 35}px,-8px) scale(1.1)`, offset: .45 },
          { transform: 'translateX(0) scale(1)' },
        ], 240);
        addBurst(motif, from, to, flightDuration);
      } else {
        addBurst(motif === 'slash' ? 'impact' : motif, to, to, flightDuration);
      }
      const intent = sourceActor?.closest('.formation-enemy, .combatant')?.querySelector<HTMLElement>('.enemy-intent');
      animate(intent ?? undefined, [{ boxShadow: '0 0 0 transparent' }, { boxShadow: '0 0 20px #e6a56870', borderColor: '#e6b16f' }, { boxShadow: '0 0 0 transparent' }], 260);
    } else if (cue.kind === 'impact') {
      const blocked = (cue.amount ?? 0) <= 0;
      const direction = from.x <= to.x ? 1 : -1;
      animate(targetActor, route.hpCost ? [
        { filter: 'brightness(1) saturate(1)' },
        { filter: 'brightness(.65) sepia(.7) saturate(2.1)', offset: .24 },
        { filter: 'brightness(1) saturate(1)' },
      ] : blocked ? [
        { transform: 'translateX(0)' }, { transform: `translateX(${direction * 4}px)` }, { transform: 'translateX(0)' },
      ] : [
        { transform: 'translateX(0) rotate(0deg)', filter: 'brightness(1)' },
        { transform: `translate(${direction * 13}px,2px) rotate(${direction * 3}deg)`, filter: 'brightness(1.6)', offset: 0.16 },
        { transform: `translate(${-direction * 4}px,0) rotate(${-direction}deg)`, filter: 'brightness(1.05)', offset: 0.5 },
        { transform: 'translateX(0) rotate(0deg)', filter: 'brightness(1)' },
      ], 210);
      addBurst(blocked ? (cue.absorbed ? 'guard' : 'shield') : ['poison', 'lightning', 'ghost', 'sacrifice', 'rock', 'knife', 'sword', 'doom', 'stars'].includes(motif) ? motif : 'impact');
    } else if (cue.kind === 'death') {
      if (targetActor) targetActor.dataset.fallen = 'true';
      animate(targetActor, [
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1, filter: 'brightness(1)' },
        { transform: 'translate(1px,-5px) rotate(-2deg)', opacity: 0.9, filter: 'brightness(1.6)', offset: 0.12 },
        { transform: 'translate(8px,15px) rotate(7deg) scale(.96)', opacity: 0.5, filter: 'grayscale(1)', offset: 0.5 },
        { transform: 'translate(13px,35px) rotate(11deg) scale(.83)', opacity: 0.12, filter: 'grayscale(1)' },
      ], 600);
      addBurst('death', to, to, 620);
    } else if (['draw', 'discard', 'exhaust', 'generate', 'cardPlay'].includes(cue.kind)) {
      // Full-size zone travel belongs to CardFlights, outside the clipped arena.
      if (cue.kind === 'generate') {
        const generated = generatedCardEffect(cue.card?.cardId ?? '');
        if (generated.motif !== 'card') addBurst(generated.motif, to, to, 300);
      }
      if (cue.kind === 'cardPlay') addBurst('card', { x: bounds.width * .5, y: bounds.height + 18 }, { x: bounds.width * .5, y: bounds.height * .75 }, 145);
    } else if (cue.kind === 'resource' && cue.orbIndex !== undefined) {
      const orbMotion = innerMotion(targetActor);
      const orbType = cue.resource === 'lightning' || cue.resource === 'frost' ? cue.resource : undefined;
      if (cue.resourceAction === 'channel') {
        addBurst(motif, locate(actor('player')), to, 310, orbType);
        animate(orbMotion, [
          { transform: 'scale(.15) rotate(-70deg)', opacity: .1 },
          { transform: 'scale(1.25) rotate(8deg)', opacity: 1, offset: .65 },
          { transform: 'scale(1) rotate(0deg)', opacity: 1 },
        ], 310);
      } else {
        // The engine has already removed an evoked orb from its snapshot. Its
        // captured type still draws above the now-empty slot until release ends.
        addBurst(motif, to, to, 280, orbType);
        animate(orbMotion, [
          { transform: 'scale(1)', filter: 'brightness(1)' },
          { transform: `scale(${cue.orbMode === 'evoke' ? 1.5 : 1.22})`, filter: 'brightness(1.9)', offset: .35 },
          { transform: 'scale(1)', filter: 'brightness(1)' },
        ], 250);
      }
    } else if (cue.kind === 'resource' && cue.resource === 'ostyHp') {
      const motion = innerMotion(targetActor);
      if (['guard', 'sweep'].includes(cue.resourceAction ?? '')) {
        addBurst('guard', from, to, 300);
        animate(motion, [
          { transform: 'translateX(0)', filter: 'brightness(1.6)', opacity: 1 },
          { transform: 'translate(-12px,4px) rotate(-5deg)', filter: 'brightness(1.8)', opacity: 1, offset: .22 },
          { transform: 'translateX(0)', filter: 'brightness(1)', opacity: cue.frame.classResources?.ostyHp ? 1 : .3 },
        ], 300);
      } else if (cue.resourceAction === 'vanish') {
        addBurst('ghost', to, { x: to.x, y: to.y - 38 }, 400);
        animate(motion, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'translateY(-30px) scale(.6)', opacity: 0 }], 400);
      } else {
        addBurst('ghost', locate(actor('player')), to, 360);
        animate(motion, cue.resourceAction === 'summon' ? [
          { transform: 'translateY(20px) scale(.2)', opacity: .1 },
          { transform: 'translateY(-4px) scale(1.12)', opacity: 1, offset: .68 },
          { transform: 'translateY(0) scale(1)', opacity: 1 },
        ] : [{ filter: 'brightness(1)', transform: 'scale(1)' }, { filter: 'brightness(1.7)', transform: 'scale(1.12)' }, { filter: 'brightness(1)', transform: 'scale(1)' }], 330);
      }
    } else if (cue.kind === 'resource' && cue.resource === 'forge') {
      const sword = actor('player')?.querySelector<SVGElement>('.keito-sacred-sword');
      addBurst('forge', locate(sword ?? targetActor), locate(sword ?? targetActor), 420);
      animate(sword ?? targetActor, [
        { filter: 'brightness(1)' },
        { filter: 'brightness(1.9) drop-shadow(0 0 7px #ffe6a0)', offset: .42 },
        { filter: 'brightness(1)' },
      ], 350);
    } else if (cue.kind !== 'turn') {
      addBurst(motif, to, to, cue.kind === 'power' ? 540 : 420);
      if (motif === 'strength' && route.targetId === 'player') animate(targetActor, [
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
        { transform: 'translateY(-5px) scale(1.045)', filter: 'brightness(1.35)', offset: .55 },
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
      ], 350);
    }

    if (['impact', 'heal', 'block', 'status', 'power', 'resource'].includes(cue.kind)) {
      const amount = cue.amount ?? 0;
      const resourceLabels: Record<string, string> = { stars: '✦ 星', forge: '聖剣・鍛造', ostyHp: '岩霊', focus: '集中力', lightning: '⚡ ライトニング', frost: '❄ フロスト', jitto: 'じっと', energy: 'エナジー', nextTurnEnergy: '次ターン' };
      const statusLabels: Record<string, string> = { poison: '毒', strength: '筋力', weak: '弱体', vulnerable: '脆弱', doom: '破滅' };
      let text = `${amount > 0 ? '+' : ''}${amount || ''}`;
      let detail = cue.label ?? 'パワー';
      let labelKind: string = motif;
      if (cue.kind === 'impact') {
        text = amount > 0 ? `−${amount}` : cue.absorbed ? 'GUARD' : cue.blocked ? 'BLOCK' : '0';
        detail = [
          cue.blocked ? `盾 ${cue.blocked} 軽減` : '',
          cue.absorbed ? `岩霊 ${cue.absorbed} 肩代わり` : '',
          cue.effect?.toLowerCase().includes('poison') ? '毒ダメージ' : '',
          route.hpCost ? 'HP消費' : '',
        ].filter(Boolean).join(' · ');
        labelKind = amount > 0 ? motif === 'poison' ? 'poison' : route.hpCost ? 'sacrifice' : 'damage' : cue.absorbed ? 'ghost' : 'blocked';
      } else if (cue.kind === 'block' || cue.kind === 'heal') {
        text = `+${amount}`;
        detail = cue.kind === 'block' ? 'ブロック' : '回復';
      } else if (cue.kind === 'status') detail = statusLabels[cue.status ?? ''] ?? cue.status ?? '';
      else if (cue.kind === 'resource') {
        detail = [resourceLabels[cue.resource ?? ''] ?? cue.resource ?? '', cue.label ?? ''].filter(Boolean).join(' · ');
        if (cue.amount === 0) text = cue.resourceAction === 'reference' ? '✦' : cue.orbMode === 'evoke' ? '解放' : cue.orbMode === 'passive' ? '発動' : '';
        if (cue.resource === 'ostyHp' && cue.resourceAction === 'vanish') text = '消滅';
      }
      const id = sequence;
      const label: FloatingLabel = { id, x: to.x + (sequence % 3 - 1) * 17, y: Math.max(44, to.y - 54), text, detail, kind: labelKind, compact: cue.kind !== 'impact' && cue.kind !== 'heal' };
      setLabels((current) => [...current.slice(-9), label]);
      const timer = setTimeout(() => { setLabels((current) => current.filter((entry) => entry.id !== id)); timers.current.delete(timer); }, 1050 * speed);
      timers.current.add(timer);
    }

    if (!animationFrame.current && bursts.current.length) {
      const render = (now: number) => {
        const context = canvas.getContext('2d');
        if (!context) return;
        const { width, height, ratio } = dimensions.current;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.clearRect(0, 0, width, height);
        bursts.current = bursts.current.filter((entry) => now - entry.started < entry.duration);
        for (const burst of bursts.current) drawBurst(context, burst, clamp((now - burst.started) / burst.duration), lowQuality);
        animationFrame.current = bursts.current.length ? requestAnimationFrame(render) : 0;
      };
      animationFrame.current = requestAnimationFrame(render);
    }
  }, [cue, sequence, busy, reduced, settings.speed, lowQuality, duration]);

  return <div className={`battle-effects-layer ${reduced ? 'effects-reduced' : ''}`} aria-hidden="true" data-effects-quality={lowQuality ? 'low' : 'full'}>
    <canvas ref={canvasRef} className="battle-effects-canvas" />
    {labels.map((label) => <span key={label.id} className={`battle-number number-${label.kind} ${label.compact ? 'number-compact' : ''}`} style={{ left: label.x, top: label.y, animationDuration: `${settings.speed === 'fast' ? 580 : 1050}ms` }}><b>{label.text}</b>{label.detail && <small>{label.detail}</small>}</span>)}
  </div>;
}

function drawBurst(context: CanvasRenderingContext2D, burst: Burst, t: number, lowQuality: boolean) {
  const { from, to, motif, seed, color } = burst;
  const appear = Math.min(1, t * 7);
  const fade = (1 - t) ** 1.4;
  const radius = Math.min(112, Math.max(52, context.canvas.width / (window.devicePixelRatio || 1) * 0.06));
  const travel = easeOut(clamp(t * 1.45));
  const x = from.x + (to.x - from.x) * travel;
  const y = from.y + (to.y - from.y) * travel;
  context.save();
  context.globalAlpha = fade * appear;
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.shadowColor = color;
  context.shadowBlur = lowQuality ? 0 : 9;

  if (burst.orbType) {
    context.translate(x, y);
    const size = 18 + Math.sin(t * Math.PI) * 8;
    context.lineWidth = 2;
    context.beginPath(); context.arc(0, 0, size, 0, TAU); context.stroke();
    context.globalAlpha *= .22; context.fill(); context.globalAlpha = fade * appear;
    context.strokeStyle = '#f1fdff';
    if (burst.orbType === 'lightning') {
      context.beginPath(); context.moveTo(3, -14); context.lineTo(-7, 2); context.lineTo(3, 0); context.lineTo(-3, 14); context.lineTo(9, -3); context.lineTo(0, -1); context.stroke();
      context.rotate(t * 2); context.strokeStyle = color;
      context.beginPath(); context.arc(0, 0, size + 5, -.5, 1.1); context.stroke();
    } else {
      for (let index = 0; index < 6; index++) {
        context.rotate(TAU / 6); context.beginPath(); context.moveTo(0, 0); context.lineTo(14, 0); context.moveTo(8, 0); context.lineTo(6, -4); context.moveTo(8, 0); context.lineTo(6, 4); context.stroke();
      }
    }
  } else if (motif === 'rock') {
    // A stone fist and broad shock ring distinguish physical hits from blades.
    context.save(); context.translate(x, y); context.rotate((1 - t) * -.22);
    context.lineWidth = 2;
    context.beginPath(); context.moveTo(-25, 16); context.lineTo(-31, -10); context.lineTo(-16, -26); context.lineTo(-1, -25); context.lineTo(3, -15); context.lineTo(19, -20); context.lineTo(33, -7); context.lineTo(29, 17); context.lineTo(12, 29); context.lineTo(-12, 27); context.closePath();
    context.globalAlpha *= .24; context.fill(); context.globalAlpha = fade * appear; context.stroke();
    for (let index = 0; index < 3; index++) { context.beginPath(); context.moveTo(-17 + index * 15, -17); context.lineTo(-14 + index * 13, 4); context.stroke(); }
    context.restore();
    context.lineWidth = 3 * (1 - t) + 1;
    context.beginPath(); context.ellipse(to.x, to.y, radius * easeOut(t), radius * easeOut(t) * .64, -.2, 0, TAU); context.stroke();
  } else if (motif === 'sacrifice') {
    context.translate(x, y); context.rotate(-t * .4);
    const size = radius * (.7 - t * .34);
    context.lineWidth = 2; polygon(context, 0, 0, size, 4, Math.PI / 4); context.stroke();
    context.beginPath(); context.moveTo(-13, 8); context.lineTo(0, -15); context.lineTo(13, 8); context.lineTo(0, 24); context.closePath();
    context.globalAlpha *= .5; context.fill();
  } else if (motif === 'forge') {
    context.translate(x, y);
    context.lineWidth = 2;
    context.beginPath(); context.moveTo(-39, 15); context.lineTo(34, 15); context.lineTo(18, 30); context.lineTo(12, 31); context.lineTo(15, 40); context.lineTo(-18, 40); context.lineTo(-13, 30); context.lineTo(-31, 26); context.closePath(); context.stroke();
    context.save(); context.translate(0, -12 + Math.sin(t * Math.PI) * 18); context.rotate(-.7 + t * .7);
    context.fillRect(-7, -38, 14, 45); context.fillRect(-19, -5, 38, 5); context.fillRect(-3, -5, 6, 21); context.restore();
    star(context, 0, 14, 22 * Math.sin(t * Math.PI), t);
  } else if (motif === 'doom') {
    context.translate(x, y); context.rotate(t * .22); context.lineWidth = 2;
    context.beginPath(); context.arc(0, 0, radius * .7, 0, TAU); context.stroke();
    for (let index = 0; index < 8; index++) { const angle = index / 8 * TAU; polygon(context, Math.cos(angle) * radius * .7, Math.sin(angle) * radius * .7, 5, 3, angle); context.fill(); }
    context.beginPath(); context.moveTo(-17, -24); context.lineTo(17, -24); context.lineTo(-15, 24); context.lineTo(15, 24); context.closePath(); context.stroke();
  } else if (motif === 'poison') {
    // Small translucent pockets form a readable local cloud without covering intent text.
    for (let index = 0; index < (lowQuality ? 3 : 6); index++) {
      const angle = index / 6 * TAU;
      context.globalAlpha = fade * appear * .1;
      context.beginPath(); context.arc(to.x + Math.cos(angle) * 24, to.y + Math.sin(angle) * 18 - t * 22, 21 + easeOut(t) * 13, 0, TAU); context.fill();
    }
  } else if (motif === 'slash') {
    // A curved blade trail with an inner hot edge rather than a full-screen flash.
    const centerX = from.x + (to.x - from.x) * easeOut(t);
    const centerY = from.y + (to.y - from.y) * easeOut(t);
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    context.translate(centerX, centerY);
    context.rotate(angle - 0.6);
    context.lineWidth = 12 * (1 - t) + 1;
    context.beginPath();
    context.ellipse(0, 0, radius * 0.8, radius * 0.38, 0, -1.2, -1.2 + Math.min(1, t * 3) * 2.4);
    context.stroke();
    context.strokeStyle = '#fff8db';
    context.lineWidth = 2;
    context.stroke();
  } else if (motif === 'shield' || motif === 'guard') {
    const size = radius * (0.65 + easeOut(t) * 0.24);
    context.translate(x, y);
    context.scale(0.8, 1.03);
    polygon(context, 0, 0, size, 6, Math.PI / 6);
    context.lineWidth = 3;
    context.stroke();
    context.globalAlpha *= 0.17;
    context.fill();
    context.globalAlpha = fade * appear;
    polygon(context, 0, 0, size * 0.83, 6, Math.PI / 6);
    context.lineWidth = 1;
    context.stroke();
    context.beginPath();
    context.moveTo(0, -size * 0.5); context.lineTo(0, size * 0.5);
    context.moveTo(-size * 0.43, 0); context.lineTo(size * 0.43, 0); context.stroke();
    if (motif === 'guard') { context.fillRect(-16, -9, 5, 8); context.fillRect(11, -9, 5, 8); }
  } else if (motif === 'lightning') {
    context.lineWidth = 2.8;
    context.beginPath(); context.moveTo(from.x, from.y);
    for (let index = 1; index <= 9; index++) {
      const fraction = index / 9;
      const jitter = index === 9 ? 0 : (noise(seed + index + Math.floor(t * 8)) - 0.5) * 44;
      context.lineTo(from.x + (to.x - from.x) * fraction, from.y + (to.y - from.y) * fraction + jitter);
    }
    context.stroke();
    context.strokeStyle = '#f4ffff'; context.lineWidth = 1; context.stroke();
    star(context, to.x, to.y, 25 * (1 - t), t);
  } else if (motif === 'knife' || motif === 'sword') {
    context.translate(x, y);
    const angle = Math.atan2(to.y - from.y || -0.6, to.x - from.x || 1);
    context.rotate(angle);
    const length = motif === 'sword' ? 76 : 41;
    context.beginPath(); context.moveTo(length * 0.6, 0); context.lineTo(-length * 0.3, -8); context.lineTo(-length * 0.2, 0); context.lineTo(-length * 0.3, 8); context.closePath(); context.fill();
    context.strokeStyle = '#fff7d6'; context.lineWidth = 1; context.stroke();
    context.fillStyle = '#ba954e'; context.fillRect(-length * 0.48, -3, length * 0.26, 6); context.fillRect(-length * 0.3, -13, 4, 26);
    if (motif === 'sword') { context.strokeStyle = color; context.lineWidth = 1; context.beginPath(); context.ellipse(-length * 0.4, 0, 20, 49, Math.PI / 2, 0, TAU); context.stroke(); }
  } else if (motif === 'strength' || motif === 'debuff') {
    const direction = motif === 'strength' ? -1 : 1;
    context.translate(x, y + direction * easeOut(t) * 24);
    context.lineWidth = 3;
    for (let index = -1; index <= 1; index++) {
      const offsetX = index * 27;
      context.beginPath(); context.moveTo(offsetX - 10, -direction * 3); context.lineTo(offsetX, direction * 13); context.lineTo(offsetX + 10, -direction * 3); context.stroke();
      context.beginPath(); context.moveTo(offsetX, direction * 13); context.lineTo(offsetX, -direction * 21); context.stroke();
    }
  } else if (motif === 'power' || motif === 'stars' || motif === 'ghost' || motif === 'frost') {
    const size = radius * (0.45 + easeOut(t) * 0.65);
    context.translate(x, y);
    if (motif === 'ghost') {
      context.beginPath(); context.moveTo(-27, 29); context.bezierCurveTo(-50, -40, 43, -65, 28, 22); context.lineTo(9, 11); context.lineTo(0, 31); context.lineTo(-12, 17); context.closePath();
      context.globalAlpha *= 0.32; context.fill(); context.globalAlpha = fade * appear;
      context.stroke(); context.fillStyle = '#eef0ff'; context.fillRect(-12, -12, 4, 7); context.fillRect(8, -12, 4, 7);
    } else if (motif === 'frost') {
      context.rotate(t * 0.7); context.lineWidth = 2;
      for (let index = 0; index < 6; index++) { context.rotate(TAU / 6); context.beginPath(); context.moveTo(0, 0); context.lineTo(size, 0); context.moveTo(size * 0.6, 0); context.lineTo(size * 0.4, -size * 0.2); context.moveTo(size * 0.6, 0); context.lineTo(size * 0.4, size * 0.2); context.stroke(); }
    } else {
      context.lineWidth = 1.5;
      context.beginPath(); context.ellipse(0, 16, size, size * 0.32, 0, 0, TAU); context.stroke();
      context.beginPath(); context.arc(0, -5, size * 0.7, -TAU * 0.33 + t, TAU * 0.33 + t); context.stroke();
      for (let index = 0; index < (motif === 'stars' ? 7 : 5); index++) { const angle = index / 7 * TAU - t * 0.6; star(context, Math.cos(angle) * size * 0.8, Math.sin(angle) * size * 0.65 - 12, 4 + noise(seed + index) * 5, angle); }
      if (motif === 'power') { polygon(context, 0, -5, size * 0.5, 6, t * 0.3); context.stroke(); }
    }
  } else if (motif === 'card') {
    context.translate(x, y - Math.sin(t * Math.PI) * 36); context.rotate((1 - t) * -0.35);
    context.lineWidth = 1.5; context.fillStyle = '#292e25';
    context.beginPath(); context.roundRect(-19, -27, 38, 54, 4); context.fill(); context.stroke();
    polygon(context, 0, 0, 10, 4, Math.PI / 4); context.stroke();
    context.beginPath(); context.moveTo(-11, 17); context.lineTo(11, 17); context.stroke();
  }
  context.restore();

  // Sparks, dust, poison globules and healing motes continue after the main shape.
  if (motif === 'card' || motif === 'slash' || motif === 'knife') return;
  context.save();
  context.fillStyle = color; context.strokeStyle = color;
  context.shadowColor = color; context.shadowBlur = lowQuality ? 0 : 5;
  for (let index = 0; index < burst.count; index++) {
    const random = noise(seed + index * 17);
    const angle = noise(seed + index * 37) * TAU;
    const distance = (15 + random * 72) * easeOut(t);
    let px = to.x + Math.cos(angle) * distance;
    let py = to.y + Math.sin(angle) * distance;
    if (motif === 'heal' || motif === 'poison' || motif === 'ghost') { px = to.x + (random - 0.5) * radius * 1.3; py = to.y + 38 - t * (80 + noise(seed + index) * 50); }
    if (motif === 'death') py += t * t * 78;
    const size = (motif === 'death' ? 4 : 1.5) + noise(seed + index * 11) * (motif === 'death' ? 5 : 3);
    context.globalAlpha = fade * clamp(t * 8) * (0.5 + random * 0.5);
    if (motif === 'heal') { context.fillRect(px - size, py - 1, size * 2, 2); context.fillRect(px - 1, py - size, 2, size * 2); }
    else if (motif === 'poison') { context.beginPath(); context.arc(px, py, size, 0, TAU); context.stroke(); }
    else if (motif === 'death' || motif === 'rock') { context.save(); context.translate(px, py); context.rotate(t * 4 + random); polygon(context, 0, 0, motif === 'rock' ? size * 1.7 : size, 5, random); context.fill(); context.restore(); }
    else if (motif === 'impact' || motif === 'lightning' || motif === 'forge') { context.lineWidth = 1.4; context.beginPath(); context.moveTo(px, py); context.lineTo(px + Math.cos(angle) * size * 3, py + Math.sin(angle) * size * 3); context.stroke(); }
    else star(context, px, py, size, t + angle);
  }
  if (motif === 'impact' || motif === 'death' || motif === 'rock') {
    context.globalAlpha = fade * 0.4; context.lineWidth = 1.5;
    context.beginPath(); context.ellipse(to.x, to.y + radius * 0.52, radius * easeOut(t) * 1.3, radius * easeOut(t) * 0.22, 0, 0, TAU); context.stroke();
  }
  context.restore();
}

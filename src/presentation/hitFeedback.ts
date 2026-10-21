import type { GameSettings } from '../types/game';
import type { CombatCue } from './types';

export type HitSurface = 'health' | 'shield' | 'guard' | 'cost' | 'affliction' | 'none';
export interface HitFeedbackProfile {
  enabled: boolean;
  surface: HitSurface;
  /** Contact is a plateau inside the existing cue, never an extra timeline delay. */
  durationMs: number;
  holdMs: number;
  shakePx: number;
  recoilPx: number;
  particleCount: number;
  numberScale: number;
  contactRadius: number;
}

const cap = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const amount = (value: number | undefined) => Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
const INDIRECT = new Set(['poison', 'doom', 'thorns', 'loseEnemyHp']);

/** A read-only presentation decision based on the engine's actual per-hit cue.
 * It never estimates damage, reads a card description, changes HP or uses RNG. */
export function getHitFeedbackProfile(
  cue: Pick<CombatCue, 'kind' | 'amount' | 'blocked' | 'absorbed' | 'effect'>,
  settings: Pick<GameSettings, 'speed' | 'reducedMotion'>,
  duration?: number,
  lowQuality = false,
): HitFeedbackProfile {
  const damage = amount(cue.amount);
  const cost = cue.effect === 'loseHp' || cue.effect === 'loseMaxHp';
  const affliction = INDIRECT.has(cue.effect ?? '');
  const surface: HitSurface = cost ? 'cost' : affliction ? 'affliction' : damage > 0 ? 'health'
    : amount(cue.absorbed) > 0 ? 'guard' : amount(cue.blocked) > 0 ? 'shield' : 'none';
  const budget = duration === undefined ? settings.speed === 'fast' ? 82.5 : 150
    : Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const enabled = cue.kind === 'impact' && !settings.reducedMotion && settings.speed !== 'instant' && budget > 0;
  const contact = enabled && ['health', 'shield', 'guard'].includes(surface);
  const force = Math.sqrt(damage);
  return {
    enabled,
    surface,
    durationMs: enabled ? budget : 0,
    holdMs: contact ? Math.min(surface === 'health' ? cap(30 + force * 2.4, 30, 55) : 22, budget * .42) : 0,
    shakePx: contact && surface === 'health' ? Math.min(lowQuality ? 2.4 : 5, (.8 + force * .36) * (lowQuality ? .6 : 1)) : 0,
    recoilPx: contact ? surface === 'health' ? Math.min(18, 6 + force * .9) : surface === 'guard' ? 5 : 3 : 0,
    particleCount: contact ? lowQuality ? Math.min(9, 4 + Math.floor(force * .4)) : Math.min(28, 11 + Math.floor(force * 1.2)) : 0,
    numberScale: enabled && surface === 'health' ? 1 + Math.min(.24, force / 40) : 1,
    contactRadius: contact ? surface === 'health' ? Math.min(74, 34 + force * 1.4) : 30 : 0,
  };
}

/** A target snaps to contact, holds its silhouette briefly, then recoils and
 * recovers. Identical contact transforms produce a real zero-motion plateau. */
export function impactRecoilFrames(profile: HitFeedbackProfile, direction: number): Keyframe[] {
  if (!profile.enabled || profile.recoilPx <= 0) return [];
  const sign = direction < 0 ? -1 : 1;
  const hold = profile.durationMs > 0 ? profile.holdMs / profile.durationMs : 0;
  const contact = `translate(${sign * profile.recoilPx}px,1px) rotate(${sign * 2}deg)`;
  const brightness = profile.surface === 'health' ? 'brightness(1.42)' : 'brightness(1.16)';
  return [
    { offset: 0, transform: contact, filter: brightness, easing: 'linear' },
    { offset: hold, transform: contact, filter: brightness, easing: 'cubic-bezier(.16,.7,.25,1)' },
    { offset: hold + (1 - hold) * .5, transform: `translate(${-sign * profile.recoilPx * .22}px,0) rotate(${-sign * .7}deg)`, filter: 'brightness(1.04)' },
    { offset: 1, transform: 'translate(0,0) rotate(0deg)', filter: 'brightness(1)' },
  ];
}

/** Shake only the scenery element, with a small overscan to hide exposed edges.
 * HP, intent, cards, resource counters and the camera-independent numbers stay still. */
export function sceneryShakeFrames(profile: HitFeedbackProfile, direction: number): Keyframe[] {
  if (!profile.enabled || profile.shakePx <= 0) return [];
  const sign = direction < 0 ? -1 : 1;
  const p = profile.shakePx;
  return [
    { offset: 0, transform: `translate(${-sign * p}px,${p * .25}px) scale(1.018)` },
    { offset: .28, transform: `translate(${sign * p * .62}px,${-p * .2}px) scale(1.018)` },
    { offset: .6, transform: `translate(${-sign * p * .2}px,0) scale(1.018)` },
    { offset: 1, transform: 'translate(0,0) scale(1)' },
  ];
}

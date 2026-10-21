import { describe, expect, it } from 'vitest';
import { createCombat, reduceCombat } from '../engine';
import { captureCombatTransition } from '../presentation/trace';
import { getHitFeedbackProfile, impactRecoilFrames, sceneryShakeFrames } from '../presentation/hitFeedback';
import { cueDuration } from '../presentation/timeline';
import type { GameSettings } from '../types/game';

const normal: GameSettings = { speed: 'normal', reducedMotion: false };
const hit = { kind: 'impact' as const, amount: 16, blocked: 0, effect: 'damage' };

describe('presentation-only hit feedback', () => {
  it.each([1, 8, 25, 100, 1_000_000])('keeps a %d-damage contact within its cue and caps recoil, shake and particles', (damage) => {
    const profile = getHitFeedbackProfile({ ...hit, amount: damage }, normal, 150);
    expect(profile.holdMs).toBeGreaterThanOrEqual(30);
    expect(profile.holdMs).toBeLessThanOrEqual(55);
    expect(profile.holdMs).toBeLessThan(profile.durationMs);
    expect(profile.shakePx).toBeGreaterThan(0);
    expect(profile.shakePx).toBeLessThanOrEqual(5);
    expect(profile.recoilPx).toBeLessThanOrEqual(18);
    expect(profile.particleCount).toBeLessThanOrEqual(28);
    expect(profile.numberScale).toBeLessThanOrEqual(1.24);
    expect(profile.contactRadius).toBeLessThanOrEqual(74);
  });
  it.each([1, 12, 32, 60, 82.5])('compresses the contact plateau into a %dms budget without extending it', (duration) => {
    const profile = getHitFeedbackProfile(hit, normal, duration);
    expect(profile.durationMs).toBe(duration);
    expect(profile.holdMs).toBeGreaterThan(0);
    expect(profile.holdMs).toBeLessThanOrEqual(duration * .42);
    const frames = impactRecoilFrames(profile, -1);
    expect(frames[0].transform).toBe(frames[1].transform);
    expect(frames[0].filter).toBe(frames[1].filter);
    expect(frames[1].offset).toBeCloseTo(profile.holdMs / duration);
    expect(frames.at(-1)?.offset).toBe(1);
  });
  it.each([
    { speed: 'instant' as const, reducedMotion: false },
    { speed: 'normal' as const, reducedMotion: true },
    { speed: 'fast' as const, reducedMotion: true },
  ])('removes hitstop and shake completely under %j', (settings) => {
    const profile = getHitFeedbackProfile(hit, settings, 150);
    expect(profile.enabled).toBe(false);
    expect(profile.holdMs).toBe(0);
    expect(profile.durationMs).toBe(0);
    expect(profile.shakePx).toBe(0);
    expect(profile.particleCount).toBe(0);
    expect(impactRecoilFrames(profile, 1)).toEqual([]);
    expect(sceneryShakeFrames(profile, 1)).toEqual([]);
  });
  it.each(['poison', 'doom', 'thorns', 'loseEnemyHp', 'loseHp', 'loseMaxHp'])('%s never acts like a physical blow or shakes the camera', (effect) => {
    const profile = getHitFeedbackProfile({ ...hit, effect }, normal, 150);
    expect(profile.holdMs).toBe(0);
    expect(profile.shakePx).toBe(0);
    expect(profile.recoilPx).toBe(0);
    expect(profile.numberScale).toBe(1);
  });
  it('distinguishes block, summon guard, partial block and zero damage without inventing HP loss', () => {
    const shield = getHitFeedbackProfile({ ...hit, amount: 0, blocked: 9 }, normal, 150);
    const guard = getHitFeedbackProfile({ ...hit, amount: 0, blocked: 2, absorbed: 7 }, normal, 150);
    const partial = getHitFeedbackProfile({ ...hit, amount: 2, blocked: 7 }, normal, 150);
    const zero = getHitFeedbackProfile({ ...hit, amount: 0 }, normal, 150);
    expect(shield.surface).toBe('shield');
    expect(guard.surface).toBe('guard');
    expect(partial.surface).toBe('health');
    expect(zero.surface).toBe('none');
    expect(shield.shakePx).toBe(0);
    expect(guard.shakePx).toBe(0);
    expect(zero.holdMs).toBe(0);
  });
  it('low quality reduces particles and camera amplitude without changing timing or the hit value', () => {
    const high = getHitFeedbackProfile(hit, normal, 150);
    const low = getHitFeedbackProfile(hit, normal, 150, true);
    expect(low.durationMs).toBe(high.durationMs);
    expect(low.holdMs).toBe(high.holdMs);
    expect(low.recoilPx).toBe(high.recoilPx);
    expect(low.numberScale).toBe(high.numberScale);
    expect(low.particleCount).toBeLessThan(high.particleCount);
    expect(low.shakePx).toBeLessThan(high.shakePx);
  });
  it('uses actual per-hit engine cues and leaves combat, visual order, RNG and total timeline time untouched', () => {
    const before = createCombat('hit-feedback-contract');
    const card = { ...before.hand[0], cardId: 'pebble_rain' };
    before.hand[0] = card;
    before.enemy.hp = before.enemy.maxHp = 100;
    const action = { type: 'playCard' as const, cardId: card.uid };
    const { result, cues } = captureCombatTransition(before, () => reduceCombat(before, action));
    const raw = JSON.stringify([before, result, cues]);
    const timeline = cues.reduce((sum, cue) => sum + cueDuration(cue, normal), 0);
    const impacts = cues.filter((cue) => cue.kind === 'impact');
    expect(impacts).toHaveLength(3);
    for (const cue of cues) {
      const profile = getHitFeedbackProfile(cue, normal, cueDuration(cue, normal));
      expect(profile.enabled).toBe(cue.kind === 'impact');
      impactRecoilFrames(profile, 1);
      sceneryShakeFrames(profile, -1);
    }
    expect(impacts.map((cue) => cue.amount)).toEqual([3, 3, 3]);
    expect(JSON.stringify([before, result, cues])).toBe(raw);
    expect(cues.reduce((sum, cue) => sum + cueDuration(cue, normal), 0)).toBe(timeline);
    expect(result).toEqual(reduceCombat(before, action));
  });
  it.each([0, -1, NaN, Infinity])('does not produce broken animation frames for budget %s', (duration) => {
    const profile = getHitFeedbackProfile(hit, normal, duration);
    expect(profile.enabled).toBe(false);
    expect(impactRecoilFrames(profile, 1)).toEqual([]);
  });
});

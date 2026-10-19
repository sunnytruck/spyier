import { describe, expect, it } from 'vitest';
import { createCombat } from '../engine';
import type { CombatState } from '../types/game';
import {
  BattleTimeline,
  cueDuration,
  type PresentationEventDetail,
  type PresentationPreferences,
  type TimelineClock,
  type TimelineSnapshot,
} from '../presentation/timeline';
import type { CombatCue } from '../presentation/types';

class ManualClock implements TimelineClock {
  private time = 0;
  private nextId = 1;
  private timers = new Map<number, { at: number; callback: () => void }>();

  now = () => this.time;
  setTimeout = (callback: () => void, delay: number) => {
    const id = this.nextId++;
    this.timers.set(id, { at: this.time + delay, callback });
    return id;
  };
  clearTimeout = (handle: unknown) => { this.timers.delete(handle as number); };

  advance(duration: number) {
    const end = this.time + duration;
    for (;;) {
      const next = [...this.timers].sort((left, right) => left[1].at - right[1].at)[0];
      if (!next || next[1].at > end) break;
      this.time = next[1].at;
      this.timers.delete(next[0]);
      next[1].callback();
    }
    this.time = end;
  }

  get pending() { return this.timers.size; }
}

const NORMAL: PresentationPreferences = { speed: 'normal', reducedMotion: false };

function fixture(preferences: PresentationPreferences = NORMAL) {
  const before = createCombat('PRESENTATION-ONLY');
  const after = structuredClone(before);
  after.enemy.hp -= 6;
  const cues: CombatCue[] = [
    { kind: 'attack', sourceId: before.player.id, targetId: before.enemy.id, frame: before },
    { kind: 'impact', targetId: before.enemy.id, amount: 6, frame: after },
  ];
  const clock = new ManualClock();
  const updates: TimelineSnapshot[] = [];
  const events: PresentationEventDetail[] = [];
  const completed: CombatState[] = [];
  const timeline = new BattleTimeline(preferences, {
    onUpdate: (snapshot) => updates.push(snapshot),
    onCue: (event) => events.push(event),
  }, clock);
  const play = () => timeline.play(before, cues, after, (state) => completed.push(state));
  return { before, after, cues, clock, updates, events, completed, timeline, play };
}

describe('ephemeral battle presentation timeline', () => {
  it('holds pre-hit HP through the attack and reveals damage only at impact, without mutating combat', () => {
    const sample = fixture();
    const untouched = JSON.stringify([sample.before, sample.after]);
    expect(sample.play()).toBe(true);
    expect(sample.timeline.current.frame?.enemy.hp).toBe(sample.before.enemy.hp);
    sample.clock.advance(cueDuration(sample.cues[0], NORMAL) - 1);
    expect(sample.timeline.current.cue?.kind).toBe('attack');
    sample.clock.advance(1);
    expect(sample.timeline.current.cue?.kind).toBe('impact');
    expect(sample.timeline.current.frame?.enemy.hp).toBe(sample.after.enemy.hp);
    sample.clock.advance(cueDuration(sample.cues[1], NORMAL));
    expect(sample.timeline.current).toMatchObject({ busy: false, frame: null, cue: null });
    expect(sample.completed).toEqual([sample.after]);
    expect(sample.events.map(({ kind, phase }) => `${kind}:${phase}`)).toEqual([
      'attack:start', 'attack:end', 'impact:start', 'impact:end',
    ]);
    expect(JSON.stringify([sample.before, sample.after])).toBe(untouched);
  });

  it('rejects overlapping actions before the first timer fires', () => {
    const sample = fixture();
    sample.play();
    expect(sample.play()).toBe(false);
    expect(sample.clock.pending).toBe(1);
    sample.clock.advance(1000);
    expect(sample.completed).toHaveLength(1);
    expect(sample.events.filter((event) => event.phase === 'start')).toHaveLength(2);
    expect(sample.play()).toBe(true);
  });

  it('does not rerender React on animation frames', () => {
    const sample = fixture();
    sample.play();
    expect(sample.updates).toHaveLength(1);
    sample.clock.advance(100);
    expect(sample.timeline.currentCueProgress).toBeGreaterThan(0);
    expect(sample.updates).toHaveLength(1);
    sample.clock.advance(cueDuration(sample.cues[0], NORMAL));
    expect(sample.updates).toHaveLength(2);
  });

  it('retimes the remaining fraction when the user changes speed', () => {
    const sample = fixture();
    sample.play();
    sample.clock.advance(cueDuration(sample.cues[0], NORMAL) / 2);
    sample.timeline.setPreferences({ speed: 'fast', reducedMotion: false });
    expect(sample.timeline.currentCueProgress).toBeCloseTo(0.5);
    const remaining = cueDuration(sample.cues[0], { speed: 'fast', reducedMotion: false }) / 2;
    sample.clock.advance(remaining - 1);
    expect(sample.timeline.current.cue?.kind).toBe('attack');
    sample.clock.advance(1);
    expect(sample.timeline.current.cue?.kind).toBe('impact');
    sample.clock.advance(1000);
    expect(sample.completed).toHaveLength(1);
    expect(sample.clock.pending).toBe(0);
  });

  it.each(['skip', 'cancel'] as const)('%s settles exactly once and clears stale timers', (operation) => {
    const sample = fixture();
    sample.play();
    sample.clock.advance(40);
    sample.timeline[operation]();
    sample.timeline[operation]();
    sample.clock.advance(10_000);
    expect(sample.completed).toEqual([sample.after]);
    expect(sample.timeline.current.busy).toBe(false);
    expect(sample.clock.pending).toBe(0);
    expect(sample.events.filter((event) => event.kind === 'impact')).toHaveLength(0);
  });

  it.each([
    { speed: 'instant', reducedMotion: false },
    { speed: 'normal', reducedMotion: true },
  ] as const)('settles synchronously without any animation timer for %j', (preferences) => {
    const sample = fixture(preferences);
    sample.play();
    expect(sample.timeline.current.busy).toBe(false);
    expect(sample.completed).toEqual([sample.after]);
    expect(sample.events).toHaveLength(0);
    expect(sample.clock.pending).toBe(0);
  });

  it('finishes immediately if reduced motion is enabled during playback', () => {
    const sample = fixture();
    sample.play();
    sample.timeline.setPreferences({ speed: 'normal', reducedMotion: true });
    expect(sample.timeline.current.busy).toBe(false);
    expect(sample.completed).toEqual([sample.after]);
    expect(sample.clock.pending).toBe(0);
  });

  it('caps long multi-hit sequences to a readable action budget', () => {
    for (const speed of ['normal', 'fast'] as const) {
      const sample = fixture({ speed, reducedMotion: false });
      const cues = Array.from({ length: 60 }, (_, index) => sample.cues[index % 2]);
      sample.timeline.play(sample.before, cues, sample.after, (state) => sample.completed.push(state));
      sample.clock.advance(speed === 'normal' ? 4001 : 1801);
      expect(sample.completed).toEqual([sample.after]);
      expect(sample.events.filter(({ phase }) => phase === 'start')).toHaveLength(60);
    }
  });

  it('unmount disposal suppresses callbacks and cancels all work', () => {
    const sample = fixture();
    sample.play();
    const updateCount = sample.updates.length;
    sample.timeline.dispose();
    sample.clock.advance(1000);
    expect(sample.updates).toHaveLength(updateCount);
    expect(sample.completed).toHaveLength(0);
    expect(sample.clock.pending).toBe(0);
    expect(sample.play()).toBe(false);
  });
});

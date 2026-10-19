import type { CombatState, GameSettings } from '../types/game';
import type { CombatCue } from './types';

export interface PresentationPreferences extends Pick<GameSettings, 'speed' | 'reducedMotion'> {
  effectsQuality?: 'auto' | 'full' | 'low';
}

/** Injectable clock keeps timing independent of React, the engine, and wall-clock tests. */
export interface TimelineClock {
  now(): number;
  setTimeout(callback: () => void, delay: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface TimelineSnapshot {
  busy: boolean;
  frame: CombatState | null;
  cue: CombatCue | null;
  cueIndex: number;
  sequence: number;
  progress: number;
  duration: number;
}

export interface PresentationEventDetail {
  kind: CombatCue['kind'];
  cue: CombatCue;
  phase: 'start' | 'end';
  sequence: number;
}

export interface TimelineCallbacks {
  onUpdate(snapshot: TimelineSnapshot): void;
  onCue?(event: PresentationEventDetail): void;
}

const NORMAL_DURATIONS: Record<CombatCue['kind'], number> = {
  cardPlay: 120,
  attack: 220,
  impact: 150,
  block: 200,
  heal: 260,
  status: 260,
  power: 320,
  draw: 240,
  discard: 160,
  exhaust: 220,
  generate: 240,
  resource: 350,
  death: 400,
  turn: 85,
};

export function cueDuration(cue: CombatCue, preferences: PresentationPreferences): number {
  if (preferences.speed === 'instant' || preferences.reducedMotion) return 0;
  return NORMAL_DURATIONS[cue.kind] * (preferences.speed === 'fast' ? 0.55 : 1);
}

const browserClock: TimelineClock = {
  now: () => performance.now(),
  setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

function idleSnapshot(sequence = 0): TimelineSnapshot {
  return { busy: false, frame: null, cue: null, cueIndex: -1, sequence, progress: 0, duration: 0 };
}

/**
 * An ephemeral renderer of an already resolved action. No callback changes combat state.
 * Cue frames are immutable engine snapshots: attack precedes impact, then impact reveals HP.
 */
export class BattleTimeline {
  private preferences: PresentationPreferences;
  private snapshot: TimelineSnapshot = idleSnapshot();
  private cues: readonly CombatCue[] = [];
  private after: CombatState | null = null;
  private completion: ((state: CombatState) => void) | null = null;
  private timer: unknown = null;
  private startedAt = 0;
  private duration = 0;
  private durationScale = 1;
  private generation = 0;
  private disposed = false;

  constructor(
    preferences: PresentationPreferences,
    private readonly callbacks: TimelineCallbacks,
    private readonly clock: TimelineClock = browserClock,
  ) {
    this.preferences = { ...preferences };
  }

  get current(): TimelineSnapshot {
    return this.snapshot;
  }

  /** Renderers may sample this from their own animation frame without causing React updates. */
  get currentCueProgress(): number {
    if (!this.snapshot.busy || this.duration <= 0) return 0;
    return Math.min(1, Math.max(0, (this.clock.now() - this.startedAt) / this.duration));
  }

  /** Returns false while another action is presenting; callers may synchronously gate input. */
  play(
    before: CombatState,
    cues: readonly CombatCue[],
    after: CombatState,
    onComplete?: (state: CombatState) => void,
  ): boolean {
    if (this.disposed || this.snapshot.busy) return false;
    this.clearTimer();
    this.generation += 1;
    this.cues = [...cues];
    this.after = after;
    this.completion = onComplete ?? null;
    this.snapshot = {
      busy: true,
      frame: before,
      cue: null,
      cueIndex: -1,
      sequence: this.snapshot.sequence,
      progress: 0,
      duration: 0,
    };
    if (cues.length === 0 || this.immediate) {
      this.finish();
    } else {
      this.updateDurationScale();
      this.startCue(0);
    }
    return true;
  }

  /** Live speed changes retain progress within the current cue. */
  setPreferences(preferences: PresentationPreferences): void {
    if (this.disposed) return;
    const elapsed = this.snapshot.busy ? this.clock.now() - this.startedAt : 0;
    const progress = this.duration > 0 ? Math.min(1, elapsed / this.duration) : 0;
    this.preferences = { ...preferences };
    if (!this.snapshot.busy || !this.snapshot.cue) return;
    if (this.immediate) {
      this.finish();
      return;
    }
    this.clearTimer();
    this.generation += 1;
    this.updateDurationScale();
    this.duration = this.scaledDuration(this.snapshot.cue);
    this.startedAt = this.clock.now() - progress * this.duration;
    this.snapshot = { ...this.snapshot, duration: this.duration };
    this.callbacks.onUpdate(this.snapshot);
    this.scheduleTick(this.generation);
  }

  skip(): void {
    if (this.snapshot.busy) this.finish();
  }

  /** Cancel also settles the action once, so external synchronous input gates are released. */
  cancel(): void {
    if (this.snapshot.busy) this.finish();
  }

  /** Unmount cleanup suppresses completion callbacks and clears every pending timer. */
  dispose(): void {
    this.disposed = true;
    this.generation += 1;
    this.clearTimer();
    this.completion = null;
    this.cues = [];
    this.after = null;
    this.snapshot = idleSnapshot(this.snapshot.sequence);
  }

  private get immediate(): boolean {
    return this.preferences.reducedMotion || this.preferences.speed === 'instant';
  }

  private startCue(index: number): void {
    if (index >= this.cues.length) {
      this.finish();
      return;
    }
    const cue = this.cues[index];
    this.startedAt = this.clock.now();
    this.duration = this.scaledDuration(cue);
    this.snapshot = {
      busy: true,
      frame: cue.frame,
      cue,
      cueIndex: index,
      sequence: this.snapshot.sequence + 1,
      progress: index / this.cues.length,
      duration: this.duration,
    };
    this.callbacks.onCue?.({ kind: cue.kind, cue, phase: 'start', sequence: this.snapshot.sequence });
    this.callbacks.onUpdate(this.snapshot);
    this.scheduleTick(this.generation);
  }

  private tick(generation: number): void {
    this.timer = null;
    if (this.disposed || generation !== this.generation || !this.snapshot.busy || !this.snapshot.cue) return;
    const nextIndex = this.snapshot.cueIndex + 1;
    this.endCue();
    this.snapshot = { ...this.snapshot, cue: null };
    this.startCue(nextIndex);
  }

  private scheduleTick(generation: number): void {
    const remaining = Math.max(0, this.duration - (this.clock.now() - this.startedAt));
    // React receives only semantic cue boundaries. WAAPI / canvas owns continuous motion.
    this.timer = this.clock.setTimeout(() => this.tick(generation), remaining);
  }

  private endCue(): void {
    const { cue, sequence } = this.snapshot;
    if (cue) this.callbacks.onCue?.({ kind: cue.kind, cue, phase: 'end', sequence });
  }

  private updateDurationScale(): void {
    const total = this.cues.reduce((sum, cue) => sum + cueDuration(cue, this.preferences), 0);
    const budget = this.preferences.speed === 'fast' ? 1800 : 4000;
    this.durationScale = total > 0 ? Math.min(1, budget / total) : 1;
  }

  private scaledDuration(cue: CombatCue): number {
    return cueDuration(cue, this.preferences) * this.durationScale;
  }

  private finish(): void {
    this.generation += 1;
    this.clearTimer();
    this.endCue();
    const after = this.after;
    const completion = this.completion;
    this.completion = null;
    this.after = null;
    this.cues = [];
    this.snapshot = idleSnapshot(this.snapshot.sequence);
    this.callbacks.onUpdate(this.snapshot);
    if (after) completion?.(after);
  }

  private clearTimer(): void {
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
  }
}

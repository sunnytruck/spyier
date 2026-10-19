import { useCallback, useEffect, useRef, useState } from 'react';
import type { CombatState } from '../types/game';
import type { CombatCue } from './types';
import {
  BattleTimeline,
  type PresentationEventDetail,
  type PresentationPreferences,
  type TimelineSnapshot,
} from './timeline';

const INITIAL_SNAPSHOT: TimelineSnapshot = {
  busy: false, frame: null, cue: null, cueIndex: -1, sequence: 0, progress: 0, duration: 0,
};

/** Future audio adapters can subscribe without importing or changing the combat engine. */
function broadcastCue(detail: PresentationEventDetail): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<PresentationEventDetail>('iwason:presentation', { detail }));
  }
}

export function useBattlePresentation(settings: PresentationPreferences) {
  const [snapshot, setSnapshot] = useState<TimelineSnapshot>(INITIAL_SNAPSHOT);
  const mounted = useRef(true);
  const timelineRef = useRef<BattleTimeline | null>(null);
  if (!timelineRef.current) {
    timelineRef.current = new BattleTimeline(settings, {
      onUpdate: (next) => { if (mounted.current) setSnapshot(next); },
      onCue: broadcastCue,
    });
  }

  useEffect(() => {
    mounted.current = true;
    // React StrictMode replays effect setup after cleanup without another render.
    if (!timelineRef.current) {
      timelineRef.current = new BattleTimeline(settings, {
        onUpdate: (next) => { if (mounted.current) setSnapshot(next); },
        onCue: broadcastCue,
      });
    }
    return () => {
      mounted.current = false;
      timelineRef.current?.dispose();
      timelineRef.current = null;
    };
  }, []);

  useEffect(() => {
    timelineRef.current?.setPreferences(settings);
  }, [settings.speed, settings.reducedMotion, settings.effectsQuality]);

  const play = useCallback((
    before: CombatState,
    cues: readonly CombatCue[],
    after: CombatState,
    onComplete?: (state: CombatState) => void,
  ) => timelineRef.current?.play(before, cues, after, (state) => {
    if (mounted.current) onComplete?.(state);
  }) ?? false, []);
  const skip = useCallback(() => {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('iwason:presentation-reset'));
    timelineRef.current?.skip();
  }, []);
  const cancel = useCallback(() => {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('iwason:presentation-reset'));
    timelineRef.current?.cancel();
  }, []);

  return {
    displayState: snapshot.frame,
    busy: snapshot.busy,
    activeCue: snapshot.cue,
    activeSequence: snapshot.sequence,
    progress: snapshot.progress,
    duration: snapshot.duration,
    activeDuration: snapshot.duration,
    play,
    skip,
    cancel,
  };
}

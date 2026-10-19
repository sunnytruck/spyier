import type { CombatState } from '../types/game';
import type { CombatCue, CombatCueInput, CombatTraceContext } from './types';

interface CombatTraceObserver {
  cues: CombatCue[];
  context: CombatTraceContext;
  dead: Set<string>;
  states: Set<CombatState>;
}

// Observation is attached to object identity, never added to engine or save data.
// There is no ambient "current battle": simultaneous captures remain independent.
const observers = new WeakMap<CombatState, CombatTraceObserver>();

function actors(state: CombatState): [string, number][] {
  const enemies = state.enemies && state.enemies.length > 1 ? state.enemies : [state.enemy];
  return [
    ['player', state.player.hp],
    ...enemies.map((enemy): [string, number] => [enemy.instanceId ?? enemy.id, enemy.hp]),
  ];
}

/** Observe one synchronous reducer operation without changing its result or RNG. */
export function captureCombatTransition<T>(
  before: CombatState,
  apply: () => T,
): { result: T; cues: CombatCue[] } {
  const previous = observers.get(before);
  const observer: CombatTraceObserver = {
    cues: [],
    context: {},
    dead: new Set(actors(before).filter(([, hp]) => hp <= 0).map(([id]) => id)),
    states: new Set([before]),
  };
  observers.set(before, observer);
  try {
    return { result: apply(), cues: observer.cues };
  } finally {
    for (const state of observer.states) {
      if (observers.get(state) === observer) observers.delete(state);
    }
    if (previous) observers.set(before, previous);
  }
}

/** Reducer clones inherit the observer, while keeping their serialized shape exact. */
export function inheritCombatTrace(before: CombatState, next: CombatState): void {
  const observer = observers.get(before);
  if (!observer) return;
  observers.set(next, observer);
  observer.states.add(next);
}

export function emitCombatCue(state: CombatState, cue: CombatCueInput): void {
  const observer = observers.get(state);
  if (!observer) return;
  observer.cues.push(structuredClone({ ...observer.context, ...cue, frame: state }));
}

/** Scope attribution to a card, enemy, poison tick, orb, or summon operation. */
export function withCombatTraceContext<T>(
  state: CombatState,
  context: CombatTraceContext,
  apply: () => T,
): T {
  const observer = observers.get(state);
  if (!observer) return apply();
  const previous = observer.context;
  observer.context = { ...previous, ...context };
  try {
    return apply();
  } finally {
    observer.context = previous;
  }
}

/** A death is emitted once, including a single enemy dying in a living group. */
export function traceCombatDeaths(state: CombatState): void {
  const observer = observers.get(state);
  if (!observer) return;
  for (const [id, hp] of actors(state)) {
    if (hp > 0 || observer.dead.has(id)) continue;
    observer.dead.add(id);
    emitCombatCue(state, { kind: 'death', targetId: id });
  }
}

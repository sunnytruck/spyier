import type { CardInstance, CombatState } from '../types/game';

/** Transient presentation messages. These never belong to a saved combat state. */
export interface CombatCue {
  kind:
    | 'cardPlay'
    | 'attack'
    | 'impact'
    | 'block'
    | 'heal'
    | 'status'
    | 'power'
    | 'draw'
    | 'discard'
    | 'exhaust'
    | 'generate'
    | 'resource'
    | 'death'
    | 'turn';
  sourceId?: string;
  targetId?: string;
  card?: CardInstance;
  cards?: CardInstance[];
  amount?: number;
  blocked?: number;
  absorbed?: number;
  label?: string;
  resource?: string;
  status?: string;
  effect?: string;
  fromZone?: string;
  toZone?: string;
  /** Presentation-only position in the existing ordered orb array. */
  orbIndex?: number;
  orbMode?: 'channel' | 'passive' | 'evoke';
  resourceAction?: string;
  frame: CombatState;
}

export type CombatCueInput = Omit<CombatCue, 'frame'>;
export type CombatTraceContext = Pick<CombatCueInput, 'sourceId' | 'card' | 'effect' | 'label' | 'orbIndex' | 'orbMode' | 'resourceAction'>;

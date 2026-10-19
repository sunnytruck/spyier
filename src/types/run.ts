import type { CardInstance, ClassId, CombatAction, CombatState } from './game';

export type NodeType = 'battle' | 'elite' | 'event' | 'shop' | 'rest' | 'treasure' | 'boss';
export interface MapNode {
  id: string;
  floor: number;
  lane: number;
  type: NodeType;
  connections: string[];
}
export interface FloorMap {
  floors: number;
  nodes: MapNode[];
}
export type RunScreen =
  | 'map'
  | 'combat'
  | 'reward'
  | 'relic'
  | 'event'
  | 'shop'
  | 'rest'
  | 'upgrade'
  | 'victory'
  | 'defeat';
export interface RunReward {
  cardIds: string[];
  gold: number;
  relicId: string | null;
  potionId: string | null;
  /** New class runs select their final card before entering the first-act victory screen. */
  completesRun?: true;
}
export interface ShopState {
  cardIds: string[];
  relicId: string | null;
  potionId: string | null;
  purchased: string[];
  removed: boolean;
}
export interface RunState {
  version: 2;
  seed: string;
  /** Missing on pre-class saves, which retain the original deck and reward pool. */
  classId?: ClassId;
  rngState: number;
  screen: RunScreen;
  floor: number;
  currentNodeId: string | null;
  map: FloorMap;
  visited: string[];
  hp: number;
  maxHp: number;
  gold: number;
  deck: CardInstance[];
  relicIds: string[];
  potions: (string | null)[];
  combat: CombatState | null;
  reward: RunReward | null;
  shop: ShopState | null;
  eventId: string | null;
  nextCardId: number;
  stats: { battlesWon: number; elitesDefeated: number; cardsAdded: number };
  log: string[];
}
export type RunAction =
  | { type: 'chooseNode'; nodeId: string }
  | { type: 'combat'; action: CombatAction }
  | { type: 'takeCard'; cardId: string | null }
  | { type: 'takeRelic' }
  | { type: 'buyCard'; cardId: string }
  | { type: 'buyRelic' }
  | { type: 'buyPotion' }
  | { type: 'removeCard'; cardUid: string }
  | { type: 'rest'; choice: 'heal' | 'upgrade' }
  | { type: 'upgradeCard'; cardUid: string }
  | { type: 'eventChoice'; index: number }
  | { type: 'leaveNode' }
  | { type: 'usePotion'; slot: number; targetId?: string };

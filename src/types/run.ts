import type { CardInstance, ClassId, CombatAction, CombatState } from './game';
import type { BlessingAction, BlessingEncounter, BlessingRecord } from './blessing';
import type { RelicAcquisitionAction, RelicAcquisitionState, RelicPersistentState } from './relics';

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
  | 'blessing'
  | 'relicAcquisition'
  | 'map'
  | 'combat'
  | 'reward'
  | 'relic'
  | 'event'
  | 'eventResult'
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
  /** New boss rolls only: saved older choices are not rerolled. */
  rareOnly?: true;
  /** Additional already-rolled relic rewards, after relicId. */
  relicIds?: string[];
}
export interface ShopState {
  cardIds: string[];
  /** Rolled prices are saved with new stock. Missing on older saves: all cards cost 55. */
  cardPrices?: Record<string, number>;
  relicId: string | null;
  potionId: string | null;
  purchased: string[];
  removed: boolean;
}
/** An event is committed before this presentation is shown; continuing never rerolls it. */
export interface EventResult {
  eventId: string;
  choiceIndex: number;
  choiceLabel: string;
  description: string;
  hpChange: number;
  goldChange: number;
  upgradedCards: CardInstance[];
  addedCards: CardInstance[];
  removedCards: CardInstance[];
  relicIds: string[];
  potionIds: string[];
  combatEnemyIds?: string[];
  combatReward?: { gold: number; relic: boolean };
}
export interface EventCombat {
  eventId: string;
  bonusGold: number;
  relicOnVictory: boolean;
}
export interface RunState {
  version: 2;
  seed: string;
  /** Missing on pre-class saves, which retain the original deck and reward pool. */
  classId?: ClassId;
  /** Only new class runs opt in. Already saved rooms and legacy reward rolls remain intact. */
  rewardRules?: 'rarity-v1';
  relicRules?: 'sources-v1';
  relicState?: RelicPersistentState;
  relicAcquisition?: RelicAcquisitionState | null;
  /** Absent on classic single-act saves. Only new blessed campaigns progress through acts. */
  act?: number;
  maxActs?: number;
  actHistory?: { act: number; map: FloorMap; visited: string[]; hp: number; maxHp: number; gold: number }[];
  blessing?: BlessingEncounter | null;
  blessingHistory?: BlessingRecord[];
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
  /** Optional extensions keep version-2 saves from before the event expansion valid. */
  eventHistory?: string[];
  eventResult?: EventResult | null;
  eventCombat?: EventCombat | null;
  nextCardId: number;
  stats: { battlesWon: number; elitesDefeated: number; cardsAdded: number };
  log: string[];
}
export type RunAction = BlessingAction | RelicAcquisitionAction
  | { type: 'ascendAct' }
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
  | { type: 'continueEvent' }
  | { type: 'leaveNode' }
  | { type: 'usePotion'; slot: number; targetId?: string };

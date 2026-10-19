export type CardType = 'attack' | 'skill' | 'power';
export type Target = 'player' | 'enemy';
export type PowerKey =
  | 'stillness'
  | 'thorns'
  | 'strengthOnTurn'
  | 'poisonAura'
  | 'drawOnTurn'
  | 'blockOnAttack';

export type Effect =
  | {
      type: 'damage';
      amount: number;
      hits?: number;
      divineBonus?: number;
      all?: boolean;
      fromBlock?: boolean;
    }
  | { type: 'block'; amount: number }
  | { type: 'gauge'; amount: number }
  | { type: 'draw'; amount: number }
  | { type: 'energy'; amount: number }
  | { type: 'heal'; amount: number }
  | {
      type: 'status';
      target: Target | 'allEnemies';
      status: 'strength' | 'weak' | 'vulnerable' | 'poison';
      amount: number;
    }
  | { type: 'power'; power: PowerKey; amount: number }
  | { type: 'multiplyPoison'; amount: number };

export interface CardDefinition {
  id: string;
  name: string;
  type: CardType;
  cost: number;
  defense: boolean;
  description: string;
  upgradedDescription: string;
  flavor: string;
  glyph: string;
  effects: Effect[];
  upgradedEffects: Effect[];
  exhaust?: boolean;
  upgradedCost?: number;
  rarity?: 'common' | 'uncommon' | 'rare';
  tags?: string[];
}

export interface CardInstance {
  uid: string;
  cardId: string;
  upgraded: boolean;
}

export interface Actor {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  strength: number;
  weak: number;
  vulnerable: number;
  poison: number;
}

export interface EnemyIntent {
  kind: 'attack' | 'defend' | 'buff' | 'debuff';
  label: string;
  description: string;
  damage?: number;
  hits?: number;
  block?: number;
  strength?: number;
  weak?: number;
}

export interface EnemyDefinition extends Actor {
  intents: EnemyIntent[];
}

export interface EnemyState extends Actor {
  instanceId?: string;
  intentIndex: number;
  intent: EnemyIntent;
}

export interface BattleLog {
  id: number;
  turn: number;
  text: string;
  kind: 'info' | 'damage' | 'block' | 'gauge' | 'result';
}

export interface CombatEvent {
  id: number;
  target: Target;
  kind: 'damage' | 'block' | 'heal' | 'gauge' | 'power';
  amount: number;
  enemyId?: string;
}

export interface CombatState {
  version: 1;
  seed: string;
  rngState: number;
  turn: number;
  phase: 'player' | 'victory' | 'defeat';
  player: Actor;
  enemy: EnemyState;
  enemies?: EnemyState[];
  selectedEnemyId?: string;
  energy: number;
  maxEnergy: number;
  jitto: number;
  deck: CardInstance[];
  hand: CardInstance[];
  drawPile: CardInstance[];
  discardPile: CardInstance[];
  exhaustPile: CardInstance[];
  powers: CardInstance[];
  stillness: number;
  powerStacks?: Partial<Record<PowerKey, number>>;
  relicIds?: string[];
  potions?: (string | null)[];
  relicCounters?: Record<string, number>;
  cardsPlayedThisTurn: number;
  stats: { cardsPlayed: number; damageDealt: number };
  log: BattleLog[];
  events: CombatEvent[];
  nextId: number;
}

export interface CombatOptions {
  deck?: CardInstance[];
  hp?: number;
  maxHp?: number;
  relicIds?: string[];
  potions?: (string | null)[];
}

export type CombatAction =
  | { type: 'playCard'; cardId: string; targetId?: string }
  | { type: 'selectEnemy'; targetId: string }
  | { type: 'usePotion'; slot: number; targetId?: string }
  | { type: 'endTurn' };

export interface GameSettings {
  speed: 'normal' | 'fast' | 'instant';
  reducedMotion: boolean;
}

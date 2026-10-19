export type CardType = 'attack' | 'skill' | 'power';
export type Target = 'player' | 'enemy';
export type ClassId = 'berserker' | 'assassin' | 'oracle' | 'necromancer' | 'machinist';
export type OrbType = 'lightning' | 'frost';
export type CardDestination = 'hand' | 'drawPile' | 'discardPile';
export type PowerKey =
  | 'stillness'
  | 'thorns'
  | 'strengthOnTurn'
  | 'poisonAura'
  | 'drawOnTurn'
  | 'blockOnAttack'
  | 'knifeDamage'
  | 'knivesOnTurn'
  | 'focusOnTurn';

export type Effect =
  | {
      type: 'damage';
      amount: number;
      hits?: number;
      divineBonus?: number;
      all?: boolean;
      fromBlock?: boolean;
      fromForge?: boolean;
      doomFromDamage?: boolean;
    }
  | { type: 'block'; amount: number }
  | { type: 'gauge'; amount: number }
  | { type: 'draw'; amount: number; perOrbType?: boolean }
  | { type: 'energy'; amount: number }
  | { type: 'heal'; amount: number }
  | {
      type: 'status';
      target: Target | 'allEnemies';
      status: 'strength' | 'weak' | 'vulnerable' | 'poison';
      amount: number;
    }
  | { type: 'power'; power: PowerKey; amount: number }
  | { type: 'multiplyPoison'; amount: number }
  | { type: 'loseHp'; amount: number }
  | { type: 'discard'; amount: number }
  | { type: 'exhaustChoice'; amount: number }
  | { type: 'generate'; cardId: string; amount: number; destination: CardDestination; upgraded?: boolean }
  | { type: 'copySelf'; destination: CardDestination }
  | { type: 'fetchGenerated'; cardId: string }
  | { type: 'gainStars'; amount: number }
  | { type: 'starBurst'; amount: number; all?: boolean }
  | { type: 'forge'; amount: number }
  | { type: 'summon'; amount: number }
  | { type: 'summonDamage'; amount: number; plusSummonHp?: boolean }
  | { type: 'doom'; amount: number; all?: boolean }
  | { type: 'soul'; amount: number; upgraded?: boolean; destination?: CardDestination }
  | { type: 'channel'; orb: OrbType; amount: number }
  | { type: 'evoke'; times: number }
  | { type: 'focus'; amount: number; temporary?: boolean }
  | { type: 'nextTurnEnergy'; amount: number }
  | { type: 'xChannel'; orb: OrbType; bonus: number };

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
  classId?: ClassId | 'colorless';
  sourceCardId?: string;
  metadataProvisional?: boolean;
  tokenOnly?: boolean;
  rewardEligible?: boolean;
  xCost?: boolean;
  upgradedExhaust?: boolean;
  retain?: boolean;
  upgradedRetain?: boolean;
  ethereal?: boolean;
  innate?: boolean;
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
  doom?: number;
}

/** Original IWASON keyword rules; absent on legacy battles and saves. */
export interface ClassResources {
  stars: number;
  starsGainedThisTurn: number;
  forge: number;
  ostyHp: number;
  focus: number;
  temporaryFocus: number;
  orbs: OrbType[];
  nextTurnEnergy: number;
}

export interface PendingCardChoice {
  mode: 'discard' | 'exhaust';
  amount: number;
  resume: {
    effects: Effect[];
    defense: boolean;
    targetId?: string;
    sourceCard?: CardInstance;
    xEnergy?: number;
  };
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
  classId?: ClassId;
  classResources?: ClassResources;
  generatedCards?: CardInstance[];
  pendingChoice?: PendingCardChoice;
}

export interface CombatOptions {
  deck?: CardInstance[];
  hp?: number;
  maxHp?: number;
  relicIds?: string[];
  potions?: (string | null)[];
  classId?: ClassId;
}

export type CombatAction =
  | { type: 'playCard'; cardId: string; targetId?: string }
  | { type: 'selectEnemy'; targetId: string }
  | { type: 'usePotion'; slot: number; targetId?: string }
  | { type: 'chooseCards'; cardIds: string[] }
  | { type: 'endTurn' };

export interface GameSettings {
  speed: 'normal' | 'fast' | 'instant';
  reducedMotion: boolean;
}

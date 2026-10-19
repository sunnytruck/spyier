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
  | 'focusOnTurn'
  | 'energyOnTurn';

/** Read-only combat quantities shared by reusable effect handlers and their previews. */
export type CombatValue = 'handSize' | 'drawPileSize' | 'discardPileSize' | 'exhaustPileSize'
  | 'enemyPoison' | 'enemyWeak' | 'enemyVulnerable' | 'enemyDoom' | 'enemyDebuffs' | 'totalEnemyPoison'
  | 'orbCount' | 'distinctOrbCount' | 'livingEnemyCount';
export type EffectCondition =
  | { type: 'targetStatus'; status: 'poison' | 'weak' | 'vulnerable'; min?: number }
  | { type: 'targetAttacking' }
  | { type: 'cardsPlayedAtMost'; amount: number };
export interface EffectScaling { value: CombatValue; multiplier: number }

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
      randomTarget?: boolean;
      xHits?: boolean;
      xDoubleAt?: number;
      hitsPer?: CombatValue;
      bonusPer?: EffectScaling;
      hitsIf?: { condition: EffectCondition; extra: number };
    }
  | { type: 'block'; amount: number; bonusPer?: EffectScaling }
  | { type: 'gauge'; amount: number }
  | { type: 'draw'; amount: number; perOrbType?: boolean }
  | { type: 'energy'; amount: number }
  | { type: 'heal'; amount: number }
  | {
      type: 'status';
      target: Target | 'allEnemies';
      status: 'strength' | 'weak' | 'vulnerable' | 'poison';
      amount: number;
      allowNegative?: boolean;
    }
  | { type: 'power'; power: PowerKey; amount: number }
  | { type: 'multiplyPoison'; amount: number }
  | { type: 'loseHp'; amount: number }
  | { type: 'discard'; amount: number }
  | { type: 'exhaustChoice'; amount: number }
  | { type: 'exhaustRandom'; amount: number }
  | { type: 'moveChoice'; from: 'hand' | 'discardPile'; to: 'drawPile' | 'hand'; amount: number }
  | { type: 'drawTo'; amount: number }
  | { type: 'redraw' }
  | { type: 'multiply'; resource: 'energy' | 'block'; amount: number }
  | { type: 'conditional'; condition: EffectCondition; effects: Effect[] }
  | { type: 'nextTurn'; effects: Effect[] }
  | { type: 'temporaryStatus'; target: Target | 'allEnemies'; status: 'strength' | 'weak' | 'vulnerable' | 'poison'; amount: number; allowNegative?: boolean }
  | { type: 'temporaryPower'; power: PowerKey; amount: number }
  | { type: 'generate'; cardId: string; amount: number; destination: CardDestination; upgraded?: boolean }
  | { type: 'copySelf'; destination: CardDestination }
  | { type: 'fetchGenerated'; cardId: string }
  | { type: 'gainStars'; amount: number }
  | { type: 'starBurst'; amount: number; all?: boolean }
  | { type: 'forge'; amount: number }
  | { type: 'summon'; amount: number }
  | { type: 'summonDamage'; amount: number; plusSummonHp?: boolean }
  | { type: 'doom'; amount: number; all?: boolean; bonusPer?: EffectScaling }
  | { type: 'soul'; amount: number; upgraded?: boolean; destination?: CardDestination }
  | { type: 'channel'; orb: OrbType; amount: number; bonusPer?: EffectScaling }
  | { type: 'evoke'; times: number; fromEnergy?: boolean; all?: boolean }
  | { type: 'focus'; amount: number; temporary?: boolean; bonusPer?: EffectScaling }
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
  upgradedInnate?: boolean;
  /** Curses/status cards may be deliberate draw burdens rather than playable effects. */
  unplayable?: boolean;
  unupgradable?: boolean;
  curse?: boolean;
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
  vulnerable?: number;
  poison?: number;
  /** Support affects the other living enemies, never the source itself. */
  alliesBlock?: number;
  alliesStrength?: number;
  /** A field-wide strike hits the player and their summon independently. */
  allTargets?: boolean;
}

export interface EnemyDefinition extends Actor {
  intents: EnemyIntent[];
  description?: string;
  gimmick?: string;
  reaction?: { cardType: CardType; block?: number; strength?: number };
  phases?: {
    trigger: { type: 'turn'; at: number } | { type: 'hpBelow'; ratio: number };
    intents: EnemyIntent[];
  }[];
}

export interface EnemyState extends Actor {
  instanceId?: string;
  intentIndex: number;
  intent: EnemyIntent;
  doom?: number;
  /** Absent for legacy patterns; phase changes are announced for the next turn. */
  intentPhase?: number;
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
  mode: 'discard' | 'exhaust' | 'topdeck' | 'retrieve';
  /** Missing means the hand, preserving existing suspended-card save data. */
  sourceZone?: 'hand' | 'discardPile';
  amount: number;
  resume: {
    effects: Effect[];
    defense: boolean;
    targetId?: string;
    sourceCard?: CardInstance;
    xEnergy?: number;
  };
}

export type TurnModifier =
  | { kind: 'status'; targetId: string; status: 'strength' | 'weak' | 'vulnerable' | 'poison'; amount: number }
  | { kind: 'power'; power: PowerKey; amount: number };

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
  /** Added lazily by new effects; legacy combat states retain their exact serialized shape. */
  scheduledEffects?: { effects: Effect[]; sourceCard?: CardInstance }[];
  turnModifiers?: TurnModifier[];
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
  effectsQuality?: 'auto' | 'full' | 'low';
}

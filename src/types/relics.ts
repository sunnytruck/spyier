import type { CardInstance, CardType, ClassId } from './game';

export type RelicAcquisitionKind = 'remove' | 'upgrade' | 'transform' | 'copy' | 'chooseCard';
export type RelicAcquireOperation =
  | { type: 'maxHp' | 'gold' | 'loseHp' | 'loseMaxHp' | 'potionSlots'; amount: number }
  | { type: 'heal'; amount?: number; percent?: number; full?: boolean }
  | { type: 'loseAllGold' | 'upgradeStarter' | 'transformBasics' }
  | { type: 'addCards'; cardIds: string[] }
  | { type: 'randomUpgrade'; count: number; cardType?: CardType; basicKind?: 'strike' | 'guard' }
  | { type: 'randomCards'; count: number; rarity?: 'common' | 'uncommon' | 'rare' }
  | { type: 'select'; kind: RelicAcquisitionKind; count: number; minCount?: number; upgraded?: boolean; fixedCardId?: string; pool?: 'own' | 'colorless'; offerCount?: number };

/** Acquisition/room rules are separate from combat trigger definitions. */
export interface RelicRunEffect {
  acquire?: RelicAcquireOperation[];
  goldPercent?: number;
  goldMaxHp?: number;
  addCardGold?: number;
  addCardHealEvery?: { count: number; heal: number };
  addCardUpgradeTypes?: CardType[];
  addCardCopy?: boolean;
  curseMaxHp?: number;
  roomHeal?: Partial<Record<'shop' | 'rest' | 'event', number>>;
  restVisitDeckHeal?: { every: number; heal: number };
  restVisitEnergy?: number;
  restHeal?: number;
  restMaxHp?: number;
  shopDiscountPercent?: number;
  noGold?: boolean;
  victoryMaxHp?: number;
  /** Counts normal victories only; random upgrade is committed after each threshold. */
  normalBattleUpgradeEvery?: number;
  eliteUpgradeCount?: number;
}
export interface RelicPersistentState {
  /** Run counters only; combat counters remain in the combat state. */
  [key: string]: number;
}
export interface RelicAcquisitionReceipt {
  relicId: string;
  hpChange: number;
  maxHpChange: number;
  goldChange: number;
  addedCards: CardInstance[];
  removedCards: CardInstance[];
  upgradedCards: CardInstance[];
  replacedRelicIds: string[];
  description: string;
}
export interface RelicAcquisitionState {
  version: 1;
  relicId: string;
  source: 'reward' | 'shop' | 'event' | 'blessing';
  acquisitionKey: string;
  returnScreen: string;
  stage: 'select' | 'result';
  kind?: RelicAcquisitionKind;
  count: number;
  minCount: number;
  eligibleCardUids: string[];
  offeredCardIds: string[];
  /** Seeded results are frozen on acquisition, before target selection. */
  replacements: Record<string, string>;
  selectedCardUids: string[];
  selectedCardIds: string[];
  receipt: RelicAcquisitionReceipt | null;
  basis: { hp: number; maxHp: number; gold: number; deck: CardInstance[]; relicIds: string[]; nextCardId: number; rngState: number; potions: (string | null)[]; relicState: RelicPersistentState; statsCardsAdded: number };
}
export interface RelicAcquisitionRun {
  seed: string;
  classId?: ClassId;
  screen: string;
  hp: number; maxHp: number; gold: number;
  deck: CardInstance[];
  relicIds: string[];
  nextCardId: number;
  rngState: number;
  potions: (string | null)[];
  stats: { cardsAdded: number };
  log: string[];
  relicState?: RelicPersistentState;
  relicAcquisition?: RelicAcquisitionState | null;
}
export type RelicAcquisitionAction =
  | { type: 'selectRelicCards'; cardUids?: string[]; cardIds?: string[] }
  | { type: 'confirmRelicAcquisition' }
  | { type: 'continueRelicAcquisition' };

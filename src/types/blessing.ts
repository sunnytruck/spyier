import type { CardInstance, ClassId } from './game';

export type BlessingCharacterId = 'jitto_god' | 'yomi_guide' | 'stone_merchant' | 'star_miko' | 'oblivion_priest' | 'chaos_traveler';
export type BlessingTargetKind = 'remove' | 'upgrade' | 'transform';
export type BlessingCost = { kind: 'hp' | 'maxHp' | 'gold'; amount: number }
  | { kind: 'curse'; amount: number; cardId: string };
export type BlessingReward = { kind: 'maxHp' | 'heal' | 'gold' | BlessingTargetKind; amount: number }
  | { kind: 'cards'; cardIds: string[] }
  | { kind: 'relic'; relicId: string };
export interface BlessingTarget {
  kind: BlessingTargetKind;
  count: number;
  eligibleCardUids: string[];
  /** Every eligible target has its replacement fixed before any player selection. */
  replacements?: Record<string, string>;
}
export interface BlessingOption {
  id: string;
  templateId: string;
  title: string;
  description: string;
  risk: 'safe' | 'risky';
  costs: BlessingCost[];
  rewards: BlessingReward[];
  target: BlessingTarget | null;
}
export interface BlessingBasis {
  hp: number; maxHp: number; gold: number;
  deck: CardInstance[];
  relicIds: string[];
  nextCardId: number;
  relicState?: Record<string, number>;
}
export interface BlessingReceipt {
  encounterId: string; act: number; characterId: BlessingCharacterId; optionId: string;
  title: string; description: string;
  hpChange: number; maxHpChange: number; goldChange: number;
  removedCards: CardInstance[];
  upgradedCards: CardInstance[];
  transformedCards: { before: CardInstance; after: CardInstance }[];
  addedCards: CardInstance[];
  relicIds: string[];
}
export interface BlessingEncounter {
  version: 1;
  id: string;
  act: number;
  characterId: BlessingCharacterId;
  dialogueIndex: number;
  stage: 'offer' | 'targets' | 'confirm' | 'result';
  options: BlessingOption[];
  selectedOptionId: string | null;
  selectedCardUids: string[];
  receipt: BlessingReceipt | null;
  basis: BlessingBasis;
}
export interface BlessingRecord {
  act: number;
  encounterId: string;
  characterId: BlessingCharacterId;
  optionId: string;
  selectedCardUids: string[];
  basis: BlessingBasis;
  /** The selected frozen option is retained for validation and future content additions. */
  option: BlessingOption;
  receipt: BlessingReceipt;
}
/** Structural subset lets the run reducer integrate without a circular engine dependency. */
export interface BlessingRun {
  seed: string;
  classId?: ClassId;
  relicRules?: 'sources-v1';
  relicState?: Record<string, number>;
  screen: string;
  act?: number;
  maxActs?: number;
  blessing?: BlessingEncounter | null;
  blessingHistory?: BlessingRecord[];
  hp: number; maxHp: number; gold: number;
  deck: CardInstance[];
  relicIds: string[];
  nextCardId: number;
  stats: { cardsAdded: number };
  log: string[];
}
export type BlessingAction =
  | { type: 'chooseBlessing'; optionId: string }
  | { type: 'selectBlessingTargets'; cardUids: string[] }
  | { type: 'confirmBlessing' }
  | { type: 'continueBlessing' };

export interface BlessingTemplate {
  id: string; title: string; flavor: string; risk: 'safe' | 'risky';
  costs: { kind: BlessingCost['kind']; base: number; perAct?: number; cardId?: string }[];
  rewards: (
    | { kind: 'maxHp' | 'heal' | 'gold'; base: number; perAct?: number; percent?: boolean }
    | { kind: 'cards'; amount: number; pool: 'class' | 'rare' | 'synergy' | 'exclusive' }
    | { kind: 'relic'; pool?: 'ancient' }
    | { kind: BlessingTargetKind; amount: number; atAct3?: number }
  )[];
}
export interface BlessingCharacter {
  id: BlessingCharacterId;
  name: string; title: string; description: string; greeting: string; glyph: string;
  artId: BlessingCharacterId;
  backgroundTheme: string;
  effectTheme: string;
  availableActs: number[];
  dialogues: string[];
  /** Optional authored whitelist; undefined permits the shared eligible blessing pool. */
  blessingCardIds?: readonly string[];
  weight: number;
  optionTemplateIds: string[];
}

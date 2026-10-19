/** Source-reference IDs are independent of playable game IDs and save IDs. */
export type SourceClassId = 'berserker' | 'assassin' | 'oracle' | 'necromancer' | 'machinist' | 'colorless';

export interface SourceCardIssue {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  lines: number[];
}

export interface SourceCardVersion {
  /** Exact source strings, including X and ー. No guessed energy or star cost. */
  costRaw: string;
  effectRaw: string;
  costLine: number;
  effectLine: number;
  /** Lexical observations only; not executable effect definitions. */
  parameters: { numbers: number[]; starRuns: number[] };
}

export interface SourceCard {
  id: string;
  sourceId: string;
  sourceFile: string;
  sourceClass: SourceClassId;
  sourceName: string;
  sourceNameRaw: string;
  sourceLine: number;
  endLine: number;
  normal: SourceCardVersion;
  upgraded: SourceCardVersion;
  type: null;
  rarity: null;
  metadataProvenance: { type: 'not_in_source'; rarity: 'not_in_source' };
  keywords: string[];
  issues: SourceCardIssue[];
  /** A source entry is never evidence that a playable implementation exists. */
  status: 'pending' | 'needs_review';
}

export interface SourceCardCatalog {
  schemaVersion: 1;
  idAlgorithm: string;
  sources: {
    sourceClass: SourceClassId;
    sourceFile: string;
    sha256: string;
    lineCount: number;
    cardCount: number;
    echoedHeadingCount: number;
  }[];
  cards: SourceCard[];
  sharedNameFamilies: { sourceName: string; sourceIds: string[] }[];
  summary: {
    cardCount: number;
    expectedCardCountFromRequest: number;
    pendingCount: number;
    needsReviewCount: number;
    echoedHeadingCount: number;
    duplicateEntryGroupCount: number;
    issueCounts: Record<string, number>;
  };
}

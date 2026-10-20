import type { ClassId } from './game';

/** Reference prose is data, never executable relic definitions. */
export type SourceRelicRarity = 'starter' | 'common' | 'uncommon' | 'rare' | 'shop' | 'ancient' | 'event';
export type SourceRelicAcquisition = 'starter' | 'starterUpgrade' | 'normal' | 'shop' | 'blessing' | 'event';

export interface SourceRelicIssue {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  lines: number[];
}

export interface SourceRelic {
  /** Independent of game IDs, source order, rarity, effect edits and line endings. */
  id: string;
  sourceId: string;
  sourceFile: string;
  sourceName: string;
  sourceNameRaw: string;
  sourceRarity: string;
  rarity: SourceRelicRarity;
  acquisition: SourceRelicAcquisition;
  sourceLine: number;
  endLine: number;
  effectRaw: string;
  effectLines: number[];
  /** Only the ten starter records actually name a class in this source. */
  classScope: { kind: 'explicit' | 'not_stated'; classIds: ClassId[]; sourceLines: number[] };
  /** Editorial suggestions, never evidence of an explicit source class restriction. */
  proposedClasses: { classId: ClassId; reason: string; provenance: 'editorial_inference' }[];
  timings: string[];
  systems: string[];
  parameters: { numbers: number[] };
  issues: SourceRelicIssue[];
  /** A parsed record is not an implemented or obtainable relic. Bind sourceId to runtime data separately. */
  status: 'pending' | 'needs_review';
}

export interface SourceRelicLegacyComparison {
  gameId: string;
  gameNameAtBaseline: string;
  descriptionAtBaseline: string;
  sourceNames: string[];
  sourceIds: string[];
  comparison: 'effect_match_only' | 'partial_effect' | 'no_source_match';
  note: string;
}

export interface SourceRelicCatalog {
  schemaVersion: 1;
  idAlgorithm: string;
  source: { sourceFile: string; encoding: 'utf-8' | 'shift_jis'; sha256: string; lineCount: number; relicCount: number };
  relics: SourceRelic[];
  legacyBaseline: { commit: string; comparisons: SourceRelicLegacyComparison[] };
  summary: {
    relicCount: number;
    rarityCounts: Record<SourceRelicRarity, number>;
    acquisitionCounts: Record<SourceRelicAcquisition, number>;
    explicitClassCount: number;
    inferredClassCount: number;
    echoedHeadingCount: number;
    duplicateEntryGroupCount: number;
    pendingCount: number;
    needsReviewCount: number;
    issueCounts: Record<string, number>;
  };
}

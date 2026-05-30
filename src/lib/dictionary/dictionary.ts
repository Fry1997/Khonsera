// The normalized, in-memory dictionary the parser consumes.
//
// Built once from the bundled YAML (data/*.yaml) fused with the TypeScript
// mapping registry, then cached. Pure lookups, available offline. See load.ts for
// the build; this file owns the shape + the cached accessor.

import type { FactTypeSchema } from "./types";
import { buildDictionary, readDictionaryFiles } from "./load";

// Layer-3 operator categories (one phrase may carry several — disambiguated at
// slot-fill time by inspecting the following token).
export type OperatorCategory =
  | "connector"
  | "positioner"
  | "narrower"
  | "method_marker"
  | "journey_breaker"
  | "time_proximity"
  | "negation"
  | "confidence_modifier"
  | "quantifier";

// Layer-4 imperative intents.
export type ImperativeIntent =
  | "create_intent"
  | "search_request"
  | "booking_request"
  | "cancellation_request"
  | "modification_request"
  | "information_request"
  | "comparison_request"
  | "itinerary_request"
  | "communication_request";

export type ConfidenceLevel = "low" | "medium" | "high";

export type QuantifierKind =
  | "indefinite_creation"
  | "definite_reference"
  | "small_number"
  | "vague_quantity";

export interface ImperativeEntry {
  intent: ImperativeIntent;
  // information_request triggers only fire on question-shaped input.
  questionShaped?: boolean;
  // itinerary_request triggers (plan/route/map) only fire at sentence start
  // followed by an object phrase (they double as declarative nouns).
  positional?: boolean;
}

export interface Dictionary {
  // factType → merged runtime schema (YAML slots + registry mapping).
  schemas: Map<string, FactTypeSchema>;
  // lowercased concept phrase → factType.
  conceptIndex: Map<string, string>;
  // lowercased operator phrase → categories.
  operatorIndex: Map<string, OperatorCategory[]>;
  // lowercased imperative phrase → entry.
  imperativeIndex: Map<string, ImperativeEntry>;
  // confidence-modifier word → level (subset of operatorIndex, pre-resolved).
  confidenceModifiers: Map<string, ConfidenceLevel>;
  // quantifier word → kind.
  quantifiers: Map<string, QuantifierKind>;
  // longest phrase length (in tokens) per index, for longest-match scanning.
  maxConceptTokens: number;
  maxOperatorTokens: number;
  maxImperativeTokens: number;
}

let cached: Dictionary | null = null;

// Returns the process-wide dictionary singleton, building it on first use.
export function getDictionary(): Dictionary {
  if (!cached) cached = buildDictionary(readDictionaryFiles());
  return cached;
}

// Test/seam helper: replace or clear the cached dictionary.
export function __setDictionaryForTests(dict: Dictionary | null): void {
  cached = dict;
}

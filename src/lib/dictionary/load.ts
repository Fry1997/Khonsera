// Reads the bundled dictionary YAML and fuses it with the mapping registry into
// the normalized in-memory Dictionary. The build is pure given the parsed YAML
// (buildDictionary); only readDictionaryFiles touches the filesystem.

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { factTypeRegistry } from "./registry";
import type {
  FactTypeMapping,
  FactTypeSchema,
  SlotDef,
  SlotDataType,
  SlotTier,
} from "./types";
import type {
  Dictionary,
  ImperativeEntry,
  ImperativeIntent,
  OperatorCategory,
  ConfidenceLevel,
  QuantifierKind,
} from "./dictionary";

const DATA_DIR = path.join(process.cwd(), "src", "lib", "dictionary", "data");

// Raw YAML shapes (validated defensively below).
export interface RawDictionary {
  layer1: unknown;
  layer3: unknown;
  layer4: unknown;
}

export function readDictionaryFiles(): RawDictionary {
  const read = (f: string) =>
    yaml.load(fs.readFileSync(path.join(DATA_DIR, f), "utf8"));
  return {
    layer1: read("layer_1_concept_words.yaml"),
    layer3: read("layer_3_operator_words.yaml"),
    layer4: read("layer_4_imperatives.yaml"),
  };
}

function tokenCount(phrase: string): number {
  return phrase.trim().split(/\s+/).length;
}

function humanize(key: string): string {
  const s = key.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Best-effort data-type from a slot name when the registry doesn't specify one.
function inferDataType(key: string): SlotDataType {
  if (/_time$|^time$/.test(key) || key === "time_or_period") return "time";
  if (/date$/.test(key)) return "date";
  if (key === "price") return "money";
  if (key === "duration") return "duration";
  if (/party_size|guests|passengers/.test(key)) return "party_size";
  return "text";
}

function buildSlots(
  mapping: FactTypeMapping,
  essential: string[],
  optional: string[],
): SlotDef[] {
  const meta = mapping.slotMeta ?? {};
  const make = (key: string, defaultTier: SlotTier): SlotDef => {
    const m = meta[key] ?? {};
    return {
      key,
      label: humanize(key),
      dataType: m.dataType ?? inferDataType(key),
      tier: m.tier ?? defaultTier,
      resolvesTo: m.resolvesTo,
      placePref: m.placePref,
      autoInferFrom: m.autoInferFrom,
      derivableFrom: m.derivableFrom,
      elicitationPrompt: m.elicitationPrompt,
      dbMapping: m.dbMapping,
    };
  };
  return [
    ...essential.map((k) => make(k, "essential_to_work")),
    ...optional.map((k) => make(k, "nice_to_have")),
  ];
}

interface Layer1Entry {
  triggers: string[];
  fact_type: string;
  essential_slots?: string[];
  optional_slots?: string[];
}

function asLayer1(raw: unknown): Layer1Entry[] {
  const cw = (raw as { concept_words?: unknown })?.concept_words;
  if (!Array.isArray(cw)) throw new Error("layer_1: missing concept_words[]");
  return cw as Layer1Entry[];
}

function buildSchemas(layer1: Layer1Entry[]): {
  schemas: Map<string, FactTypeSchema>;
  conceptIndex: Map<string, string>;
} {
  const schemas = new Map<string, FactTypeSchema>();
  const conceptIndex = new Map<string, string>();

  // Group YAML entries by fact_type (e.g. dinner/lunch/breakfast all → meal_plan).
  for (const entry of layer1) {
    const mapping = factTypeRegistry.getMapping(entry.fact_type);
    if (!mapping) {
      throw new Error(
        `layer_1 fact_type "${entry.fact_type}" has no registry mapping`,
      );
    }
    const essential = entry.essential_slots ?? [];
    const optional = entry.optional_slots ?? [];

    let schema = schemas.get(entry.fact_type);
    if (!schema) {
      schema = {
        factType: entry.fact_type,
        shape: mapping.shape,
        conceptWords: [],
        targets: mapping.targets,
        slots: buildSlots(mapping, essential, optional),
        verbatimHold: mapping.verbatimHold,
        validations: mapping.validations,
        typicalHours: mapping.typicalHours,
      };
      schemas.set(entry.fact_type, schema);
    } else {
      // Union slots across concept-word groups that share a fact_type.
      const have = new Set(schema.slots.map((s) => s.key));
      for (const extra of buildSlots(mapping, essential, optional)) {
        if (!have.has(extra.key)) schema.slots.push(extra);
      }
    }
    for (const trigger of entry.triggers) {
      const phrase = trigger.toLowerCase().trim();
      schema.conceptWords.push(phrase);
      conceptIndex.set(phrase, entry.fact_type);
    }
  }

  // Verbatim shapes (note/task/intent) have no YAML entry — synthesise from the
  // registry mapping's slotMeta keys.
  for (const mapping of factTypeRegistry.listMappings()) {
    if (schemas.has(mapping.factType)) continue;
    if (!mapping.verbatimHold) {
      throw new Error(
        `registry fact_type "${mapping.factType}" has no layer_1 entry and is not verbatimHold`,
      );
    }
    const keys = Object.keys(mapping.slotMeta ?? {});
    schemas.set(mapping.factType, {
      factType: mapping.factType,
      shape: mapping.shape,
      conceptWords: [],
      targets: mapping.targets,
      slots: buildSlots(mapping, [], keys),
      verbatimHold: true,
      validations: mapping.validations,
    });
  }

  return { schemas, conceptIndex };
}

interface Layer3Entry {
  category: OperatorCategory;
  triggers: unknown; // string[] OR nested { bucket: string[] }
}

const CONF_BUCKET: Record<string, ConfidenceLevel> = {
  low_confidence: "low",
  medium_confidence: "medium",
  high_confidence: "high",
};

function buildOperators(raw: unknown): {
  operatorIndex: Map<string, OperatorCategory[]>;
  confidenceModifiers: Map<string, ConfidenceLevel>;
  quantifiers: Map<string, QuantifierKind>;
} {
  const ow = (raw as { operator_words?: unknown })?.operator_words;
  if (!Array.isArray(ow)) throw new Error("layer_3: missing operator_words[]");

  const operatorIndex = new Map<string, OperatorCategory[]>();
  const confidenceModifiers = new Map<string, ConfidenceLevel>();
  const quantifiers = new Map<string, QuantifierKind>();

  const add = (phrase: string, category: OperatorCategory) => {
    const key = phrase.toLowerCase().trim();
    const cats = operatorIndex.get(key) ?? [];
    if (!cats.includes(category)) cats.push(category);
    operatorIndex.set(key, cats);
  };

  for (const entry of ow as Layer3Entry[]) {
    const { category, triggers } = entry;
    if (Array.isArray(triggers)) {
      for (const t of triggers) add(String(t), category);
    } else if (triggers && typeof triggers === "object") {
      // Nested buckets: confidence_modifier / quantifier.
      for (const [bucket, list] of Object.entries(
        triggers as Record<string, string[]>,
      )) {
        for (const t of list) {
          const key = String(t).toLowerCase().trim();
          add(key, category);
          if (category === "confidence_modifier" && CONF_BUCKET[bucket]) {
            confidenceModifiers.set(key, CONF_BUCKET[bucket]);
          }
          if (category === "quantifier") {
            quantifiers.set(key, bucket as QuantifierKind);
          }
        }
      }
    }
  }

  return { operatorIndex, confidenceModifiers, quantifiers };
}

interface Layer4Entry {
  intent: ImperativeIntent;
  imperatives: string[];
  engine_note?: string;
}

function buildImperatives(raw: unknown): Map<string, ImperativeEntry> {
  const list = (raw as { imperatives?: unknown })?.imperatives;
  if (!Array.isArray(list)) throw new Error("layer_4: missing imperatives[]");

  const index = new Map<string, ImperativeEntry>();
  for (const entry of list as Layer4Entry[]) {
    const questionShaped = entry.intent === "information_request";
    const positional = entry.intent === "itinerary_request";
    for (const t of entry.imperatives) {
      index.set(t.toLowerCase().trim(), {
        intent: entry.intent,
        questionShaped: questionShaped || undefined,
        positional: positional || undefined,
      });
    }
  }
  return index;
}

function maxTokens(keys: Iterable<string>): number {
  let max = 1;
  for (const k of keys) max = Math.max(max, tokenCount(k));
  return max;
}

export function buildDictionary(raw: RawDictionary): Dictionary {
  const { schemas, conceptIndex } = buildSchemas(asLayer1(raw.layer1));
  const { operatorIndex, confidenceModifiers, quantifiers } = buildOperators(
    raw.layer3,
  );
  const imperativeIndex = buildImperatives(raw.layer4);

  return {
    schemas,
    conceptIndex,
    operatorIndex,
    imperativeIndex,
    confidenceModifiers,
    quantifiers,
    maxConceptTokens: maxTokens(conceptIndex.keys()),
    maxOperatorTokens: maxTokens(operatorIndex.keys()),
    maxImperativeTokens: maxTokens(imperativeIndex.keys()),
  };
}

// Fact-type names are sourced from data/layer_1_concept_words.yaml — see
// docs/tell-khonsera-parser.md. To add a fact-type, start with the YAML, not this
// registry (this is the DB-mapping layer only). This is why there are 15
// fact-types here, not the 9 the substrate doc originally mentioned.
import type { FactTypeRegistry, FactTypeMapping } from "./types";
import { transportMappings } from "./fact-types/transport";
import { scheduledMappings } from "./fact-types/scheduled";
import { accommodationMappings } from "./fact-types/accommodation";
import { verbatimMappings } from "./fact-types/verbatim";

// DB-materialisation metadata for every fact-type. Keyed by the YAML fact_type
// name (data/layer_1_concept_words.yaml). Concept words + slot names are the
// YAML's job; this registry is the mapping layer the loader fuses with it.
//
// The 12 concept-word-bearing types here line up 1:1 with the YAML's fact_types
// (meal_plan appears once though three concept-word groups reference it). The 3
// verbatim shapes (note/task/intent) have no YAML entry — they are shape-classified.
const MAPPINGS: FactTypeMapping[] = [
  ...transportMappings,
  ...scheduledMappings,
  ...accommodationMappings,
  ...verbatimMappings,
];

const byName = new Map<string, FactTypeMapping>(
  MAPPINGS.map((m) => [m.factType, m]),
);

export const factTypeRegistry: FactTypeRegistry = {
  getMapping(factType: string) {
    return byName.get(factType);
  },
  listMappings() {
    return [...MAPPINGS];
  },
};

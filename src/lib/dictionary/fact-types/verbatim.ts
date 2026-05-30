import type { FactTypeMapping } from "../types";

// The verbatim-hold shapes (§4 tiered-honesty rule). These have NO Layer-1
// concept words — they are produced by shape classification (stage 6) when the
// input lacks the anchors a dated event needs. The user's exact words are kept
// as the label and the unknown subject noun is NEVER interpreted. The worst case
// is an honest "noted", never a confident wrong guess.
//
// Because they have no YAML entry, the loader synthesises their slot list from
// `slotMeta` here (a single verbatim `label`, plus optional captured anchors).

// A dated note: a date/person anchor was found but the subject is held verbatim
// (e.g. "Mum's scan, 22nd").
export const note: FactTypeMapping = {
  factType: "note",
  shape: "note",
  verbatimHold: true,
  targets: [{ table: "stops", as: "other", note: "verbatim text in notes; dated if a date is present" }],
  slotMeta: {
    label: { tier: "nice_to_have", dataType: "text", dbMapping: "stops.notes (verbatim)" },
    date: { tier: "nice_to_have", dataType: "date" },
    person: { tier: "nice_to_have", dataType: "person", resolvesTo: "contacts" },
  },
};

// An undated task: no date + no place + a "sort"-style sense (e.g. "broken
// greenhouse — sort"). Titled exactly as typed.
export const task: FactTypeMapping = {
  factType: "task",
  shape: "undated_task",
  verbatimHold: true,
  targets: [{ table: "intents", note: "undated task; no resurfacing clock by default" }],
  slotMeta: {
    label: { tier: "nice_to_have", dataType: "text", dbMapping: "intents.label (verbatim)" },
  },
};

// An intent: a held wish (e.g. "check in on parents", or a create_intent
// imperative). Resurfaced on a staleness clock.
export const intent: FactTypeMapping = {
  factType: "intent",
  shape: "intent",
  verbatimHold: true,
  targets: [{ table: "intents", note: "resurfaced via surface_after / last_surfaced_at" }],
  slotMeta: {
    label: { tier: "nice_to_have", dataType: "text", dbMapping: "intents.label (verbatim)" },
    person: { tier: "nice_to_have", dataType: "person", resolvesTo: "contacts" },
    surface_after: { tier: "nice_to_have", dataType: "date", dbMapping: "intents.surface_after" },
  },
};

export const verbatimMappings: FactTypeMapping[] = [note, task, intent];

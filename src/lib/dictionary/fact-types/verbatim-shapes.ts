import type { FactTypeSchema } from "../types";

// The verbatim-hold shapes (§4 tiered-honesty rule). For anything the dictionary
// does not confidently recognise, keep the user's exact words as the label and
// NEVER interpret an unknown subject noun. The worst case is an honest "noted",
// never a confident wrong guess. These have no essential_to_work slot — they are
// always valid as-is.

// A dated note: a date/person anchor was found but the subject is held verbatim
// (e.g. "Mum's scan, 22nd"). Handled plainly — no cute reaction.
export const note: FactTypeSchema = {
  factType: "note",
  shape: "note",
  conceptWords: [],
  verbatimHold: true,
  targets: [{ table: "captured_inputs", note: "held as a dated note; may anchor to a day" }],
  slots: [
    {
      key: "label",
      label: "Note",
      dataType: "text",
      tier: "nice_to_have",
      dbMapping: "captured_inputs.original_text (verbatim)",
    },
    {
      key: "date",
      label: "Date",
      dataType: "date",
      tier: "nice_to_have",
      dbMapping: "parsed_payload anchor",
    },
    {
      key: "with_person",
      label: "Involves",
      dataType: "person",
      tier: "nice_to_have",
      resolvesTo: "contacts",
      dbMapping: "parsed_payload person ref",
    },
  ],
};

// An undated task: no date + no place + a "sort"-style verb (e.g. "broken
// greenhouse — sort"). Titled exactly as typed; the subject is never interpreted.
export const task: FactTypeSchema = {
  factType: "task",
  shape: "undated_task",
  conceptWords: [],
  verbatimHold: true,
  targets: [{ table: "intents", note: "undated task with no resurfacing clock by default" }],
  slots: [
    {
      key: "label",
      label: "Task",
      dataType: "text",
      tier: "nice_to_have",
      dbMapping: "intents.label (verbatim)",
    },
  ],
};

// An intent: a held wish with a person-ref and no anchor (e.g. "check in on
// parents"). Held and resurfaced on a staleness clock.
export const intent: FactTypeSchema = {
  factType: "intent",
  shape: "intent",
  conceptWords: [],
  verbatimHold: true,
  targets: [{ table: "intents", note: "resurfaced via surface_after / last_surfaced_at" }],
  slots: [
    {
      key: "label",
      label: "Intent",
      dataType: "text",
      tier: "nice_to_have",
      dbMapping: "intents.label (verbatim)",
    },
    {
      key: "with_person",
      label: "Involves",
      dataType: "person",
      tier: "nice_to_have",
      resolvesTo: "contacts",
      dbMapping: "intents.details person ref",
    },
    {
      key: "surface_after",
      label: "Resurface after",
      dataType: "date",
      tier: "nice_to_have",
      dbMapping: "intents.surface_after",
    },
  ],
};

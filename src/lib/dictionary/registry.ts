import type { FactTypeRegistry, FactTypeSchema } from "./types";
import { trainJourney } from "./fact-types/train-journey";
import { flight } from "./fact-types/flight";
import { accommodation } from "./fact-types/accommodation";
import { meeting } from "./fact-types/meeting";
import { meal } from "./fact-types/meal";
import { event } from "./fact-types/event";
import { note, task, intent } from "./fact-types/verbatim-shapes";

// The core travel set + verbatim-hold shapes. The brief's wider list (~17
// fact-types) is added here as the dictionary grows; the framework is shaped to
// take them without change.
//
// TODO(dictionary): add bus/coach, taxi/rideshare, ferry, tube, car_hire,
// parking, childcare/real-world-action, and other concept words as they are
// specified. Each is one module under fact-types/ registered below.
const SCHEMAS: FactTypeSchema[] = [
  trainJourney,
  flight,
  accommodation,
  meeting,
  meal,
  event,
  note,
  task,
  intent,
];

const byName = new Map<string, FactTypeSchema>(
  SCHEMAS.map((s) => [s.factType, s]),
);

const conceptIndex = new Map<string, string>();
for (const schema of SCHEMAS) {
  for (const word of schema.conceptWords) {
    conceptIndex.set(word.toLowerCase(), schema.factType);
  }
}

export const factTypeRegistry: FactTypeRegistry = {
  getSchema(factType: string) {
    return byName.get(factType);
  },
  listSchemas() {
    return [...SCHEMAS];
  },
  conceptWordIndex() {
    return new Map(conceptIndex);
  },
};

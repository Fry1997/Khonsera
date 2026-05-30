# Tell Khonsera — Parser Engine

The deterministic free-text parser that turns "Tell Khonsera" input into a
multi-fact draft, plus the persistence + materialisation actions. Builds on the
substrate (`docs/tell-khonsera-substrate.md`) and the dictionary
(`docs/dictionary/HANDOFF.md`). **No AI at runtime** — every recognition is
rule-based against curated data. The capture UI screen is a separate (next) build.

## The dictionary (`src/lib/dictionary/`)
- `data/layer_1_concept_words.yaml` / `layer_3_operator_words.yaml` /
  `layer_4_imperatives.yaml` — bundled static data (Layer 5 is implemented in code;
  Layer 2 gazetteer is the existing `transport_hubs` table, not a YAML file).
- `load.ts` reads + validates the YAML and fuses Layer 1 with the TypeScript
  **mapping registry** (`registry.ts` + `fact-types/*`) — the registry supplies the
  DB-materialisation metadata (targets, slot value types, resolver targets, place
  preference, tiers) the YAML lacks. `dictionary.ts` exposes the cached
  `getDictionary()` singleton (concept / operator / imperative indexes).
- The 15 fact-types are the YAML's; the registry is keyed by those names plus the
  3 verbatim shapes (note/task/intent). Adding a fact-type = a YAML concept_words
  entry + a registry mapping.

> Note: the provided `layer_3` YAML had unquoted `{duration}` pattern scalars
> (invalid YAML); they were quoted on import. Those `patterns` are documentation
> the loader doesn't consume.

## The pipeline (`src/lib/parser/`)
Ten staged, separately-tested modules (`parse.ts` orchestrates):

1. `tokenise` — offset-preserving tokens.
2. `recognisers/*` — Layer 5: dates/times (chrono-node + day-periods + bare
   ordinals), money, durations, party sizes, people (shape only). Each match
   carries `{source_text, source_range, normalised_value, confidence, fuzzy, range, granularity}`.
3. `lookup` — longest-match phrase scan; carries ALL operator categories forward.
4. `imperatives` — routes only when the trigger is at sentence start;
   question-shape gates `information_request`; position+object gates `itinerary_request`.
   `create_intent` is handled end-to-end; other intents are stub-routed.
5. `segment` — permissive clause splitting (prefer fewer); `operators.ts` holds the
   multi-category disambiguation heuristic (`by 8pm`→positioner, `by the station`→narrower, `by train`→method_marker).
6. `classify` — concept word wins; else the §9 anchor decision tree. Bare
   Title-Case is NOT treated as a place anchor (so "Broken greenhouse" stays a task).
7. `slots` — slot-aware place resolution via an injected `PlaceResolver`: transit
   slots → `transport_hubs`; event slots stay plain labels unless an explicit
   station is named. Unresolved values are held verbatim at low confidence.
8. `link` — `destination_of` (infers a leg's destination + date from a linked
   event), `return_of` ("back same evening"), `same_day`.
9. `validate` — per/cross-fact warnings (never blocks).
10. preview — returns `ParsedPayload`; **never persists** (brief §0c).

Discipline: holding back beats guessing. Unknown subject nouns are held verbatim;
ambiguous dates/places are flagged, not silently resolved.

## Actions (`src/lib/actions/tell-khonsera.ts`)
- `previewCapture(text)` — stateless, read-only; builds a workspace-backed
  `PlaceResolver` and runs the pipeline. No DB writes.
- `saveCaptureDraft` / `updateCaptureDraft` / `rejectCapture` — the
  `captured_inputs` lifecycle (`pending_review` → `corrected`/`rejected`); the first
  correction stows the original parse at `parsed_payload.original_parse`.
- `confirmCapture` — materialises via `materialise.ts` → `createItineraryFromBrief`
  (reusing all stop/transition/booking creation + the solver), stamps provenance
  (`source='captured'`), inserts intents, records lineage on `captured_inputs`.
  Atomicity: a partial failure deletes the new itinerary (FK cascade).

### transition vs travel_booking (brief §16)
`materialise.factIsBooked` decides: a travel fact becomes a `travel_booking` only
when the input indicates a real booking (a booking-ref/ticket slot, or
"booked"/"confirmation"/"ticket"/"Trainline" in the clause). Otherwise it's planned
travel — station anchors + a `transition` (`commitment_state` planned), and the
booking layer stays clean.

## Tests
`src/lib/parser/__tests__/` — per-stage units, the 20+ sentence corpus, a
`parsed_payload` snapshot, and the transition-vs-booking materialisation test.
Run `npx vitest run`.

## Known v1 gaps (held back honestly)
Lowercase bare city names aren't detected as event places; cross-zone/overnight
nuance, recurring events ("meetings Mon/Tue/Thu"), and full CRM person resolution
are out of scope. Stub intents (search/booking/etc.) record intent_type but produce
no facts yet.

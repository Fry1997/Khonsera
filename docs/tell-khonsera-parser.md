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

## Extending the parser

When you find a parser issue in real use, add it to the corpus first with the expected payload
(the "correct" behaviour you want), and confirm the test fails. Then implement the fix. The
corpus is the living record of what the parser does and what we've decided is correct behaviour;
growing it is the parser's improvement loop. (85 parser tests after the second (stress-test) fix
pass — aim to grow it steadily.)

### Second fix pass — stress-test (10 fixes)
Driven by a 61-input stress test. Fixtures live in `__tests__/stress.test.ts`.
- **Negation routing** (`negation.ts`, PRIORITY 1): a sentence-leading negation
  ("No meeting Monday" / "Cancel ..." / "Actually no") routes to
  `cancellation_request`/`correction_intent` BEFORE classification — it can never
  create a positive fact. Mid-sentence retractions ("Lunch Thursday, not Wednesday")
  are untouched.
- **Bare-hour disambiguation** (`times.ts` + `slots.ts`): a meridiem-less hour is
  resolved against the fact-type's `typicalHours` (registry) — "dinner from 7" →
  19:00, "call at 3" → 15:00; trains/flights keep no inference.
- **Imperative slot extraction** (`parse.ts extractIntentSlots`): stub intents carry
  date/time/place/contact/party/price/duration as metadata; the intent STAYS an
  intent, never a positive fact.
- **Comma de-fragmentation** (`segment.ts`): a comma splits only when a new concept/
  imperative/return-leg follows; otherwise the clause continues.
- **Hotels** (`layer_1` + `duration.ts` + `slots.ts` + `imperatives.ts`): chain names
  + "staying at" trigger accommodation; "N nights from <date>" derives the stay; "check
  in/out" no longer mis-routes as a search.
- **Concept expansion** (`layer_1`): compound concepts first (board meeting, 1-2-1),
  standup/keynote/Eurostar/drinks, etc.
- **"and" discipline** (`place.ts` + `segment.ts`): "The Crown and Anchor" keeps its
  name; "dinner and drinks at X" composes; different anchors split.
- **Booking refs + IATA routes** (`booking-ref.ts`): BA307 / C4X9P2 → booking_ref;
  LHR-CDG → origin/destination hubs.
- **Curated fuzzy** (`fuzzy.ts`): Damerau-L1 on a hot-token list only (days/months/
  relative/time-of-day/event words), one correction per input, real-word collisions
  denylisted; place/contact names stay strict.
- **Recurrence surfacing** (`recurrence.ts`): cadence detected + held on
  `recurrence_pattern`, never expanded.
- **Relative anchors** (`relative-anchor.ts`): "an hour before the demo" is held
  verbatim + flagged low, not fabricated.

### First-input fix pass (handback §5)
Four bug classes closed, with regression-guarded fixtures in `corpus.test.ts`:
- **Person extraction** (`recognisers/people.ts`): names introduced by an event verb
  (`Meeting John Brooks`, `Call Dave`, `Email Jane`) or by `with`/`from`/`to`/`for` now land in
  the fact's `contact`/`person` slot. The introducer is matched case-insensitively then the name
  is read as 1-2 Title-Case words (so a sentence-initial verb works); `from`/`to`/`for` is gated
  by a curated first-name lexicon so transport origins ("from Wellingborough") are never mistaken
  for people. `&` is excluded from introducers so "Frankie & Benny's" keeps its venue.
- **Place back-substitution** (`place.ts`): no place-of-last-resort. Sentence-initial common
  verbs ("Be", "Go", "Get") are never place candidates, so "Be in Liverpool" yields place=Liverpool,
  not "Be".
- **Greedy operator-place coupling** (`place.ts` `PLACE_BOUNDARY` + `slots.ts` time-direction):
  `arriving`/`leaving`/`departing`/`with` close a place run, so "Wellingborough arriving" → origin
  "Wellingborough"; the direction word routes its time to arrival_time vs departure_time. `&` is the
  one punctuation kept inside a place run.
- **Communication imperatives** (`layer_4_imperatives.yaml`): `email`/`send`/`text`/`message`/…
  route to a `communication_request` stub that still recognises the recipient and holds the verbatim
  text as an intent.
- **Confidence calibration** (`slots.ts` `rollupConfidence`): fact confidence is now the MIN of all
  filled (non-inferred) slot confidences, capped at medium when an essential slot is missing. A
  day-period time ("morning"/"evening") is low-confidence (the user didn't give a clock time), so a
  fact resting on one can't read as high. No more confidently-wrong pills.

## Known v1 gaps (held back honestly)
Lowercase bare city names aren't detected as event places; cross-zone/overnight
nuance, recurring events ("meetings Mon/Tue/Thu"), and full CRM person resolution
are out of scope. Stub intents (search/booking/etc.) record intent_type but produce
no facts yet.

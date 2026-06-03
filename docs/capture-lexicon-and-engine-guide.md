# Khonsera Capture — Word Library & Decision Engine (expansion guide)

This is the deterministic text→facts system. Two halves:

- **Word library (the lexicon)** — what words *mean*. Mostly data (YAML) + a small TS mapping registry.
- **Decision engine (the pipeline)** — how a sentence becomes structured facts. Pure TS, 10 stages.

To "expand horizons," 90% of the wins are in the **word library** (add triggers/synonyms/fact-types); a few structural wins are in the **engine** (segmentation, place/person detection, sigils).

---

## 1. The word library

### Layer 1 — concept words → fact types  (`data/layer_1_concept_words.yaml`)
The core. Each entry maps **trigger phrases** to a **fact_type** + its slots:

```yaml
- triggers: [meeting, meet, catch-up, sync, huddle, pitch, presentation, interview, workshop]
  fact_type: scheduled_event
  essential_slots: [date, time]
  optional_slots: [place, attendees, organisation, contact, agenda, duration, notes]
```

- **Longest match wins** (so `board meeting` beats `meeting`). Put compound phrases ABOVE their shorter forms.
- Adding a synonym = add a string to `triggers`. This is the single highest-leverage edit. e.g. add `heading to, off to, trip to, travelling to, conference, expo, festival, gig, match, fixture, wedding, party` to widen coverage.
- The fact_type must exist in the registry (§ below).

### Layer 3 — operator words  (`data/layer_3_operator_words.yaml`)
Small grammar words that carry roles: `from`/`to` (origin/destination), `at`/`in`/`near` (place), `with`/`meeting` (person), `via`/`changing at` (waypoint), `and`/`then`/`next` (connectors). Operators are how the engine knows "Wellingborough" after `from` is an **origin**. Add operator synonyms here (e.g. `over to`, `across to`).

### Layer 4 — imperatives  (`data/layer_4_imperatives.yaml`)
Verbs that mean "this is a request/reminder, not a fact": `remind me`, `book`, `find`, `cancel`, `sort`. These route to the `intent` lane (held wishes), never a positive fact.

### Fact-type registry  (`fact-types/*.ts` + `registry.ts`)
Each fact_type is a TS module declaring its slots' **data types** and **resolvers** — the bridge from a YAML trigger to a typed, DB-resolvable fact:

```ts
// fact-types/scheduled.ts
factType: "scheduled_event",
slotMeta: {
  date:    { dataType: "date" },
  time:    { dataType: "time" },
  place:   eventPlace,                       // resolves to a saved location
  contact: { dataType: "person", resolvesTo: "contacts", dbMapping: "stops.contact_id" },
}
```

`dataType` drives the capture UI (icon, badge, editor) and slot resolution. To **add a fact type**: create a module under `fact-types/`, register it in `registry.ts`, then add its trigger words to `layer_1`.

`types.ts` = the schema types. `load.ts` fuses YAML + registry into the cached `Dictionary` (`dictionary.ts` → `getDictionary()`).

---

## 2. The decision engine (10 stages, `parser/`)

`parse.ts` orchestrates. Flow + which file makes each decision:

1. **tokenise.ts** — text → tokens (words / numbers / punctuation). NB: `# @ +` are currently single `punct` tokens (sigils not yet wired).
2. **recognisers/** — pattern extraction independent of the dictionary: `dates.ts`, `times.ts`, `money.ts`, `duration.ts`, `party.ts`, `people.ts`, `numbers.ts`, `booking-ref.ts`. (chrono-node does most dates/times; `dates.ts` supplements bare ordinals.)
3. **lookup.ts** — longest-match scan of the token stream against the dictionary → `concepts` / `operators` / `imperatives`. **This is where a trigger word becomes a concept.**
4. **operators.ts** — disambiguates a word that matches several operator categories (`by` = time vs agent vs mode).
5. **negation.ts** — "No meeting Monday" must never create a meeting.
6. **segment.ts** — splits the input into clauses (one clause ≈ one fact). Boundary decisions: sentence terminators, commas before a new concept/imperative, connector operators (`and`/`then`). **Most over-/under-splitting bugs live here.**
7. **classify.ts** — clause → fact_type, by the first concept in the clause (longest-match). No concept ⇒ falls through to `note`.
8. **slots.ts + place.ts** — fill the fact's slots. `place.ts` decides what's a place/station/person (operator-introduced runs + bare Title-Case runs); `slots.ts` resolves them against the DB (hubs/locations/contacts) and assigns by role.
9. **link.ts** — cross-fact links: `destination_of`, `return_of`, `same_day`, `event_day` (multi-day event → "Day N").
10. **validate.ts** — non-blocking warnings.

Output = `ParsedPayload` (`types.ts`): `facts[]` each with `fact_type`, `slots` (value + `source_range` + `confidence` + `fuzzy`/`inferred` + `ambiguous`/`candidates`), `links`, and a separate `intent` lane.

---

## 3. Where the "horizons" are (highest-leverage expansion levers)

1. **Synonyms in `layer_1`** — biggest, safest win. Every missing phrasing that falls to "note" is usually one missing trigger string. Movement verbs (`heading to`, `off to`, `trip to`), event vocab (`expo`, `festival`, `gig`, `wedding`), hotel brands, etc.
2. **More fact types** — e.g. a generic `trip`/`visit`, `errand`, `deadline`. Add a `fact-types/` module + registry + triggers.
3. **Sigils (`# @ +`)** — *not yet wired*. The UI shows them as hints. Wiring them = a deterministic 100%-reliable override: `#Beer X` → event titled "Beer X", `@The Ivy` → place, `+Sarah` → person. Best done as a pre-pass after `lookup.ts` that injects a concept (`#`) / place candidate (`@`) / person (`+`). **This is the recommended next structural change.**
4. **Operator synonyms in `layer_3`** — widen role detection.
5. **Segmentation robustness (`segment.ts`)** — connector/terminator handling (recent fixes: a connector must not bind across a sentence terminator; a connector inside a date span doesn't split).
6. **Place/person detection (`place.ts`)** — lowercase venue capture, sentence-initial false positives (recently fixed: skip leading article, block modal verbs).

---

## 4. Testing your expansions

- `npx vitest run` — full suite (~180 tests). Snapshot at `parser/__tests__/snapshot.test.ts` guards payload shape (update with `-u` when the shape legitimately changes).
- `parser/__tests__/corpus.test.ts` + `stress.test.ts` + `capture-phrasing.test.ts` — add fixtures here when you add triggers, so coverage sticks.
- Quick way to probe a phrase: a throwaway test that calls `parse(text, { ref, resolver: nullResolver })` and logs `payload.facts`.

---

## File manifest (sent alongside this guide)

**Word library:** `layer_1_concept_words.yaml`, `layer_3_operator_words.yaml`, `layer_4_imperatives.yaml`, `fact-types/{transport,scheduled,accommodation,verbatim}.ts`, `registry.ts`, `types.ts`, `load.ts`, `dictionary.ts`.

**Decision engine:** `parse.ts`, `lookup.ts`, `classify.ts`, `segment.ts`, `operators.ts`, `place.ts`, `slots.ts`, `link.ts`, `negation.ts`, `imperatives.ts`, `types.ts`, and `recognisers/{index,dates,times,people,money,duration,party,numbers,booking-ref,types}.ts`.

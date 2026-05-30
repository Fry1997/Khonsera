# Khonsera Semantic Dictionary — Engineering Handoff

## What this is

A deterministic semantic dictionary for the **Tell Khonsera** capture feature. The dictionary's job is to recognise words and phrases in free-text user input and route them to the right interpretation. It uses **no AI at runtime** — every recognition is rule-based against curated data.

## Files in this bundle

- `layer_1_concept_words.yaml` — event-type triggers and the fact schemas they instantiate
- `layer_3_operator_words.yaml` — light-grammar operators (connectors, positioners, narrowers, etc.)
- `layer_4_imperatives.yaml` — request-routing imperatives (book, find, remind, etc.)
- `layer_5_pattern_recognisers.md` — specifications for time/date/money/people patterns the engine must detect via library + regex
- `khonsera_semantic_dictionary_layers_1_3_4_5.md` — full readable specification (combines all four layers)

**Layer 2 (place gazetteer) is deliberately not in this bundle.** See "What's still needed" below.

## Core principle (read this first)

**Recognise less, not more.** Unknown words are preserved verbatim and never interpreted. A small, high-confidence dictionary is far more valuable than a large, ambiguous one. Over-recognition causes wrong-interpretation, which is worse than non-recognition.

When the engine cannot confidently classify a word or phrase, it should:

1. Preserve the original `source_text`
2. Mark `confidence: low` or leave the field unparsed
3. Hold unknown subject nouns verbatim as part of the fact label
4. Never invent meaning for words it doesn't know

## Cleanup applied (changes from raw AI output)

The raw output from the generation pass had a few small issues that have been resolved in these files:

**Layer 1 — `appointment` collision.** The word `appointment` appeared in two fact-type triggers (`scheduled_event` and `appointment`). It has been removed from `scheduled_event` so the dedicated `appointment` fact-type wins.

**Layer 1 — over-broad `event` trigger.** The word `event` was a trigger for the `business_event` fact-type. This caught too many incidental uses ("the dinner event tonight"). Removed; `conference`, `expo`, `exhibition`, `trade show` remain as specific triggers.

**Layer 3 — multi-category operators.** Several words (`by`, `via`, `in`, `after`, `before`, `with`) legitimately appear in multiple operator categories because they are genuinely ambiguous in English. An engineering note has been added to the top of the file explaining the disambiguation heuristic (examine the token following the operator, classify by what it is).

**Layer 4 — question-shape detection.** The `information_request` triggers (`what`, `when`, `where`, etc.) would otherwise misclassify any declarative sentence containing those words. An engine note has been added requiring sentence-shape detection before routing.

**Layer 4 — declarative-vs-imperative ambiguity.** Triggers like `plan`, `route`, `map` are nouns as often as verbs. An engine note has been added requiring position-based detection (start of input + object phrase → imperative).

## What's still needed before this is fully shippable

### Layer 2: Place gazetteer

The biggest remaining piece. The dictionary needs a comprehensive UK place layer:

- **All UK cities** with population >100k (~70 cities) — source: ONS data
- **All UK National Rail mainline stations** with their three-letter CRS codes (~2,500 stations) — source: data.gov.uk / National Rail Open Data
- **All UK airports** with IATA codes (~40) — source: CAA / public IATA list
- **Major London Underground/Overground stations** (Tube zones 1–2 primarily) — source: TfL Unified API
- **Common neighbourhood/area references** for London, Manchester, Birmingham (Soho, Camden, Northern Quarter, etc.) — manual curation

**Do not generate this from an AI.** Use authoritative public data sources. Place-data accuracy matters enormously — a wrong station code propagates as wrong tickets, wrong routes, wrong everything.

Each gazetteer entry follows this shape (from the original spec):

```yaml
name: Wellingborough station
type: rail_station
code: WLE
aliases: [WLE]
```

Types: `city`, `rail_station`, `airport`, `tube_station`, `neighbourhood`.

### Layer 5 pattern implementation

Use **chrono-node** (or equivalent maintained parser) for time and date parsing. Do not hand-roll regex for natural-language time/date interpretation — there are too many edge cases and chrono handles them well.

Money, durations, and party-size patterns are simpler and can be regex-based, but follow the metadata schema specified in Layer 5 (every recognised value returns `source_text`, `normalised_value`, `confidence`, `fuzzy`, `range`, `granularity`).

### Person resolution

Layer 5 specifies the *shape* of person references (capitalised names, possessive structures, relational labels). **Resolution** of those references to real entities is a separate engine concern, not the dictionary's job. The resolution path:

1. Match against user's saved contacts (one match → silent; multiple → picker; none → hold as label)
2. Match against standing facts ("my wife" → user's standing fact for spouse)
3. Match against event context ("the client" during an ACME trip → ACME contact)
4. Fall through to verbatim hold if unresolvable — never invent

## Where this lives in the app

The dictionary is **static reference data**, not user data. It should be:

- **Bundled as a static asset** in the app build (YAML or JSON in a `dictionary/` folder), not stored in the database
- **Loaded into memory on app launch** as an in-memory lookup structure (a trie for the gazetteer is fastest; hash maps for everything else are fine)
- **Versioned with the app** — dictionary updates ship with app releases
- **Available offline** — capture parsing must work without a network connection

Per-user data (contacts, standing facts, the user's parsed facts) does live in the database. The dictionary is the runtime parser's reference; the database is the user's persistent state.

## Discipline for the engine implementation

The dictionary is the input data. The engine's job is to:

1. **Tokenise** the user's input
2. **Match tokens** against the dictionary's vocabulary (concept words, operators, imperatives, gazetteer)
3. **Recognise patterns** (times, dates, money, etc.) using the Layer 5 specifications
4. **Disambiguate** multi-category words using the heuristics in Layer 3's engineering note
5. **Classify the fact's shape** from the presence/absence of anchors (date, place, time, person)
6. **Produce a draft fact** carrying every parsed slot, its confidence, and the original `source_text` for everything
7. **Hold unknown content verbatim** — never invent, never guess at unknown subject nouns
8. **Return the draft to the UI** for user confirmation before persisting

The user always sees the draft and confirms or corrects before the fact lands. The engine never silently commits an interpretation.

## Testing approach

As soon as the engine can parse anything, throw real travel-shaped sentences at it. Examples to start with:

- "Train to Derby tomorrow morning, demo at ACME, back same evening"
- "Hotel in Soho Thursday and Friday, dinner with Mark Friday at 8"
- "Two meetings in Manchester next week, can probably do them on the same day"
- "Flight from Heathrow to Edinburgh on the 22nd, returning Friday"
- "Broken greenhouse — sort"  (← should hold verbatim, classify as undated task)
- "Mum's scan, 22nd"  (← should hold "scan" verbatim, no interpretation; classify as dated note)
- "Remind me to pack the charger"  (← imperative; intent)
- "Find me a hotel near the venue"  (← imperative; search request)

The dictionary improves through this testing, not through clever rules. Diff the failures, identify the gaps, add carefully curated entries.

## If you regenerate the dictionary

Pattern scalars containing braces (e.g. `{duration}` in Layer 3) must be quoted in source YAML, or the YAML is invalid. The current import quotes them defensively at load time, but new generations should fix this at source so the import-time workaround isn't relied on.

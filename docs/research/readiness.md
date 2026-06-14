# Readiness Check / Prep-List — "Have you got everything?" Research

**Purpose:** ground how Khonsera should build the per-day **readiness check** (Edition III B3.3,
build-plan Phase 4): the calm "have you got everything?" surface that assembles from what the day
actually requires, tells the traveller what's sorted and what's missing, and makes each gap
actionable. This doc surveys how the best tools do it, the one area with real external services
(document/entry-requirement providers), settles the data-model question (stored vs derived), and
synthesises the concrete rule registry + checks + trigger predicates for the Khonsera build.

**Web access:** available. Sources cited inline + collected at the end. Research date: 2026-06-14.

**Grounding in the existing spec.** Edition III master §B3.3 already enumerates the categories
(tickets, documents, bookings, devices & power, international, rural drive, multi-day, notes/materials)
and the build-plan Phase 4 restates them; this doc does not re-derive the category list from scratch —
it pressure-tests it against the market, resolves the build decisions left open (provider, data model,
rule shape), and produces a buildable spec. Verified facts already in the master: eSIM via **Airalo
Partner API** (§master:241), weather via **Open-Meteo** (already in the plan), **UK ETA live since
Jan 2025** (§master:529, inbound only). Connections that fill gaps are a **stub** behind a clean
provider interface (handover §17) until build-plan L5.

---

## PART 1 — How the best tools do "have you got everything?"

The market splits into four archetypes. None of them does what Khonsera's spec asks (a *single-day*,
*day-object-derived*, *door-to-door* readiness check with actionable gaps) — each does one slice.

### A. TripIt (pre-trip) — itinerary-derived reminders, packing delegated

TripIt auto-parses flight/hotel/car confirmations from email into a trip, then layers **pre-trip
alerts** and a unified reminder view (packing deadlines sit alongside meetings/excursions). Crucially,
TripIt **does not generate the packing list itself** — it *integrates PackPoint* and renders the
PackPoint list inside the TripIt trip. So TripIt's "readiness" is: (1) reservation completeness
(does the trip have a return flight? a hotel for each night? — gaps surfaced as the timeline showing
holes), (2) document reminders (TripIt Pro: passport/visa expiry tracking via a stored profile,
point-of-interest "check entry requirements" cards), (3) time-to-leave / check-in reminders, (4)
delegated packing. **Trigger model:** derived from the parsed itinerary's attributes (has-flight →
check-in reminder + seat alert; is-international → passport reminder; per-night gap → "no hotel
booked for this night"). [TripIt/PackPoint integration, Wanderlog](https://wanderlog.com/blog/2024/10/24/what-is-the-best-app-that-helps-you-pack-for-a-trip/)

**Take for Khonsera:** TripIt's pattern — *derive the checklist from the parsed itinerary, flag the
holes* — is exactly Khonsera's model. The difference: TripIt stops at "you have a gap"; Khonsera makes
the gap *actionable in-app* (book the parking here).

### B. Google Travel / Trips — reservation folder + soft "things to do"

Google Travel parses Gmail confirmations into a per-trip folder (Reservations, Things to Do, Saved
Places, Day Plans, Food & Drink, Getting Around). Its "pre-trip" guidance is **editorial/soft**
("a week out, confirm your reservations") rather than a computed checklist — there is no
attribute-driven "you need a passport for this" engine; the value is the auto-assembled reservation
set + manual add. [Google blog](https://blog.google/products/travel/planning-trip-google-can-help/),
[gsmarena Trips overview](https://m.gsmarena.com/google_trips_wants_to_be_your_new_travel_companion-blog-20611.php)

**Take:** confirms the *capture → folder* substrate Khonsera already has (Gmail import → day-object).
Google does **not** do the readiness *logic* — that's the open field Khonsera occupies.

### C. PackPoint & packing-list generators — the rules engine to copy

PackPoint is the clearest example of an **attribute-driven rules engine** producing a checklist, and
its input model maps almost 1:1 onto Khonsera's day-object. Inputs: destination (city), dates,
**duration (nights)**, **travel type (business vs leisure)**, gender, **activities** (swimming, fancy
dinner, running, hiking, beach, snow sports, working, camping, gym, photography…), **laundry access**
(repeat basics?). It then **pulls the destination weather forecast** and adds weather-driven items
(umbrella if rain forecast; warm layers if cold; etc.). Output is an editable, tickable list with
quantities. [PackPoint](https://www.packpnt.com/),
[FlightDeck review](https://www.pilotplans.com/blog/packpoint-review),
[thoughtcard review](https://thoughtcard.com/packpoint-review/)

**Trigger model (the important part) — each item is gated by a predicate over trip attributes:**

| Check | Trigger predicate |
|---|---|
| Umbrella / rain shell | `forecast.precip_prob > threshold` |
| Warm layers / coat | `forecast.temp_min < threshold` |
| Sun cream / hat | `forecast.temp_max > threshold` or activity=beach |
| Swimwear | `activity ∈ {swimming, beach}` |
| Formal outfit | `activity = fancy_dinner` or travel_type=business |
| Laptop / chargers / work docs | `travel_type = business` / `activity = working` |
| N× underwear/socks | `f(nights, laundry_access)` |
| Hiking boots | `activity = hiking` |
| Adapter / passport | `is_international` |

**Take:** This is the **canonical rule shape Khonsera should adopt**: `{ item, category, predicate(day),
quantity-fn }`. Khonsera's day-object already carries the attributes PackPoint asks the user for
(destination → forecast, nights, mode, business/personal tag, anchors that imply activities/dress) —
so Khonsera can *derive* much of what PackPoint *interrogates the user for*.

### D. Apple/Google Reminders travel templates — static lists, no logic

Reminders/Keep "travel" templates are flat static checklists (passport, chargers, meds, lock the
house…) with optional location/time triggers. No trip-attribute derivation. They establish the
**household/"close the house" category** (lights, heating, bins, plants, hold mail) that the
itinerary-derived tools omit but real travellers want. [Pack Hacker 37-item list](https://www.packhacker.com/blog/general/travel-checklist/),
[Gather and Go close-the-house list](https://gatherandgotravel.com/close-the-house-and-packing-checklist/),
[Google Keep for travel](https://www.makeuseof.com/tag/use-google-keep-organize-travel-plans/)

**Take:** Khonsera's user-added items (PART 3) cover this — let the traveller add their own checks;
don't try to derive "water the plants."

### E. Corporate pre-trip compliance — Navan & SAP Concur

This is "readiness" reframed as **policy/compliance**, and it matters for Khonsera's work persona.

- **SAP Concur Trip Approval** — a **pre-trip approval workflow**: out-of-policy bookings (air/hotel/
  car/rail) are auto-routed for approval *before ticketing*; unlimited approval levels by client rule;
  intelligent policy-checking flags out-of-policy options at point of booking. [SAP Concur Trip Approval](https://www.concur.com/en-us/tmc-solutions/trip-approval)
- **Navan** — embeds policy *into the booking flow*: in-policy options highlighted, out-of-policy
  marked with the reason, approval required only when flagged. Compliance is a search-time filter, not
  a separate gate. [Navan AI compliance tools](https://navan.com/blog/ai-tools-corporate-travel-policy-compliance),
  [Navan vs Concur vs Ramp](https://ramp.com/blog/navan-vs-concur-vs-ramp)

**Trigger model:** booking attribute vs policy rule (fare class, hotel rate cap, advance-purchase
window, preferred vendor). The "readiness" question is *"is this trip compliant / approved?"*

**Take:** maps onto Khonsera's work-persona readiness items — **"spend within cap?" / "this item needs
approval" / "outcome-note destination set"** — and onto the existing approvals/allowance layer
(build-spine §9). Treat compliance as **just another readiness category** gated by `has_workspace &&
item_over_cap`. Don't build a separate compliance product.

### Cross-tool synthesis of categories + triggers

| Category | Seen in | Representative checks | Triggered by |
|---|---|---|---|
| Reservation completeness | TripIt, Google | ticket per leg, hotel per night, return booked | itinerary holes |
| Documents | TripIt Pro | passport/visa/expiry, ID | is-international, has-flight |
| Packing | PackPoint | clothes by weather/activity/nights | forecast, nights, activities |
| Devices & power | Reminders, PackPoint | charger, adapter, power bank | always / is-international |
| Check-in / time-to-leave | TripIt, Google | flight check-in, leave-by | has-flight, computed leave-by |
| Household / close-house | Reminders templates | lights, mail hold, plants | user-added (not derivable) |
| Policy / compliance | Concur, Navan | in-policy?, approval, spend cap | has-workspace, over-cap |
| Weather-driven prep | PackPoint | umbrella, coat, de-ice, fuel margin | forecast |

---

## PART 2 — Document & entry-requirement third parties (the one area with real external services)

For everything except documents, Khonsera *derives* readiness from its own day-object. Documents and
entry requirements are the exception: they need an authoritative, continuously-updated external feed
of "what does a passport-holder of nationality X need to enter country Y on date D?" Three real
providers, plus the rules we can hard-code day-one.

### Sherpa° — Requirements API (recommended commercial provider)

Purpose-built for exactly this. Single API call to `/v3/trips` (or `/requirements`) returns **visa
requirements, passport validity rules (e.g. the 6-month rule, blank-page requirements), transit
requirements, vaccination/health advisories, and eVisa availability** for an origin/destination/
nationality/date tuple. API-key auth (`x-api-key`). Sherpa aggregates millions of data points from
thousands of official + trusted sources, with a team confirming **~55 rule changes/hour**. They also
offer eVisa *application* (a booking-style flow) and a document-processing engine (Regula-backed).
**Partner model:** B2B — request a key via a form describing use case/volume/timeline; pricing is
partner-negotiated (not public), and Sherpa's customers are airlines/OTAs (revenue often via eVisa
application commission rather than per-lookup fees). [Sherpa Requirements API docs](https://docs.joinsherpa.io/requirements-api/),
[Quickstart](https://docs.joinsherpa.io/requirements-api/quickstart.html),
[Sherpa solutions](https://www.joinsherpa.com/solutions),
[Regula case study](https://regulaforensics.com/explore/case-studies/sherpa/)

### IATA Timatic / Travel Centre — the airline gold standard

Timatic is the **TIM database** virtually every airline uses for boarding-gate document checks.
**Timatic AutoCheck** is an API that takes itinerary + traveller details and returns passport/visa/
health verdicts; **Timatic Web** is a web tool. ~70–200 rule updates/day. Access is **IATA-accredited
partner / enterprise** (airlines, GDSs, DCSs, accredited agents) — heavier and pricier to integrate
than Sherpa, command-line/GDS heritage. There is a **free consumer-facing IATA Travel Centre** web
page (no API) we could deep-link to. [IATA Timatic solutions](https://www.iata.org/en/services/compliance/timatic/),
[Timatic AutoCheck](https://www.iata.org/en/services/compliance/timatic/autocheck/),
[IATA Travel Centre](https://www.iatatravelcentre.com/iata-travellers-faq.htm),
[altexsoft Timatic explainer](https://www.altexsoft.com/blog/timatic/)

**Sherpa vs Timatic for Khonsera:** **Sherpa** — modern REST, self-serve key request, OTA-friendly
commercial terms, eVisa upsell that fits the "fill the gap in-app" posture. **Timatic** — the airline
authority but enterprise/accredited access. **Recommendation:** target **Sherpa** for the document
API when we wire it (build-plan international phase / L5); deep-link **IATA Travel Centre** as the
free interim authority. Both are *later* — see day-one below.

### Government feeds & hard-codable rules (day-one, free)

Most of what the readiness check needs day-one is **deterministic and hard-codable** without any API:

- **Passport-validity rules.** Two dominant patterns we can encode and check against the trip end date:
  - **6-month rule** — passport must be valid ≥6 months beyond entry/departure (much of Asia, Middle
    East; *Italy* applies 6 months even within Schengen-entry context). [worldpopulationreview 6-month list](https://worldpopulationreview.com/country-rankings/which-countries-require-6-months-of-passport-validity),
    [VFS six-month explainer](https://www.vfsglobal.com/en/individuals/insights/six-month-validity-rule-explained.html)
  - **Schengen 3-month rule** — valid ≥3 months beyond *intended departure from the Schengen zone*,
    AND issued within the last 10 years. Airlines deny boarding if unmet. [SchengenVisaInfo validity rules](https://schengenvisainfo.com/passport-validity-requirements/),
    [Rustic Pathways 6-vs-3-month guide](https://rusticpathways.com/blog/us-passport-validity-6-month-rule)
  - Khonsera can store the user's passport expiry (profile) and, given a destination + trip-end date,
    compute "expires within N months of return → flag" without any API. A static country→rule table
    (≈200 rows, refreshable) gets us most of the value; Sherpa replaces it later for visa/eVisa depth.
- **UK ETA** — **live since 2 Jan 2025** for non-visa nationals (incl. EEA/Swiss since Jan 2025);
  airlines must verify before boarding; British/Irish exempt. **Relevant to Khonsera for inbound
  international companions/clients, NOT outbound UK travellers** (per master §K). Encode as a readiness
  note when a non-UK national is travelling *to* the UK. [Home Office ETA factsheet Apr 2026](https://homeofficemedia.blog.gov.uk/electronic-travel-authorisation-eta-factsheet-april-2026/),
  [movingtotheuk ETA guide](https://movingtotheuk.co.uk/visas-and-immigration/visit-and-entry/uk-eta)
- **Driving licence / IDP, hire-car docs** — deterministic from "has hire-car + is-international";
  no API.

### Weather — Open-Meteo (already in the plan; free day-one)

Open-Meteo: **no API key, no signup**, hourly forecast up to 16 days + 80-yr history, CC-BY 4.0
(attribution). Free tier <10k calls/day (5k/hr, 600/min); **commercial use requires a paid plan** —
note for production. Feeds packing prompts (umbrella/coat), the **de-ice / fuel-margin** rural rule,
and "take a coat." [Open-Meteo](https://open-meteo.com/), [pricing](https://open-meteo.com/en/pricing),
[terms](https://open-meteo.com/en/terms)

### eSIM — Airalo Partner API (already verified in master §241)

Net-pricing reseller model (we keep margin above a floor), 1000+ packages / 200+ destinations,
REST + SDKs, sandbox/prod, iOS Universal Link direct install, low-data webhooks. Readiness item
"eSIM sorted?" → install link; MVP is the readiness flag + link, usage dashboard deferred.
[Airalo Partner Platform](https://blog.partners.airalo.com/blog/what-is-airalo-partner-platform),
[Airalo Partner API docs](https://partners-doc.airalo.com/)

### Day-one vs later

| Capability | Day-one (free / hard-coded) | Later (API) |
|---|---|---|
| Passport-expiry check | static country→rule table + stored expiry | Sherpa for edge cases |
| Visa / eVisa | "check requirements" deep-link to IATA Travel Centre | Sherpa Requirements API + eVisa application |
| UK ETA (inbound companions) | hard-coded rule + gov.uk link | — |
| Weather prep | Open-Meteo (free tier) | Open-Meteo commercial plan at scale |
| eSIM | Airalo flag + install link | Airalo full order/usage |
| Parking / hotel / ride / table gaps | flag + Task (stub the booking) | connection partners (L5) |

---

## PART 3 — The data-model question: STORED entity or DERIVED view? (decided)

**Decision: a DERIVED checklist (recomputed each load by a rules engine over the day-object) +
a MINIMAL persisted overlay of user state.** This is the standard pattern (PackPoint derives the
list; the user ticks items; TripIt derives reservation gaps from the parsed itinerary) and it fits
Khonsera's existing day-object architecture.

**Why derived, not stored as the source of truth:**

- The day-object is mutable right up to the day-of (a ticket loads, a hotel is booked, the user
  flips work/personal). A *stored* checklist would go stale the moment the day changes and would need
  reconciliation logic on every edit. Deriving fresh each load means the checklist is **always
  correct by construction** — exactly Khonsera's "never lose the user's work / persistence survives
  refresh" posture, achieved without a sync problem.
- Most checks are pure functions of day contents already in the DB (tickets/bookings/stops/mode/
  destination/forecast). Storing them duplicates state.

**Why we still need a small persisted overlay:** the user must be able to **tick** (mark done early —
"passport's in my bag"), **dismiss** (not relevant — "no, I don't need parking"), **snooze**, **add
their own** checks (close-the-house, meds), and attach a **note**. None of that is derivable; it must
survive refresh. So persist *only the user's verdict on each item*, keyed by a **stable item key**.

### Recommended schema (minimal — one table + optional user-items)

```
readiness_state                              -- user's verdict overlay on derived checks
  id            uuid pk
  itinerary_id  uuid  fk -> itineraries  (the Day; RLS via can_access_itinerary)
  item_key      text                     -- stable key of a derived check, e.g. "ticket:leg:<legId>",
                                          --   "passport:expiry", "parking:WLB", "esim:FR"
  status        text  check in ('open','done','dismissed','snoozed')   -- default 'open' is implicit (no row)
  snooze_until  timestamptz null
  note          text null
  app_mode      text null                -- inherits item's mode; privacy boundary unchanged
  created_at / updated_at
  unique (itinerary_id, item_key)
```

- **Absence of a row = `open` (derived default).** We only persist a row when the user acts on an
  item, keeping the table tiny.
- **User-added checks** can live in the **same table** with a generated key (`user:<uuid>`) plus a
  `label`/`category` column, OR — cleaner — reuse the existing **`tasks`** entity for "add your own"
  (a user-added readiness item *is* a day-bound task; the master already says action items / readiness
  feed tasks). **Recommendation:** derived checks + `readiness_state` overlay for *system* checks;
  **`tasks`** for *user-authored* items, surfaced in the same readiness UI. Avoids a second free-text
  store.
- **Stable keys are the contract.** A check's key must be deterministic from the day so the overlay
  re-binds across reloads even as the day mutates. Key off durable IDs (legId, hub code, country code),
  not array index.
- **RLS:** scope to `itinerary_id` and reuse `can_access_itinerary` (migration 0030) — the
  personal/work privacy boundary is inherited for free; no new boundary to get wrong.

### The rule registry shape (the engine)

A check is a **pure, declarative rule** evaluated against the day-object. Mirror the PackPoint shape
and the existing dictionary/fact-type registry pattern (`src/lib/dictionary/registry.ts`):

```ts
type ReadinessCategory =
  | 'tickets' | 'documents' | 'bookings' | 'devices'
  | 'international' | 'rural' | 'multiday' | 'compliance' | 'household';

interface ReadinessCheck {
  key: (day: DayObject) => string | string[];   // stable, possibly per-leg/per-night (fan-out)
  category: ReadinessCategory;
  label: (day: DayObject) => string;            // Khonsera-voiced, no emoji
  applies: (day: DayObject) => boolean;          // TRIGGER PREDICATE over day attributes
  satisfiedBy: (day: DayObject) => boolean;      // is the gap already filled by day contents?
  action?: ReadinessAction;                      // how the gap becomes actionable
  severity?: 'info' | 'should' | 'must';         // "boarding will be denied" vs "nice to have"
}

type ReadinessAction =
  | { kind: 'task' }                                   // set a Task now
  | { kind: 'book'; need: 'parking'|'hotel'|'ride'|'table'|'lounge' }  // connections seam (stub→L5)
  | { kind: 'esim'; country: string }                  // Airalo install link
  | { kind: 'link'; href: string }                     // IATA Travel Centre / gov.uk ETA
  | { kind: 'note' };                                   // attach a note / acknowledge
```

**Engine (`src/lib/readiness/engine.ts`, pure + unit-tested like `today/engine.ts`):**
`buildReadiness(day, overlay) → ReadinessItem[]` — for each registered check: if `applies(day)`,
emit item(s) for `key(day)`; compute derived status = `satisfiedBy(day) ? 'done' : 'open'`; then the
persisted `overlay` (readiness_state) **overrides** derived status where the user has acted
(`done`/`dismissed`/`snoozed`). Group by category for render. Registry in
`src/lib/readiness/checks/` (one module per category, registered in `registry.ts`) so adding a check =
add a module — same convention as the dictionary fact-types.

---

## PART 4 — Synthesis for Khonsera (the buildable spec)

### Category → checks → trigger predicate (over the day-object)

`day` carries: stops/anchors, transitions (with `mode`), tickets/travel_bookings (locked, barcode
present), accommodation_bookings, destination + forecast, `app_mode` tag, workspace + spend/cap,
multi-day span, user profile (passport expiry, home currency).

| Category | Check (`item_key`) | `applies(day)` trigger predicate | `satisfiedBy(day)` | severity | Action |
|---|---|---|---|---|---|
| **tickets** | `ticket:leg:<legId>` (per booked leg) | leg has a `travel_booking` requiring a ticket | ticket loaded **and** barcode reproduced (offline-cache verified) | must | task / re-import |
| tickets | `ticket:gap:<legId>` | a transition leg has **no** booking | n/a (it's a gap) | should | book (transport, stub) |
| **documents** | `doc:id:domestic-flight` | has-flight && domestic && operator requires photo ID | profile has ID noted | should | note |
| documents | `passport:expiry` | is-international (any flight/leg crosses border) | passport expiry ≥ rule margin beyond trip-end | **must** | link (renew) / note |
| documents | `visa:<country>` | is-international && destination requires visa for nationality | visa present/eVisa held | must | link (IATA Travel Centre → Sherpa later) |
| documents | `eta:uk:<companion>` | inbound companion/client is non-UK/IE national travelling to UK | ETA held | must | link (gov.uk ETA) |
| documents | `licence:hire-car` | day has a **hire-car** booking | licence (+ IDP if intl) noted | must | note |
| documents | `workdocs:<commitmentId>` | a work commitment's prep note lists "what to bring" | items acknowledged | should | note (pulls from notes checklist) |
| **bookings** | `parking:<hubId>` | drives to a station/airport with no return-home leg (car left there) | parking booking present | should | book parking (Parkopedia/Arrive, stub) |
| bookings | `hotel:night:<date>` | multi-day && a night has no accommodation | accommodation covers the night | should | book hotel (Booking.com Demand, stub) |
| bookings | `ride:onward:<legId>` | a hub-arrival with no onward transition resolved | onward leg present | should | book ride (rideshare, stub) |
| bookings | `table:<commitmentId>` | a dinner/dining commitment with no reservation ref | reservation present | info | book table (stub) |
| bookings | `lounge:<legId>` | layover/wait > threshold at an airport | lounge booked | info | book lounge (stub) |
| **devices** | `power:charge` | day relies on phone for tickets/nav (always true day-of) | — (acknowledge) | info | note |
| devices | `power:adapter` | is-international && destination plug differs | — | info | note |
| devices | `power:bank` | long day / multiple e-tickets | — | info | note |
| **international** | `currency:<country>` | is-international | home-currency view configured | info | note (FX) |
| international | `esim:<country>` | is-international | eSIM sorted | should | esim (Airalo install link) |
| international | `timezone:<country>` | destination tz ≠ home tz | tz noted/applied | info | note |
| **rural** | `fuel:charge` | drive leg distance > threshold && rural (no rail fallback) | — (acknowledge / EV charge planned) | should | note + (weather → de-ice) |
| rural | `parking:dest:<siteId>` | drive to unfamiliar destination, no resolved car park | parking resolved at true entrance | should | book/resolve parking |
| rural | `route:no-rail-fallback` | drive-only day, no rail alternative on corridor | route checked/confirmed | info | note |
| **multiday** | `hotel:times` | multi-day stay present | check-in/out times confirmed | info | note |
| multiday | `pack:shape` | multi-day | acknowledged (nights + weather + occasions shown) | info | note (PackPoint-style summary) |
| multiday | `itinerary:assembled` | multi-day | all legs/nights present (no holes) | info | — |
| **compliance** (work) | `spend:cap` | has-workspace && trip spend tracked | within cap | should | note / route for approval |
| compliance | `approval:<bookingId>` | has-workspace && a booking is over-cap/out-of-policy | approved | must | route for approval (L9) |
| compliance | `outcome:note-dest` | has-workspace work visit | outcome-note destination set | info | note |
| **household** (user) | `user:<uuid>` | user-added | user ticks | — | task |
| weather-driven (cross-cat) | `weather:coat` / `weather:umbrella` / `weather:deice` | `forecast` thresholds (precip/temp) on travel-day corridor | acknowledged | info | note |

### How each gap becomes ACTIONABLE

Per master §B3.3 "anything missing is not just flagged — it's actionable." The `action` on each check
drives a single tap:

- **`task`** → creates a day-bound `Task` (existing entity) — "set the reminder here."
- **`book`** → opens the **connections seam** (`docs/edition-iii` L5; **stubbed/mock until then** per
  handover §17 booking-is-the-one-stub) for parking / hotel / ride / table / lounge; on "book" it
  flows back into the day-object as a Ticket/Commitment, which then *satisfies* the check on next
  derive (no manual tick needed). Mock provider returns a fake confirmation now.
- **`esim`** → Airalo install link (Universal Link), readiness flag flips on order.
- **`link`** → IATA Travel Centre (day-one) / gov.uk ETA / passport renewal — deep-link to authority.
- **`note`** → acknowledge / attach a note (writes `readiness_state.note` or marks `done`).

### How it pulls from the notes' checklist + the day-object

- **From the day-object (derived):** tickets/bookings/stops/transitions/mode/destination/forecast/
  spend — every `applies`/`satisfiedBy` predicate reads the same day-object the timeline renders.
  Adding a hotel or loading a ticket *automatically* satisfies the relevant check (no double entry).
- **From notes (per-commitment "what to bring" checklist):** master §B3.5 — prep notes on a
  Commitment carry an agenda / what-to-bring / documents list. The `workdocs:<commitmentId>` check
  reads that note's checklist and surfaces each unticked item as a readiness gap; ticking in readiness
  writes back to the note's checklist (single source). This is the bridge between the "materials the
  day needs" (notes stage) and the readiness check.
- **From the user (persisted):** user-added items via `tasks`, surfaced in the readiness UI alongside
  derived checks; the `readiness_state` overlay records done/dismissed/snoozed/note on system checks.

### Build shape (Phase 4)

1. **Migration** (`00xx_readiness_state.sql`): the `readiness_state` table above + RLS via
   `can_access_itinerary`. (User-added items reuse `tasks`.)
2. **Engine** `src/lib/readiness/engine.ts` (pure) + `checks/<category>.ts` registry — unit-tested
   like `src/lib/today/engine.ts`.
3. **Static data**: country→passport-rule table + plug/tz/currency lookups (hard-coded, free).
4. **Server action** `getReadiness(itineraryId)` → derive + merge overlay; `setReadinessStatus(...)`.
5. **UI**: `ReadinessPrompt` (already a contract component name in `src/components/concierge/`) renders
   grouped categories with sorted/missing state; each gap shows its action. Khonsera-voiced, no emoji.
6. **Connections** wired as a **mock provider** behind the clean interface now; real partners at L5.

---

## Top takeaways

1. **Derived + thin overlay is the right model.** Recompute the checklist from the day-object every
   load (always correct, no sync); persist only the user's verdict in a tiny `readiness_state`
   `{itinerary_id, item_key, status, snooze_until, note}` table (absence = open). Reuse `tasks` for
   user-added items; reuse `can_access_itinerary` RLS for the privacy boundary.
2. **PackPoint is the rule-engine template; TripIt is the derive-the-gaps template.** Adopt the
   `{key, category, label, applies(day), satisfiedBy(day), action, severity}` rule shape; Khonsera's
   day-object already carries the attributes PackPoint interrogates the user for, so most checks
   self-satisfy as the day fills.
3. **Documents are the only category needing a real external service.** Day-one: hard-code passport
   6-month / Schengen 3-month rules + UK-ETA-inbound + deep-link IATA Travel Centre (free). Later:
   **Sherpa Requirements API** (modern REST, OTA-friendly, eVisa upsell) over Timatic (airline-grade
   but enterprise/accredited). Weather = Open-Meteo (free tier; **commercial plan needed at scale**),
   eSIM = Airalo Partner API (both already in the plan).
4. **Every gap is one tap to actionable, via the `action` field** — set a Task, book via the
   connections seam (mocked now, real at L5; booking flows back and auto-satisfies the check), sort
   the eSIM (Airalo link), or deep-link the document authority. No dead flags.
5. **Compliance is just another category, not a separate product.** The corporate pattern (Concur
   approval / Navan in-flow policy) maps to work-persona readiness checks (`spend:cap`,
   `approval:<id>`, `outcome:note-dest`) gated by `has_workspace`, reusing the existing approvals/
   allowance layer (build-spine §9) — and the personal/work privacy boundary is inherited from RLS.

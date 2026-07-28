# CLAUDE.md — Institutional Knowledge for Khonsera

**Every session must read this before making changes. Update it before ending.**

## Design↔Code Protocol — re-ground every session

Khonsera runs a **Design↔Code Handoff Protocol** (`docs/design-code-handoff-protocol.md`): Claude
Design and Claude Code share no memory, so two artifacts are the lingua franca, re-grounded at the
start of every session:

1. **`docs/design-tokens.md`** — the canonical `theme` (mirror of the CSS custom properties in
   `src/app/globals.css`, proxied by `tailwind.config.ts`).
2. **`docs/component-contract.md`** — the §3 component/screen inventory mapped to real files.

**Iron rule:** new code references **token names**, never raw `#hex`/`px`. A new shared value is a
**token request** — add the `--token` to `globals.css` + `docs/design-tokens.md` (+ Tailwind proxy
if a utility is wanted), never a one-off hardcode. Tokens never fork. (Legacy inline-px styles are
migrated to tokens incrementally per-component, not in a big sweep — see the manifest's migration
status.)

### Current visual authority — Instrument Edition v8 + Today Screen One (2026-07-28)

The approved source is **Khonsera Design System 9**, implemented in
`src/app/khonsera-instrument-tokens.css` and the final application layer
`src/app/khonsera-instrument.css`. These load after the historical edition CSS and therefore define
the effective UI. **The uploaded Screen One reference is the newer, route-specific authority for
`/today`**, implemented last in `src/app/khonsera-screen-one.css`. Keep the existing data/action
contracts; evolve presentation through these final layers.

- Neutral stone ground, flat white cards, cool high-contrast ink, hairline structure and quiet
  single-direction elevation.
- Signal green remains the general interaction accent. On `/today`, Screen One intentionally uses
  rail orange for the brand dot, live markers and single primary actions; the selectors are scoped
  to the Today composition and must not recolour other product surfaces.
- Satoshi carries display/UI/body; JetBrains Mono carries time, codes, eyebrows and technical
  status. No serif or literary italic.
- Identity is the uppercase Satoshi wordmark plus one signal-green dot. The moon/pictorial emblem,
  paper grain, letterpress and deboss effects are retired from app chrome.
- Mobile is one calm chronological column with 44px minimum targets and persistent app/tab bars.
  `/today` remains one bounded 760px column at every width; other desktop application surfaces use
  the Instrument shell rules.
- `/today` orders compact context → next move → six-hour conditions → itinerary → wallet/planning
  exits. The former route map is retired from Today: `View best route` opens route detail and the
  interactive journey map remains on `/plan/[id]`.
- Historical spine selectors are not safe on the instrument surfaces:
  `TodaySpine` must not regain `.cc-spine-v7`, whose legacy 42px grid column collapses populated
  cards. Instrument node placement is guarded by `.khonsera-app .cc-spine .cc-node`; Plan groups a
  stop and its related controls in `.cc-spine-entry`.
- Check `tsconfig.json` before editing a named component: production currently aliases
  `@/components/today/today-spine` to `today-spine-fixed.tsx` and
  `@/components/plan/plan-spine` to the bookend wrapper. A visual fix applied only to the similarly
  named inactive source will typecheck and build without changing the application.
- A responsive check is not valid unless it renders a **populated, multi-leg itinerary** through the
  real `TodaySpine`, `PlanSpine` and `LivePass` components. Verify both the outer node and its inner
  card/pass content at 390px and 1440px, with zero horizontal overflow. The empty/simplified harness
  previously missed inner pass clipping even when the node itself reported a healthy width.
- The live-day spine is a decision surface, not a database dump. A rail pass owns its departure and
  arrival milestones; do not repeat adjacent station anchors that describe the same points. Keep
  genuine changeovers as compact transfer rows. Docked rail passes use the compact semantic
  `cc-pass-*` structure, preserving route, times and status while hiding secondary fields.
  Today passes additionally use the `today`/`.cc-pass--today` operational face.
- Inline **Add here** affordances belong after real commitment anchors, not between the departure,
  changeover and arrival records of a transport run. Today has one page header only: date eyebrow,
  day purpose, and origin; do not reintroduce a second title block inside the primary column.
- Mobile `/plan/[id]` keeps the route map and bookings visible, but groups budget, sharing,
  constraints and intake behind **Day tools**. On desktop that body is always visible. `/today`
  offers one contextual `Plan something` action rather than duplicating the full intake toolkit.
- The Screen One “Keep N-min margin” switch persists
  `travel_profiles.default_arrival_buffer_minutes` through the existing `updateTravelProfile`
  action. It changes Today station leave-by calculations; it is not a decorative toggle.
- `src/app/__design/today/page.tsx` is the sample-data responsive harness for Screen One. It renders
  the real `LiveDay`, active `TodaySpine` alias and `LivePass`, disables only the end-bookend lookup,
  and returns 404 when `VERCEL_ENV=production`. Use its preview deployment for the required 390px /
  1440px overflow check without exposing a user itinerary.
- The uploaded source has a duplicated light selector that accidentally repeats night accent values;
  the imported `khonsera-instrument-tokens.css` removes that duplicate and keeps the earlier
  canonical light signal-green tokens.

## Foundation Rebuild — Standing Orders & Build Spine (current programme)

The product is being taken to a clean, navigable foundation per three handover docs (Technical
Handover v2, Code Kickoff Brief, Standing Orders). Posture and decisions live in `DECISIONS.md`;
the triage in `docs/foundation-rebuild-triage.md`. Honour these every turn:

- **Decide and proceed.** Make conventional implementation calls and keep building; log assumptions
  in `DECISIONS.md`, don't interrogate. Pause only for: the triage checkpoint, a genuine spec
  contradiction, or a data-loss/irreversible action.
- **Coherence is part of done** (deep review 2026-06-15, `docs/deep-review-2026-06-15.md`). A phase
  is NOT done when the capability works end-to-end — it's done when the capability sits _coherently_
  in the surface. Definition-of-done for any phase that adds UI: (a) if it adds a sidebar row, it
  gets a DISTINCT glyph and lands in the right nav group (Day / Money & travel / Account); (b) if it
  adds a panel to `/plan/[id]`, decide where it belongs in the hierarchy — primary _day_ spine vs.
  the collapsed **Trip tools** region — never just append; (c) anything user-named is renameable
  (no "untitled" dead-ends). Velocity must not re-accrue coherence debt.
- **Tokens only, never raw values** (the iron rule above). The `theme` is the single source of truth.
- **Brand voice:** the concierge is **"Khonsera"** — never a human name. All assistant copy is
  voiced as Khonsera. **No emojis, ever.**
- **Identity is the spine:** every record is scoped to a **user + Mode (work|personal)** (+ workspace
  where applicable). **Personal-mode data is NEVER visible to any workspace/manager/admin** — a
  correctness/security boundary enforced in the data layer via RLS (`can_access_itinerary`, migration
  0030), not just app code. Getting it wrong is a data breach.
- **Never lose the user's work** — persistence survives refresh/navigation.
- **Booking is the one stub** (handover §17): build the decision/comparison layer fully behind a
  clean provider interface; fake the transaction.

**Locked stack:** Next.js App Router + React + TypeScript (mobile-first, PWA-capable) · Supabase
(Postgres + Auth + RLS) · token-driven styling (CSS vars proxied by Tailwind) · **web maps** =
MapLibre + self-hosted Protomaps (keep) · Valhalla (routing) + OpenTripPlanner (transit) + TfL
(London) when nav is reached.

**Maps — platform split (decided; see `docs/native-map-strategy.md` + DECISIONS D104).** The product
is going **true-native** (Swift iOS + Kotlin Android, plus web desktop). The **flagship** map / offline
/ turn-by-turn experience is built **native with Mapbox** — its native SDKs do offline region+route
downloads and first-class navigation, and the **Standard style** gives realtime lighting/shadows/AO
(the "clay" look) for free; high free tier. Mapbox offline is a _native_ capability — on **web (GL JS)**
it's unsupported + against ToS to cache tiles — so **web stays MapLibre + self-hosted Protomaps**
(free, self-hostable, offline-capable via the `khnav://` IDB cache). **Do NOT build the flagship map
twice:** no deck.gl / Three.js / clay-3D engine on web. MapLibre's flat-shaded `fill-extrusion` can't
do soft shadows/AO/rounded edges — the web clay attempts (abstract SVG, extruded buildings, a buffered
"raised route" that rendered as a beige block) were dead ends; the web day map is the calm MapLibre
**cotton** vector theme (`themes/cotton.ts`) and that's where it stays.

**Core data model (migration 0010 + 0030):** `Journey`=itineraries · `Anchor`=stops · `Leg`=transitions
· `Intention` · `Gap` · `ResourceState` · `Task` · identity = profiles/workspaces/memberships +
`app_mode`. Roles map legacy owner/admin/member/viewer → company_admin/team_manager/traveller.

**Contract component names** (placeholders now, Design restyles later — don't rename): `ActiveTile`,
`AnchorCard`, `IntentionCard`, `GapCard`, `LegCard`, `ComparisonMatrix`, `JourneyListCard`,
`ModeSwitch`, `ContactChip`, `TaskRow`, `ExpenseRow`, `NudgeCard`, `ReadinessPrompt`. They live in
`src/components/concierge/`.

**Build-order spine (handover §18) — build by dependency, not release phase:**

1. Foundation: identity + Mode + privacy boundary + persistence.
2. Core surface + model: timeline; Journey/Anchor/Intention/Gap/Leg/ResourceState.
3. Capture: manual entry + email sync (extend the Trainline parser).
4. Decision layer: comparison engine; flights-as-anchors; readiness back-calc.
5. Day-of: active tile + next-leg peek + overview; live status (TfL first).
6. Navigation: Valhalla walking → London transit (TfL) → national (OTP/GTFS).
7. Orchestration: contingency; unplanned-time radius.
8. People & ledger: contacts; messaging/notifications; tasks; expenses.
9. Teams machinery: workspace admin, approvals, allowance/per-diem, reimbursement.

## Live & contextual layer (Edition III P9–P12) — engines on `/plan/[id]`

Three pure, unit-tested engines drive the day-of intelligence; each is fed by a server reader in
`plan/[id]/page.tsx` and degrades silently when its signal is absent:

- **Live spine** (`src/lib/live/engine.ts`, P9–P10): `decisionClock`, `delayConsequence`, `cascade`,
  `fragility`. Sourced from **Darwin** (rail; gated `DARWIN_LDBWS_TOKEN`/`_KEY`) + **TfL** (gated
  `TFL_APP_KEY`).
- **Recovery** (`src/lib/recovery/*`, P11): `buildRecoveryOptions` (the way-out trade-off band +
  outbound/return as one unit) + `rankFor` (waits on a founder protect-target). Ways-out from Darwin's
  destination-filtered board + **OTP** cross-network detours (gated `OTP_URL`, inert until self-hosted —
  `docs/otp-self-hosting.md`). `rankFor` is built but OFF until protect-target is set.
- **Context care** (`src/lib/context/engine.ts`, P12–P13): threshold rules → confirmable `NudgeCard`
  (`PlanNudges`). Six rules: **weather→leave-earlier** (real keyless **Open-Meteo**),
  **running-late→fast-track** + **long-layover→lounge** (both via **DragonPass** — the single active
  airport-experience partner, D52 short-term; the fast-track mirror: same airport buffer, thin<75→
  fast-track, long≥90→lounge. Collinson is the dormant long-term target), **car-park-full→pre-book**
  (**Parkopedia** mock outlook), **gate-change→reroute** (**AeroDataBox** gate, mock, diffed vs the
  plan's last-known gate). Verdicts persist in `nudge_states` (mig 0036, owner-only RLS); nudges are
  never stored, always re-derived. Accept applies via the seam (a prep note / a minted voucher/pass/
  reservation); dismiss never pesters. Adding a rule = a function + a line in `evaluateContext`.

**Provider gating rule:** every external adapter self-gates on its env var and returns null/mock when
unset — the build NEVER blocks on a key, and an unset key shows honest mock with a "· sample" cue, not
a false alarm. New env vars: `OTP_URL`, `OTP_GRAPHQL_PATH?`, `DRAGONPASS_KEY` (fast-track + lounge),
`PARKOPEDIA_KEY`, `AERODATABOX_KEY`, `OPEN_METEO_URL?`, `COLLINSON_KEY?` (dormant long-term target),
`DUFFEL_API_TOKEN` (P14 flights — `duffel_test_…` routes to test mode), `ASSERTIS_KEY?` (rail booking, pending).
**The flip side — a feature shipping silently in its budget fallback because a switch is off — is
catalogued in `docs/env-switches.md`. Check Tier 1 there FIRST whenever something "looks/feels
un-premium but the code is clearly there" (it caught the raster-vs-vector basemap and the 40s geocode).**

## Connections / booking (Edition III P14) — `src/lib/connections/` + `integrations/duffel.ts`

The reusable supplier pattern: one **Offer → Quote → Booking** vocabulary every connector speaks, so the
surface searches/compares/books the same way and a mock swaps for a real adapter with no caller change.
**Duffel Flights is LIVE against test mode** (the framework's proof) — search→compare→book in
`FlightFinder`, the booked flight lands as a flight run via `addTransport`. Duffel Stays is real-shaped
but pending account activation (403→mock). Build interfaces on the REAL provider contract (research-first)
so mock→real is a swap, not a redesign; the money step is the one permitted stub (test mode = no charge).

## Mandatory: Keep docs/ updated

After making changes to any itinerary page, the Gmail import pipeline, or the shared Timeline component, **update `docs/itinerary-pages.md`** to reflect the change. This document is the design reference for anyone picking up the codebase — it must stay current. If a new page is added, add a new doc file for it.

## Known Bugs (as of 2026-05-26)

### Planning page after brief submit

- All previously listed bugs FIXED (see git history)
- ~~Batch transition insert crashed on unique constraint~~ FIXED: `.insert()` → `.upsert()` with onConflict
- ~~Changeover stops (Leicester) had no transport_hub_id~~ FIXED: Gmail import now resolves changeover station names via resolveHubByName
- ~~Google Transit duration overwrites booked train times~~ FIXED: skip `computed_duration_minutes` overwrite for locked (is_locked=true) legs
- ~~Changeover duration uses arrival instead of departure~~ FIXED: use `from.end_time` (departure) instead of `from.start_time` (arrival) for changeover stops
- ~~No return-home walk transition without "be home by"~~ FIXED: always create a type="end" return-home stop so the transition loop generates the walk-home leg
- ~~Feasibility warnings on locked train legs~~ FIXED: skip feasibility checks for locked transitions (0m slack on a booked train is a fact, not a warning)
- ~~Badge times empty on first load~~ FIXED: fall back to transition's computed_duration_minutes when preview cache is empty

## Architecture

- **Next.js App Router** + **Supabase** (Postgres) + **Server Actions**
- Deployed on **Vercel** (serverless). Native Node modules (e.g. old `pdf-parse`) crash on Vercel — use pure JS alternatives or dynamic imports with try/catch.
- Supabase project: `attbfwemjoslugvtfbrt` (EU West 1)
- Vercel project: `prj_Dwmmyzk75AT0sJDchcJ52rU9ZTLz`, team `team_zK6YQHcoKN5rkpkCfohV4nXg`

### Offline / PWA — day-of resilience (the Aztec must survive no-signal)

The barrier is the test: off the train, no signal, you still need your Aztec. Two halves:

- **Shell** — a hand-rolled service worker (`public/sw.js`, registered by
  `src/components/pwa-register.tsx` in the root layout) + `public/manifest.webmanifest` (installable,
  `start_url:/today`). Strategy is conservative (it ships to a real phone): `/_next/static` cache-first
  (content-hashed = safe); navigations **network-first → cached snapshot → `/offline`** (fresh online,
  last-known offline, never a stale app that can't update); cross-origin (Supabase/Darwin/fonts) is
  **never** touched. Bump `VERSION` in sw.js to roll caches.
- **Cached day** — `src/lib/offline/ticket-cache.ts` (IndexedDB, no dep) holds a `TicketVM[]` snapshot.
  `OfflineTicketSync` (mounted on Today + Wallet) write-throughs it whenever those load online.
  `/offline` (`src/app/offline/page.tsx`, top-level/static so it boots with zero server work →
  precached) renders the saved passes + Aztec via the on-device `BarcodePresenter`.
- **Barcodes draw on-device** (bwip-js `bwip-js/browser` → canvas) from the saved payload — the new
  Pass/ScanView family always did; the legacy `TrainTicketCard` was migrated off the `/api/barcode`
  server image (which needed signal exactly when absent). `/api/barcode` is now unused.
- **Known limit:** runtime caching only covers chunks fetched while online — a route the user never
  opened online may miss its page chunk offline. The primary guarantee (cached `/today`+`/wallet`
  snapshots they DID visit + the `/offline` IndexedDB fallback) covers the real scenario. Upgrade path
  for full precache: Serwist (`@serwist/next`) reading the build manifest.

### Point-to-point navigation (`/navigate`) — see `docs/navigation.md`

Build spine §6, fully open-source and self-hostable: **Valhalla** routing (`VALHALLA_URL`,
default FOSSGIS) + MapLibre/OSM render. **Geocoding is Google Places Text Search** (fast, complete;
the public komoot Photon was ~20s + patchy — D54), with **Photon** (`PHOTON_URL`) kept as the no-key
fallback. Mileage tracker (P15) reuses this geocoder + Valhalla.

- Provider-agnostic core in `src/lib/nav/` (types/valhalla/shape/guidance/tiles — pure,
  unit-tested). Server actions in `src/lib/actions/nav.ts`. UI in `src/components/nav/`.
- **Valhalla shapes are polyline precision 6**, not 5 — `nav/shape.ts` takes a precision arg;
  the journey-map decoder stays 5.
- Live guidance: pure `guidanceTick` engine + `use-guidance.ts` (watchPosition, SpeechSynthesis
  voice, off-route 25/50/80m walk/cycle/drive sustained 8s → auto re-route when online).
- **Offline routes**: `src/lib/offline/nav-cache.ts` (IndexedDB `khonsera-nav`, separate DB from
  the ticket cache so versions never conflict) stores route JSON + corridor tiles (z13/z15 ribbon
  - z16 at maneuvers, capped 400, refcounted per route). NavMap serves tiles via a custom
    `khnav://` MapLibre protocol — IDB first, network fallback. The SW stays out of tile caching.
- Deep-link a destination: `/navigate?dlat=&dlng=&dname=` (the "take me there" seam).
- Public instances are fair-use — **self-host both before real traffic** (env vars only).
- Transit legs (TfL → OTP) are NOT built yet; the adapter seam beside `valhalla.ts` is ready.
- **Premium vector basemap (opt-in via `NEXT_PUBLIC_PMTILES_URL`)** — Protomaps v4 vector
  tiles via `protomaps-themes-base`, branded to dusk/midnight/sahara (`brand-vector-theme.ts`),
  with 3D buildings + terrain (`build-vector-style.ts`). Default (unset) = raster OSM,
  unchanged. Both basemaps flow through the shared cache-aware `khnav://` protocol in
  `journey-map/pmtiles-source.ts` (vector PBF cached in a separate `khonsera-nav-v` IDB).
  Terrain is opt-in via `NEXT_PUBLIC_TERRAIN_URL` (a terrarium DEM; off by default). Self-host
  the `.pmtiles` + glyph/sprite assets for production. NavMap surfaces any map init/tile error
  inline (not a silent blank) and force-resizes on load. See `docs/navigation.md`.

### BENCHED (2026-06-14): Tell Khonsera + Ask Khonsera — free-text is parked

**Decision (founder, Edition III direction):** the deterministic free-text parser misclassifies
events too often to ship. **Capture is now email-import + manual entry only.** Both the free-text
**capture** ("Tell Khonsera") and the read-only NL **query** layer ("Ask Khonsera") are **removed
from the product surface** — every entry point (sidebar/mobile nav buttons, welcome fork, Today/Plan
empty-state CTAs, the brief's quiet link, `PlanCapture` on `/plan/[id]`, the landing-page hero copy)
now points to **manual entry (`/itineraries/new`, which also has Gmail import)**. `/capture` and
`/capture/drafts` **redirect** to `/itineraries/new`.

The engine is **dormant, NOT deleted** — `src/lib/parser/*` (~7k lines), `src/lib/dictionary/*`,
`src/components/capture/*`, `src/components/plan/plan-capture.tsx`, and the
`previewCapture`/`routeCaptureGlobal`/`captureToEvent`/`confirmCapture` actions all remain in the
tree, unimported. **Do not wire them back into the surface.** Free-text returns **later as an
AI-enabled tier** where an **LLM** (not this parser) handles parsing. The sections below describe
that dormant engine — keep for reference, but it is not a live path. Email reads only build
structured hotel/train/flight **cards**; there is no free-text "tell" or "ask".

### Tell Khonsera capture substrate (migrations 0027/0028)

Foundation for the natural-language capture feature. See `docs/tell-khonsera-substrate.md`.

- Facts (`stops`/`transitions`/`travel_bookings`) carry `confidence`, `source`,
  `commitment_state` (raw→done lifecycle — NOT the same as `stops.commitment`, which is
  solver hardness). Defaults preserve all existing behaviour.
- New tables: `captured_inputs` (raw text + parser draft), `standing_facts`, `intents`.
- Fact-type schema registry in code at `src/lib/dictionary/` (slots, tiers, resolvers) —
  the single source of truth the future parser + gap engine read. Add a fact-type =
  a module under `fact-types/` registered in `registry.ts`.
- 0028 enabled RLS on four previously-exposed tables (gmail_scanned_emails + 3 rail tables).

### Tell Khonsera parser engine (deterministic, no AI) — see `docs/tell-khonsera-parser.md`

- Dictionary in `src/lib/dictionary/`: bundled YAML (`data/layer_1/3/4`) fused by
  `load.ts` with the TS mapping registry; `getDictionary()` is the cached singleton.
  Layer 2 gazetteer = the existing `transport_hubs` table (no YAML). Layer 5 = code.
- 10-stage pipeline in `src/lib/parser/` (tokenise → recognisers → lookup →
  imperatives → segment → classify → slots → link → validate → parse). `parse()` is
  pure given a `Dictionary` + injected `PlaceResolver`; multi-fact output.
- Actions in `src/lib/actions/tell-khonsera.ts`: `previewCapture` (stateless,
  read-only — NEVER writes captured_inputs), the captured_inputs lifecycle, and
  `confirmCapture` → materialise via `createItineraryFromBrief` + provenance stamp.
- HARD RULE (brief §16): unbooked travel → a `transition` (planned), NOT a
  `travel_booking`. `materialise.factIsBooked` gates this. Don't pollute the booking layer.
- chrono-node does dates/times; `recognisers/dates.ts` supplements bare ordinals
  ("the 22nd") which this chrono version doesn't resolve.
- The gap engine is NOT built yet — that's the next programme stage.

### Tell Khonsera capture UI (`/capture`) — see build programme §3

- `src/app/(app)/capture/page.tsx` (server: loads picker data + builds serialisable slot
  schemas from `getDictionary()`) → `src/components/capture/capture-screen.tsx` (client).
  `/capture/drafts` lists saved `pending_review`/`corrected` drafts to resume (`?draft=<id>`).
- Live preview calls `previewCapture` on a 300ms debounce — READ-ONLY, never writes
  captured_inputs. One `FactCard` per fact; tappable slots open `slot-editor.tsx` (reuses
  transport-hub-picker for transit, place-picker for event places, searchContacts for people).
  Editing a slot does NOT re-parse; corrections are user-authoritative (high confidence).
- Pure helpers in `src/components/capture/draft-model.ts` (correction prune/apply, labels,
  voice-safe formatting) are unit-tested without a DOM harness.
- Tell is NOT a nav destination — it's a "Tell" ACTION reachable from every page
  (gold button in the desktop sidebar header + the mobile topbar), plus a quiet link on
  /itineraries/new. The capture page is where that action takes you. The action bar on the
  capture screen is `position: sticky` (NOT fixed) so it sits above the mobile tabbar and
  never overlaps the desktop sidebar — fixed positioning made "Add it →" unreachable.
- `[Add it →]` is always reachable (fixed action bar); adds all non-dismissed facts.

### Tell Khonsera smart capture (badges + autosuggest + proximity) — see `docs/tell-khonsera-capture.md`

- Entity slots (place/person/station) render as **badges**: gold when bound to a real entity
  (value object carries `hub_id`/`location_id`/`customer_site_id`/`contact_id`), grey when
  `ambiguous` (opens a proximity-ranked candidate chooser) or `unknown` verbatim.
- **No persisted bindings store.** Badges + the read-back mirror paint purely from the live
  `ParsedPayload`. Picking an autosuggest item **rewrites the typed fragment to the canonical
  name** so the next parse binds it deterministically. Card edits use the existing `corrections`.
- **Live mid-sentence autosuggest** (`use-active-token.ts` + `suggest-popover.tsx`): the active
  token's role is inferred from the preceding operator (`from`/`to`→station, `at`/`in`/`near`→place,
  `meet`/`with`/`see`→person; airport when the clause mentions flying), mirroring `place.ts`
  `roleFromOperator`. Debounced 250ms, proximity-seeded from bound coords in the draft.
- **Proximity** (`src/lib/geo.ts`: `haversineMeters`/`formatMiles`/`rankByProximity`):
  `searchTransportHubs` + new `searchPlaces` take an optional `near` anchor → `distance_m` + miles.
  Empty-query + `near` does a bbox "nearest station" lookup. Coords live on
  `transport_hubs`/`locations`/`customer_sites` AND on resolved slot values (parser carries them).
- **Inline contact create** (`createContactQuick`): migration 0029 made `contacts.customer_id`
  nullable; `relation`→`role`, `company`→`notes` (no dedicated column yet).
- The inline-badge surface is the **annotated read-back line** beneath the textarea (mirror div
  painted from slot `source_range`s), NOT a transparent-textarea overlay — chosen for robustness
  (no pixel-alignment maths to verify without a browser).
- A bound person flows through on confirm: `materialise.ts` carries the `contact` slot's
  `contact_id` onto the event anchor → `anchorInputSchema.contact_id` → `stops.contact_id`
  (event/meal/call anchors only).

## Design Principles

### One surface — the plan IS the intake (2026-06-15, founder direction)

The separate **Brief intake form (`/itineraries/new`) is RETIRED** — it "didn't land right": a new
day was meant to open straight into the plan, not a standalone form. Every "Plan a day" entry point
(Today, Plan index, sidebar foot, mobile topbar, welcome fork) now routes through **`PlanCreate`**
(`createEvent` → a blank `/plan/[id]`); `/itineraries/new` **redirects to `/plan`** and
`new-itinerary-form.tsx` is **dormant** (kept in the tree, not deleted). The canonical surface
`/plan/[id]` carries the **full toolkit** — manual add with **changeover-capable transport** (`PlanAdd`
→ `addBookingRun`), Gmail import (`PlanImport`), flight/stay finders. (Superseded the old "One
Toolkit, Two Views": there is now ONE editing surface, so a tool can't be withheld from "the other"
page — there is no other page. Add capability to the plan.)

### Bookings Are Facts, Stops Are Events

- **Transport bookings** (train tickets) create timeline events (departure + arrival stops)
- **Accommodation bookings** are constraints (check-in-from, check-out-by), NOT fixed journey points. The user places hotel visit stops on the timeline as needed.
- One way to add booked transport (`PlanAdd` → `addBookingRun`). One way to add accommodation.

### No Emojis

The app does not use emojis anywhere. Ever. This has been explicitly stated by the user multiple times.

## Gmail Booking Import — HARD-WON FIXES

These fixes were debugged over many hours. Do NOT revert them.

### Search Query (buildSearchQuery in `src/lib/actions/gmail.ts`)

The Gmail search query MUST use three paths:

1. `from:trainline OR from:lner...` — direct from known senders
2. Subject keywords + provider in body — catches forwarded emails
3. Provider name anywhere in email — broadest fallback

Subject keywords MUST include: `eticket`, `etickets`, `tickets` (plural), `trip` — in addition to `confirmation`, `booking`, `ticket`, `e-ticket`, etc. Trainline sends emails with subject "Your etickets to Derby" — "etickets" as one word does NOT match "ticket" or "e-ticket".

**DO NOT** revert to a narrow query like `(from:sender) AND (subject:keyword)`. This was tried and fails for:

- Forwarded emails (sender is the forwarder, not Trainline)
- Trainline eticket emails (subject says "etickets" not "ticket")

### Parser (`src/lib/gmail/parsers.ts`)

- **Marketing filter**: Skip emails with `unsubscribe|newsletter|win |competition|offer|savings|discount|% off|promo` in the SUBJECT (not body). Trainline's email footer has "unsubscribe" in the body — checking the body would kill real bookings.
- **Forwarded email detection**: When no SENDER_CONFIG matches, check the email BODY for known provider names ("trainline", "easyjet", etc.) AND booking-like content (HH:MM times, "booking ref", "e-ticket", etc.). This catches forwarded confirmation emails.
- **HTML-only emails**: iPhone forwards often have only `text/html` and no `text/plain` MIME part. When there's no plain text, strip HTML tags to produce text for regex parsing. Without this, the parser receives empty text and fails silently.
- **Trainline eticket format**: Two emails per booking (eticket + booking confirmation). The eticket is the richer source:
  - Body text: "Adult 1, WEL to LEI: TTBQEBVV49M" patterns give station codes + ticket refs + outbound/return split
  - PDF attachments (one per leg): departure/arrival times, operator, ticket type, route restriction, price, NRS booking ref, coach/seat
  - PDF images: Aztec barcode decoded via unpdf extractImages + zxing-wasm → full RSP barcode payload for ticket regeneration
  - Booking confirmation subject: departure times in "(DD Month at HH:MM - DD Month at HH:MM)" pattern
  - Marketing filter: no-reply@comms.trainline.com + "Open this email for tickets" → skip
  - Deduplication: booking confirmation preferred over eticket for same-date Trainline bookings
- **Price extraction**: Trainline SAS footer contains "capital of 118 513.94 Euros" — `findTrainlinePrice` strips text after "Terms and Conditions" before searching
- **PDF library**: Use `unpdf` (pure JS) NOT `pdf-parse` (native modules crash on Vercel serverless)
- **Barcode decoding**: `zxing-wasm/reader` with `{formats: ["Aztec"]}` — pass plain `{data, width, height}` object, NOT `ImageData` constructor (unavailable in Node.js)

### Scan Cache (`gmail_scanned_emails` table)

- Every scanned email is persisted with sender, subject, parsed data, and parse_failed flag
- Already-scanned messages are NOT re-fetched (saves Gmail API calls)
- EXCEPT parse_failed=true messages — these ARE retried on subsequent scans so parser improvements take effect
- Previously scanned but not-imported bookings are still shown to the user

## Transport Hub Search (`src/lib/actions/travel-profile.ts`)

### Station Search Ranking

The search MUST prioritize prefix matches over substring matches:

1. Exact code match first (e.g. "WLB" → Wellingborough)
2. Name prefix match (e.g. "Wel" → Wellingborough)
3. Substring fallback ONLY when prefix returns < 3 results AND query is >= 3 chars

Without this, typing "wel" returns "Abbey Well" above "Wellingborough".

### Debounce

The TransportHubPicker debounce is 350ms (not 200ms). The 11k+ hub table with ilike queries needs the extra pause to avoid hammering the server.

## Canonical surface (Edition III P0, 2026-06-14)

The product is being driven to a finished Edition III per **`docs/edition-iii-build-plan.md`** (the
phase-by-phase tracker — drive it with "push") against **`docs/edition-iii-master.md`** (the spec),
maximising each API per **`docs/edition-iii-api-capability-map.md`** and taking each entity to full
depth per **`docs/edition-iii-entity-catalogue.md`**.

**The entity-depth rule:** for every entry type (flight, hotel, car hire, parking, dining…), service
the travel-day need so completely the **operator's own app becomes redundant** — never open the Virgin
app for the flight or the Hilton app for the stay. Operate everything; refer only the purchase;
reproduce legitimately-held credentials (the barcode rule), and be honest about what's locked. An
entity is **not "handled" until it meets its catalogue depth** — capture _flowing_ ≠ the entity
_serviced_ (the P2 accommodation card is a thin placeholder; ED1 deepens it next).

- **`/plan/[id]` is the single canonical itinerary surface AND the intake** (threaded spine +
  door-to-door JourneyMap + home-as-base + the full add/import toolkit). A new day is created blank
  via `PlanCreate` (`createEvent`) and opens straight here — there is no separate brief step.
- The **legacy `/itineraries/[id]` editor AND the Brief form `/itineraries/new` are retired** — both
  redirect (`[id]`→`/plan/[id]`, `new`→`/plan`); `itinerary-editor.tsx` + `new-itinerary-form.tsx`
  stay **dormant** in the tree. Don't add features there — add to the plan.
- **Orphans redirect** to canonical: `/dashboard`→`/today`, `/bookings`→`/wallet`,
  `/itineraries`(list)→`/plan`, `/itineraries/new`→`/plan`, `/flights`→`/plan`, `/compare`→`/plan`,
  `/capture`(+`/drafts`)→`/plan`. Originals dormant, not deleted.
- The **JourneyMap** is built from stops+transitions by the shared `journey-map/from-stops.ts`
  (`buildJourneyFromStops`), rendered on `/plan/[id]` via the client wrapper `plan/plan-map.tsx`.
- Home (`start`/`end` stops) renders as a **base** card via `isBase` on `SpineNode`, never an anchor.

### One unified day — no Mode toggle (Edition III P1, D1)

- **There is no work/personal toggle.** The day is one blended view. `ModeSwitchControl` is retired
  from the shell; `switchMode`/`getActiveMode`/`mode-switch-control.tsx` are **dormant** — do not
  re-mount them. Do **not** add `.eq("mode", activeMode)` view-filters; that was the lens we removed.
- `ctx.activeMode` is now the user's **primary mode**, derived from the default workspace's type in
  `requireUserContext` (organisation → work, else personal). It is used **only** as the default tag
  on new items and the Clients↔People nav variant — never as a visibility filter.
- Work/personal is a **per-item tag** (`app_mode`), shown via `ModeTag` (`.cc-mode-tag`) and flipped
  in context via `PlanModeFlip` → `setItineraryMode`. The **privacy boundary stays in the data layer**
  (RLS `can_access_itinerary`); removing the app filters did not weaken it — personal stays invisible
  to the workspace.

## Brief Page Structure (`/itineraries/new`)

### Layout (top to bottom)

1. Base location card (home/office, with address)
2. Trip dates (start/end — defaults booking dates)
3. Bookings bar: `+ Transport`, `+ Accommodation`, `Import from Gmail`
4. Confirmed reservations (condensed chips with Edit/Remove/+ Return)
5. Active booking forms (not yet confirmed)
6. Timeline: anchors with AddBetween inline, transition rows
7. Transport booking markers (read-only, from confirmed bookings)
8. Accommodation constraint markers (dashed, check-in-from)
9. Be home by toggle
10. Notes + title override
11. Build my day button
12. Spine preview (right column)

### Transport Booking Card

- Starts compact (mode picker only)
- Expands on mode selection: date, from/to station hub pickers, depart/arrive times, changeovers, service number, booking ref, seat, price
- "Done" button confirms → condenses to reservation chip
- "+ Return" on confirmed chips creates a new card with stations swapped, date defaulting to trip end
- Changeover support: "+ Add changeover" for train/flight/tube

### Accommodation Booking Card

- Check-in from / Check-out by (constraint language, not "check-in date")
- Includes time fields (defaults 15:00 / 11:00)
- Hotel picker, provider, ref, price, room

### Booking Card Lifecycle

Cards only condense when the user clicks "Done" (sets `confirmed: true`). Picking a station or filling a field does NOT auto-collapse. The user explicitly confirms. "Edit" on a chip re-expands the card.

## Server Action: createItineraryFromBrief (`src/lib/actions/itineraries.ts`)

### Stop Ordering

All stops (home, anchors, transport booking departure/arrival/changeover, accommodation, be-home-by) are sorted chronologically by `start_time` before being inserted. Home stays first, be-home-by stays last.

### Transitions

After all stops are inserted, transitions are created for ALL adjacent stop pairs (not just user-specified anchor pairs). Transport booking legs (departure → changeover → arrival) get `is_locked = true`.

### Hub Coordinates

Transport booking stops store `transport_hub_id`. The `transport_hubs` table has `latitude`/`longitude` columns (migration 0019). The `pickPoint()` function in `src/lib/actions/transitions.ts` checks transport_hub coordinates alongside location and customer_site coordinates.

### Solver

`resolveItineraryTimes()` is called at the end of `createItineraryFromBrief()`. The solver propagates times from anchored stops through transitions, computing departure times for unfixed stops.

## UK Rail Network (OSM-seeded)

### How it works

The entire UK rail network (~643k edges) is stored in `rail_network_edges` (migration 0025). Seeded once from the user's browser via `/settings/rail-network` (Overpass blocks Vercel IPs, so the browser makes the Overpass calls). Admin-only page (requires `is_admin = true` on profiles).

### Routing: Dijkstra, not BFS

`routeRailPath()` in `src/lib/actions/rail-network.ts` uses Dijkstra with haversine edge weights. BFS (node-count shortest) was tried and failed — it preferred routes with fewer nodes even when geographically longer (e.g., via Beeston instead of direct to Derby at Trent Junction).

### Endpoint handling

Rail polylines end at the nearest rail node to the station, NOT at the station entrance coordinates. Snapping to entrance coordinates caused visible zigzags at close zoom because entrances are offset from the track.

### Caching

Two-tier: `rail_route_cache` (L1, by CRS code pair) → `routeRailPath` BFS (L2, from `rail_network_edges`). Results cached after first computation.

### Pipe characters in polylines

Google's encoded polyline format can produce `|` characters. Google Static Maps uses `|` as a path parameter delimiter. The `buildStaticMapUrl` function in `src/lib/google/maps.ts` uses `encodeURIComponent` on the polyline and manually appends path params (NOT `URLSearchParams`, which double-encodes `%7C`).

## Admin Role

`is_admin` boolean on `profiles` table (migration 0026). Separate from `is_staff`:

- **Staff**: demo mode, palette picker, feature testing
- **Admin**: system tools (rail network seeding, data management)

`requireUserContext()` returns `isAdmin` alongside `isStaff`. Admin pages redirect non-admins. Admin server actions reject non-admins.

## JourneyMap (MapLibre)

### Architecture

`src/components/journey-map/` — interactive map replacing Google Static Maps (RouteMap).

- **MapLibre GL JS** with OSM raster tiles (basemap, desaturated + warm-tinted)
- **GeoJSON layers** for journey lines (rail solid gold + glow, walk dashed, road solid hairline)
- **maplibregl.Marker** for station markers (bullseye origin, gold disc destination, ringed intermediate)
- Zero SVG — everything renders in MapLibre's WebGL/HTML pipeline, zero lag on pan/zoom

### Themes

Three themes: `dusk` (warm cream, default), `midnight` (dark), `sahara` (daylight ochre). Theme drives basemap raster paint (saturation, brightness) and overlay colours. Theme files in `src/components/journey-map/themes/`.

### Tile source

Currently OSM raster tiles (always available, no API key). Upgrade path: Protomaps or MapTiler vector tiles for full brand control (custom layer colours, hidden POIs). Requires an API key.

### Next steps

- Calling points: parse intermediate stops from Trainline PDFs, render as small waypoint markers on the rail leg
- Planning-page transport booking: polyline + duration should work when adding transport during planning (not just from brief)
- Day-of mode: live position dot, adaptive zoom — component API supports it, just needs wiring

## Key File Map

| File                                                      | Purpose                                                   |
| --------------------------------------------------------- | --------------------------------------------------------- |
| `src/app/(app)/itineraries/new/new-itinerary-form.tsx`    | Brief page form (all state + render)                      |
| `src/app/(app)/itineraries/new/page.tsx`                  | Brief page server component (data loading)                |
| `src/app/(app)/itineraries/[id]/itinerary-editor.tsx`     | Planning page                                             |
| `src/components/itinerary/transport-booking-card.tsx`     | Transport booking card component + types                  |
| `src/components/itinerary/accommodation-booking-card.tsx` | Accommodation booking card + types                        |
| `src/components/itinerary/transition-row.tsx`             | Travel mode picker between stops                          |
| `src/components/itinerary/journey-spine.tsx`              | Spine preview (chronological timeline)                    |
| `src/components/itinerary/types.ts`                       | Shared types (Anchor, BriefTransition, etc.)              |
| `src/components/itinerary/helpers.ts`                     | Empty factories, sort, timing helpers                     |
| `src/components/transport-hub-picker.tsx`                 | Station/airport autocomplete                              |
| `src/lib/actions/itineraries.ts`                          | createItineraryFromBrief + solver                         |
| `src/lib/actions/gmail.ts`                                | Gmail scan + import                                       |
| `src/lib/gmail/parsers.ts`                                | Email HTML parsers (Trainline, airlines, hotels)          |
| `src/lib/gmail/types.ts`                                  | ParsedBooking types                                       |
| `src/lib/actions/transitions.ts`                          | Route previews, pickPoint, transition CRUD                |
| `src/lib/actions/travel-profile.ts`                       | Hub search (searchTransportHubs)                          |
| `src/lib/itinerary/solver.ts`                             | Time propagation solver                                   |
| `src/lib/osm/rail-routes.ts`                              | getRailPolyline: cache check → BFS route → cache result   |
| `src/lib/actions/rail-network.ts`                         | seedRailEdges, routeRailPath (Dijkstra), clearRailNetwork |
| `src/components/journey-map/journey-map.tsx`              | JourneyMap component (MapLibre + GeoJSON layers)          |
| `src/components/journey-map/map-style/build-map-style.ts` | Theme → MapLibre style JSON                               |
| `src/components/journey-map/themes/`                      | dusk, midnight, sahara theme definitions                  |
| `src/app/(app)/settings/rail-network/`                    | Admin page for seeding UK rail network                    |
| `scripts/backfill-rail-polylines.mjs`                     | CLI alternative for seeding (requires terminal)           |

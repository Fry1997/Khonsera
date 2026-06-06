# CLAUDE.md — Institutional Knowledge for Khonsera

**Every session must read this before making changes. Update it before ending.**

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

### Planning engine — Phase 1 foundation (see `docs/planning-engine.md`)
The four load-bearing prerequisites from the planning-view wiring brief, as pure
unit-tested modules in `src/lib/planning/` (decoupled from the live editor — the
new planning view will call them via `getPlanningViewData`):
- `buffers.ts` — mode-specific connection buffers (train ~8, flight ~90, flexible 0),
  replacing the flat 10-min assumption. `feasibility/check.ts` takes an optional
  `boardingMode` to derive the slack target; existing callers (no mode) unchanged.
- `door-to-door.ts` — composes first-mile + main + last-mile into one total and
  ranks on **speed** (not cost-first like `ranking.ts`), per the brief.
- `exclusions.ts` — hard-filter pass (journey `excluded_modes`, taxi fare cap,
  walk threshold) + `readStandingConstraints` (home_by/wake_after). `preferred_mode`
  is a ranking hint, NOT a filter.
- `insert.ts` + `createStopAtTime` (actions/stops.ts) — insert-fact-by-time:
  slot by `start_time`, scoped recompute of the two adjacent transitions. Does NOT
  pre-commit a default mode on the new gaps (mode picker owns that).
- Migration `0030_itinerary_excluded_modes.sql` adds `itineraries.excluded_modes`
  — applied to the remote Supabase project (2026-06-05).

### Planning engine — Phase 2 (strategy + rail booking; see `docs/planning-engine.md`)
- `strategy.ts` — trip-level rail/drive/mixed via `evaluateStrategies` (built on
  `rankDoorToDoor`); top 2 + templated pros. Server action `setTravelStrategy`
  (actions/planning.ts) persists the choice; full leg rebuild deferred to UI-mount.
- `rail-candidates.ts` — `deriveOutbound`/`deriveReturn` compute leave-home /
  on-site / leave-appointment / arrive-home from a timetable candidate + buffers;
  `pairFare` is the ~20%-off-peak return heuristic (pence). Server action
  `getRailCandidatesForGap` wires `integrations/rail.ts` (demo data until live).
- Pairing (P2.7): `booking_intents.paired_booking_id` + `linkPairedBookings`
  (actions/bookings.ts) cross-link outbound + return.
- Migration `0031_travel_strategy_and_pairing.sql` (travel_strategy + paired_booking_id)
  — applied to the remote Supabase project (2026-06-05).

### Planning engine — Phase 3 (three-variable appointment; see `docs/planning-engine.md`)
- `appointment.ts` — `resolveAppointment` resolves any two of {arrive, duration,
  leave} → the third; mode (fixed/window/maximise/partial) EMERGES from what's set.
  Each value carries a `source` for attribution. `appointmentMicrocopy` +
  `arriveAttribution` render the voice lines ("set by your 07:13 train"). Pure, tz in.
- Server action `setAppointmentTiming` (actions/planning.ts) merges + resolves +
  persists the three jsonb columns AND projects onto canonical
  start_time/end_time/duration_minutes/is_time_fixed (the solver's fields).
  `stops` had no `timing_mode` to replace — this is purely additive.
- Migration `0032_appointment_value_objects.sql` (stops.arrive_value/duration_value/
  leave_value jsonb) — applied to the remote Supabase project (2026-06-05).

### Planning engine — Phase 4 (surface + gap detection; see `docs/planning-engine.md`)
No migration — all derived from existing state. Pure cores + read actions:
- `trip-needs.ts` — `deriveTripNeeds` → ordered THIS-TRIP-NEEDS list (set_duration,
  book_taxi/rail/hotel, email_contact/confirm_booking) with tz-aware `when` labels.
  Server action `getTripNeeds` (actions/planning.ts) classifies + queries.
- `summary.ts` — `computeItinerarySummary` → stop_count/distance/duration/cost +
  per-category breakdown. Server action `getItinerarySummary` also returns
  `essentialsRemaining` (booking_intents not booked) for the LifecycleBand.
- `booking-lifecycle.ts` — `lifecycleState` (status enum → Proposed/Booked/…,
  opened_partner stays Proposed in Stage 0), `uberDeeplink`/`trainlineDeeplink`
  builders, `essentialsRemaining`.

### Planning engine — Phase 5 (UI mount; see `docs/planning-engine.md`)
The new planning view **replaced `itinerary-editor.tsx`** at `/itineraries/[id]`.
- `planning-data.ts` (`getPlanningViewData`, server-only) composes real stops +
  transitions into an ordered, time-formatted SPINE (stop nodes + the legs
  between them) and folds in the Phase 1–4 contracts (summary, trip-needs,
  resolved appointment + microcopy, lifecycle). Client renders it dumbly.
- `planning-view.tsx` (`"use client"`) — LifecycleBand, TripHeader+summary,
  JourneyMode strategy chip, the spine (gold/diamond/plain/home nodes; flex legs
  = equal-weight mode picker, locked rail = booked card), ThisTripNeeds, Digest.
  Interactions dispatch existing/Phase-2–4 actions (`setTransitionMode`/
  `upsertTransition`, `setTravelStrategy`, `setAppointmentTiming`) + `router.refresh`.
- `planning-add-sheet.tsx` (`AddSheet`) — the consolidated "+" affordance. The
  TripHeader "+" opens a modal that re-mounts the preserved forms: `add-stop-form`
  (→ `createStop`), `add-transport-booking-form`, `add-accommodation-booking-form`,
  `gmail-import-panel`. Picker data (customers/sites/locations/contacts + gmail
  status) is loaded in `page.tsx` and passed as `pickers`. Keep these four form
  files — they ARE the booking/Gmail-import UI, now mounted here.
- Parity restored (don't re-strip): booked train legs render the shared
  `components/train-ticket-card.tsx` (`TrainTicketCard`) with stations, ticket
  type, route, operator, price, Aztec barcode (`/api/barcode`) — `planning-data`
  builds its `TicketSegment` from the departure stop's `metadata`. Cost in the
  summary sums `expense_records` AND `stops.metadata.price` (Gmail-imported fares
  live there). Distance falls back to `polylineMiles(overview_polyline)` (decoded
  via journey-map's `decodePolyline` + `haversineMeters`) since rail legs carry no
  `distance_miles`. Appointment times fall back to `start_time`/`end_time` +
  legacy `metadata.timing_mode` ('maximize') when the Phase-3 value-objects are
  null. Mode pickers are equal-weight inline chips (not collapsed). `getTripNeeds`
  treats a leg as booked when its departure stop has a `booking_reference`/
  `barcode_ref` (and dedupes a changeover journey to one need), and an appointment
  as timed when it has `end_time` or `timing_mode`.
- `paired-rail-card.tsx` (`PairedRailCard`) — wires `getRailCandidatesForGap`.
  `planning-data` derives a `railPair` (outbound/return station pairs around the
  focal appointment + CRS codes); the card fetches candidates, steps them
  (chevrons), shows the on-site consequence band + `pairFare`, and a Stage-0
  `trainlineDeeplink` "Book pair" button. Honest "timetable not connected" state
  when the rail provider is in `unavailable` mode. `pairFare`/`trainlineDeeplink`/
  `formatTimeInTz` are pure → imported client-side.
- NOT yet ported from the prototype: split/separated/echo rail layouts, taxi
  live-day lifecycle states, the disruption banner. Stepping the rail card does
  NOT yet persist the chosen candidate back to transitions (Stage 0 = deeplink +
  manual mark-booked); committing a stepped pair is the next rail increment.

## Design Principles

### One Toolkit, Two Views
The brief (`/itineraries/new`) and planning (`/itineraries/[id]`) share the same edit capabilities. Planning adds visual/mapping on top but never withholds a tool the brief offers, and the brief never withholds a tool planning has. If you add a feature to one page, it must exist on the other.

### Bookings Are Facts, Stops Are Events
- **Transport bookings** (train tickets) create timeline events (departure + arrival stops)
- **Accommodation bookings** are constraints (check-in-from, check-out-by), NOT fixed journey points. The user places hotel visit stops on the timeline as needed.
- One way to add booked transport. One way to add accommodation. Same pattern on both pages.

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

## Brief Page Structure (`/itineraries/new`)

> **DORMANT (2026-06-06).** "New itinerary" no longer opens the brief. Every
> "New itinerary/trip" button is now `<NewItineraryButton>` (a form posting to
> the `createDraftItinerary` server action), which creates an UNCOMMITTED trip
> and redirects straight to the planning view (`/itineraries/[id]`). The brief
> page still exists at `/itineraries/new` but nothing links to it — kept for
> reference / possible reuse, not deleted. Use a server action + redirect (not a
> side-effecting GET page) so Link prefetch can't spawn phantom trips.
>
> **Uncommitted-draft model:** `createDraftItinerary` makes the trip `status =
> 'draft'` dated **tomorrow** (planning is for the future), and first sweeps the
> user's earlier untouched drafts (abandoned ones cascade away). `'draft'` is
> hidden from EVERY trip list (itineraries list, dashboard count/lists/calendar,
> bookings redirect). The trip is promoted to `'planning'` (and appears in lists)
> on the user's FIRST content change: `resolveItineraryTimes` (called after every
> stop/transition/appointment/strategy edit) and `updateItinerary` (date/title
> edit) both promote `draft → planning`. Status changes MUST go through the
> `itinerary_transition` RPC (`transitionItinerary`) — a DB trigger
> (`block_direct_status_update`, 0010) forbids direct status writes — so both
> sites guard on `status === 'draft'` then call the RPC, never a raw update.
> Migration `0033` re-added the `draft→planning`/`draft→cancelled` edges that
> 0013 had deleted (0013 retired draft); without them the RPC rejects the
> promotion. Home-stop seeding in `[id]/page.tsx` is a direct INSERT (inserts
> aren't trigger-blocked, no `resolveItineraryTimes`), so it does NOT promote.
> Net: "New itinerary → touch nothing → back out" leaves nothing in any list.
> The JourneyMode rail/drive chip is hidden until the spine has a leg — don't
> ask "train or car?" before a destination exists.
>
> **Editable dates:** the planning TripHeader date is tappable (`HeaderDates`) →
> start/end `<input type=date>` → `updateItinerary` (which also promotes the
> draft). `planning-data` exposes `header.dateLabel` + `header.routeLabel` split
> so the date can be edited without the route text.

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

| File | Purpose |
|------|---------|
| `src/app/(app)/itineraries/new/new-itinerary-form.tsx` | Brief page form (all state + render) |
| `src/app/(app)/itineraries/new/page.tsx` | Brief page server component (data loading) |
| `src/app/(app)/itineraries/[id]/page.tsx` | Planning page server entry (seeds home stop, calls getPlanningViewData) |
| `src/app/(app)/itineraries/[id]/planning-data.ts` | getPlanningViewData — composes stops/transitions + Phase 1–4 contracts into the view model |
| `src/app/(app)/itineraries/[id]/planning-view.tsx` | PlanningView — the new planning screen (replaced itinerary-editor.tsx) |
| `src/components/itinerary/transport-booking-card.tsx` | Transport booking card component + types |
| `src/components/itinerary/accommodation-booking-card.tsx` | Accommodation booking card + types |
| `src/components/itinerary/transition-row.tsx` | Travel mode picker between stops |
| `src/components/itinerary/journey-spine.tsx` | Spine preview (chronological timeline) |
| `src/components/itinerary/types.ts` | Shared types (Anchor, BriefTransition, etc.) |
| `src/components/itinerary/helpers.ts` | Empty factories, sort, timing helpers |
| `src/components/transport-hub-picker.tsx` | Station/airport autocomplete |
| `src/lib/actions/itineraries.ts` | createItineraryFromBrief + solver |
| `src/lib/actions/gmail.ts` | Gmail scan + import |
| `src/lib/gmail/parsers.ts` | Email HTML parsers (Trainline, airlines, hotels) |
| `src/lib/gmail/types.ts` | ParsedBooking types |
| `src/lib/actions/transitions.ts` | Route previews, pickPoint, transition CRUD |
| `src/lib/actions/travel-profile.ts` | Hub search (searchTransportHubs) |
| `src/lib/itinerary/solver.ts` | Time propagation solver |
| `src/lib/osm/rail-routes.ts` | getRailPolyline: cache check → BFS route → cache result |
| `src/lib/actions/rail-network.ts` | seedRailEdges, routeRailPath (Dijkstra), clearRailNetwork |
| `src/components/journey-map/journey-map.tsx` | JourneyMap component (MapLibre + GeoJSON layers) |
| `src/components/journey-map/map-style/build-map-style.ts` | Theme → MapLibre style JSON |
| `src/components/journey-map/themes/` | dusk, midnight, sahara theme definitions |
| `src/app/(app)/settings/rail-network/` | Admin page for seeding UK rail network |
| `scripts/backfill-rail-polylines.mjs` | CLI alternative for seeding (requires terminal) |

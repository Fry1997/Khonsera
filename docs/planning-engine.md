# Planning Engine — Phases 1 & 2

Last updated: 2026-06-05

This documents the four load-bearing engine prerequisites from the Planning
View wiring brief (Phase 1). They are the foundation the new planning view sits
on. All four are **pure, unit-tested modules** under `src/lib/planning/` plus
one server action and one migration. None of them are wired into the live UI
yet — they are the substrate the later phases consume.

> The `planning/*` modules are intentionally decoupled from the current editor.
> The live per-leg feasibility flag in the editor still comes from
> `src/lib/feasibility/check.ts`; these modules extend the engine the new
> planning view will call through `getPlanningViewData`.

## P1.2 — Mode-specific connection buffers · `planning/buffers.ts`

Replaces the flat 10-minute interchange assumption. A buffer is the time a mode
costs you *at the connection* — the margin before a fixed departure.

- `BOARDING_BUFFER_MINUTES` — margin before boarding a scheduled service coming
  off a flexible first-/last-mile leg. Calibrated: train ~8, flight ~90,
  bus/tube ~5, flexible modes 0.
- `INTERCHANGE_BUFFER_MINUTES` — margin when changing between two scheduled
  services at one hub.
- `connectionBufferMinutes(fromMode, toMode)` — the buffer to insert between two
  adjacent legs: boarding buffer off a flexible leg into a scheduled one,
  interchange buffer between two scheduled ones, 0 arriving into a flexible mode.

Wired into `feasibility/check.ts`: `checkLegFeasibility` now takes an optional
`boardingMode`, which derives the slack target from the mode being caught when
no explicit `bufferMinutes` is given. Existing callers (no mode) are unchanged —
they still get the legacy flat 10.

## P1.1 — Composite door-to-door ranking · `planning/door-to-door.ts`

Composes first-mile + main + last-mile sub-legs into one rankable total.

- `composeDoorToDoor(journey)` — sums leg durations + the connection buffers
  between adjacent legs, and sums known leg costs (null when no leg carried a
  cost, so the ranker treats it as unknown, not free).
- `rankDoorToDoor(journeys, preference)` — ranks the composed totals. Unlike
  `ranking.ts` `rankOptions` (which breaks ties on cost first), door-to-door
  ranking sorts on **speed**, per the brief's core rule: feasibility tier →
  preferred-mode hint → door-to-door duration → cost as final tiebreak.
- `recommendedDoorToDoor` — the top-ranked journey (the engine's default pick).

## P1.4 — Profile + journey-level exclusions · `planning/exclusions.ts`

The user steers by *removing* options, not scoring them.

- `applyExclusions(options, ctx)` — hard-filter pass run before ranking. Drops:
  journey-level excluded modes (`itineraries.excluded_modes`), taxi options over
  `travel_profile.max_taxi_fare_pence`, and walks over
  `travel_profile.walking_threshold_minutes`. Returns `{ kept, dropped }` with a
  reason per drop so "show all" can explain why. `preferred_mode` is **not** a
  filter here — it's a ranking hint, never hides a faster option.
- `readStandingConstraints(facts)` — extracts hard time constraints (`home_by`,
  `wake_after`) out of `standing_facts` rows into a shape the feasibility engine
  consumes as latest-return / earliest-depart bounds.

Migration `0030_itinerary_excluded_modes.sql` adds `itineraries.excluded_modes
text[] not null default '{}'` (the per-journey exclusion list). **Not yet
applied to the remote Supabase project** — the migration file is committed; run
it against `attbfwemjoslugvtfbrt` before any UI reads/writes the column.

## P1.3 — Insert-fact-by-time · `planning/insert.ts` + `createStopAtTime`

Replaces `max(sequence)+1` append with time-ordered insertion.

- `planInsertionByTime(stops, newStartTime)` (pure) — finds the sequence slot by
  `start_time`: the new fact goes immediately before the first stop that starts
  strictly after it. Names the two neighbours (`beforeStopId`/`afterStopId`)
  whose adjacency changed, so the caller can scope its recompute. Assumes a
  well-formed chain (sequence order == time order, which the solver maintains).
- `createStopAtTime` (server action, `actions/stops.ts`) — shifts later stops up
  by one, inserts the new stop at the time-ordered slot, drops the now-spurious
  bridging transition between the two neighbours, then re-solves times. It
  deliberately does **not** auto-create the two new adjacent transitions with a
  default mode — the brief is explicit that gaps stay open for the equal-weight
  mode picker rather than pre-committing a mode.

---

## Phase 2 — Strategy and rail booking

Same shape as Phase 1: pure tested cores + thin server actions + one migration.
Migration `0031_travel_strategy_and_pairing.sql` adds `itineraries.travel_strategy`
(text, `rail|drive|mixed`, null = undecided) and `booking_intents.paired_booking_id`
(self-ref, links outbound + return). **Not yet applied to the remote Supabase
project** — committed only.

### P2.5 — Trip-level travel strategy · `planning/strategy.ts`

The JourneyMode chip's engine. Each strategy is a composed door-to-door journey
(reusing P1.1), so the trip-level choice ranks on the same speed-first rule.

- `evaluateStrategies(journeys, preference, limit=2)` — ranks via `rankDoorToDoor`,
  returns the top N as `StrategySummary` (`totalDurationMinutes`, `totalCostEstimate`,
  `recommended`, templated `pros`). Pros are static phrasing per strategy in v1
  ("Work on the way" for rail, "Door-to-door" for drive) — the brief is explicit
  these can be fixed strings.
- `recommendedStrategy(journeys, preference)` — the single engine pick, used to
  seed `travel_strategy` when the user hasn't chosen.
- Server action `setTravelStrategy` (`actions/planning.ts`) persists the choice +
  re-solves times. The full leg rebuild (collapse rail spine ↔ single drive leg)
  is deferred to UI-mount — it needs the composed journeys wired through
  `getPlanningViewData`.

### P2.6 — Rail candidates · `planning/rail-candidates.ts`

Turns a raw timetable candidate into its door-to-door consequences, folding in
the P1.2 buffers (board ~8 min early, `STATION_DWELL_MINUTES` ~5 each end).

- `deriveOutbound(c, timing)` → adds `leaveHome` (dep − first-mile − board −
  station entry) and `onSiteStart` (arr + station exit + last-mile + venue margin).
- `deriveReturn(c, timing)` → adds `leaveAppointmentBy` and `arriveHome`.
- `pairFare(outbound, return)` — v1 heuristic: an off-peak, same-operator pair is
  ~20% cheaper than two singles; a peak or split-operator pair is shown honestly
  as two singles (zero saving). Operator = alpha prefix of the first service
  number; unknown operators don't disqualify. All amounts in pence.
- Server action `getRailCandidatesForGap` (`actions/planning.ts`) resolves the two
  station stops, calls `integrations/rail.ts` (`findRailJourneys` — demo data until
  a live timetable is wired), computes `peak` in the workspace tz, converts provider
  pounds → pence, and runs the outbound/return derivation. First-/last-mile minutes
  come in from the UI's routing previews (default 0).

### P2.7 — Pair booking model · `actions/bookings.ts`

`createBookingIntent` accepts `paired_booking_id`; `linkPairedBookings(outbound, return)`
cross-links two intents (each points at the other) after verifying both are in the
workspace. `ON DELETE SET NULL` so dropping one leg doesn't cascade the other.

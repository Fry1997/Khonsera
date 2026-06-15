# Khonsera — Edition III Build Plan

**The single, durable, phase-by-phase roadmap from where the code is today to a finished
Edition III product.** This is the canonical build tracker. The product spec it implements is
[`docs/edition-iii-master.md`](./edition-iii-master.md).

## How to use this document

The founder drives the build by saying **"push"** (or "continue"). On each push:

1. Open this file, find the **first phase whose checkbox is unticked**, and execute it end to end.
2. Honour the **Definition of Done** (below) — build green, tests green, commit + push.
3. Tick the phase's task boxes, append a line to the **Progress Log**, and stop.

One push ≈ one phase. If a phase proves too large for a single working session, complete its
sub-tasks across pushes (tick them as they land) — the phase is done when all its boxes are ticked
and its *Done-when* holds. Phases are ordered by dependency; do not skip ahead without a reason
logged in the Progress Log.

## Definition of Done (every phase, no exceptions)

- `npx tsc --noEmit` clean · `npx next build` compiles · `npx vitest run` green.
- **Tokens only**, never raw `#hex`/`px` (the iron rule). **No emojis, ever.** Assistant copy is
  voiced as **Khonsera** (never a human name).
- Any new **external-API** capability is built behind a **provider interface with a mock**; the real
  adapter is **env-gated** and the build NEVER blocks on a key (the "booking is the one stub"
  doctrine, generalised — see Standing Rules).
- **Persistence survives refresh/navigation**; **personal-mode data never leaves the RLS boundary**.
- **Any phase that adds UI ships a Design handoff entry** in `docs/design-handoff-edition-iii.md`
  (component · where · states · data · what Design owns). Code authors functional + on-token +
  contract-named; **Design is the front-end team** and takes it to brand finish — Code never calls UI
  "done" in the visual sense.
- Commit + push to the working branch; tick this file's boxes; append to the Progress Log; update
  `CLAUDE.md` if institutional knowledge changed.
- State the user-visible increment plainly (what can a person now do that they couldn't before).
- **A phase is *complete*, not "partial".** Build every sub-task that is buildable now. The only
  legitimate reasons to leave a sub-task unbuilt are: (1) it depends on a *later* phase's machinery,
  (2) it depends on data / a key / an external we don't have, or (3) it's a large *distinct* feature
  that warrants its own phase. Each deferral carries an **explicit tag** naming what unblocks it
  (which phase / which data / which key) — never a vague "follow-on". If a phase is too big to be a
  completable unit, **re-scope it** (split the distinct features into their own phases) rather than
  ship it "partial".

## Standing rules (apply on every push)

- **Decide and proceed.** Make conventional implementation calls; log assumptions in `DECISIONS.md`.
  Pause only for: a genuine spec contradiction, or a data-loss/irreversible action.
- **Mocks before procurement.** Procurement-gated providers (Rail Data Marketplace/Darwin·RTT·RTJP,
  TfL, DragonPass, Collinson, Parkopedia/Arrive, Duffel, Booking.com, Airalo, Xero/QuickBooks) are
  each reached through a clean adapter seam with a deterministic mock. Real adapters drop in via env
  vars. See the Procurement table at the foot of this doc.
- **Max scope per API.** When a phase integrates a provider, build to its **full useful capability
  surface**, not a thin slice — the integration cost is paid once. Each API phase's Done includes
  ticking that provider's **Max scope** list in `docs/edition-iii-api-capability-map.md` (or logging
  why a capability is deferred and which phase claims it).
- **Entity depth — replace the operator's app.** For every entry type (flight, hotel, car hire,
  parking, dining, meeting…), the bar is: **service the travel-day need so completely the operator's
  own app becomes redundant** — no opening the Virgin app for the flight or the Hilton app for the
  stay. As each field is added, the test is "does leaving this out send the user elsewhere?" An entity
  is not "handled" until it meets its depth in `docs/edition-iii-entity-catalogue.md` (operate /
  refer-purchase / honest-limit marked for every row of its operator-app-replacement checklist).
  *Capture flowing ≠ the entity serviced* — thin cards (e.g. P2 accommodation) are placeholders with a
  depth phase behind them.
- **No mass rename.** Edition III's product vocabulary (Day/Commitment/AnchorCard/Place/Ticket/Note)
  is the *UX* language; the internal model names (`itineraries`/`stops`/`transitions`/`intentions`/
  `gaps`/`resource_states`/`tasks`) and the contract component names stay as-is. Map names in docs,
  do not churn the tree.
- **Tell/Ask stay benched.** Do not re-wire `src/lib/parser`, `src/lib/dictionary`,
  `src/components/capture`, or `plan-capture.tsx` into the surface. Free-text returns later as an
  LLM tier.
- **Amadeus self-service is dead (17 Jul 2026).** Build nothing new on it. Rail feeds go through the
  Rail Data Marketplace (REST, not legacy SOAP).

---

## Current-state snapshot (June 2026, verified by inventory)

**DONE (do not rebuild):** email parse + dedup (Trainline/airlines/hotels → structured cards);
manual add (appointment/place/transport with closed-set autocomplete); barcode decode (zxing) +
re-encode (bwip-js, on-device); core data model (`itineraries/stops/transitions/intentions/gaps/
resource_states/tasks`); **RLS personal/work boundary** (`can_access_itinerary`); back-calculation /
leave-by solver; buffer/feasibility logic; soft-vs-hard (locked) legs; owned nav stack (Valhalla +
Photon + turn-by-turn guidance + offline route cache + pmtiles); JourneyMap; Dijkstra rail routing;
**offline/PWA (barrier-grade)**; Wallet; Darwin live departure board (partial); identity
(profiles/workspaces/memberships/roles enum/`app_mode`); expenses + tasks + contacts basics.

**PARTIAL (finish in-plan):** calendar pull (read-only, no auto-import); notes (stop field only, no
prep/outcome); barcode round-trip not explicitly verified; true-door precision (centroid only);
buffer model not surfaced on the spine; Today state machine (4 states, no full disruption); Darwin
(no RTT, no TfL, no on-service tracking); live cascade (create-time only); mode toggle wired as a
*lens*; visit_plans exist without approvals UI; expenses without spend-vs-cap; mileage calc-only.

**MISSING (build):** readiness/preparation; first-class notes; recurrence expansion;
transition-pattern inference; commitment-aware guidance tone; TfL city mobility; decision-clock;
consequence translation; live knock-on cascade; fragility detection; on-service tracking; recovery
(L3); contextual-action engine (L4); connections framework (L5); two-tier sharing; RBAC enforcement;
approvals/caps/spend-vs-cap; mileage auto-detect; accounting; international FX/tz/eSIM; European rail;
rural orchestration.

---

## The phases

### Phase 0 — Coherence & the canonical surface  `[x]` DONE 2026-06-14
*Make it feel like one product, not three. This is the consolidation discussed before the plan.*
**Depends on:** nothing. **Do this first.**
- [x] Fix the `/plan/[id]` **home-as-base** bug: `start`/`end` stops now render as a fixed home base
      card (`isBase` on `SpineNode` + `.cc-base-node`), not an editable/removable anchor.
- [x] Make **`/plan`** the canonical itinerary surface. Brief's post-build redirect → `/plan/[id]`.
- [x] **Parity work:** ported the JourneyMap to `/plan/[id]` via a shared builder
      (`journey-map/from-stops.ts` + client `plan/plan-map.tsx`) so the canonical view is not a
      downgrade from the legacy editor (door-to-door map + spine + add + import + constraints).
- [x] **Redirect orphans** (reversible stubs, originals kept dormant): `/dashboard`→`/today`,
      `/bookings`→`/wallet`, `/itineraries`(list)→`/plan`, `/itineraries/[id]`→`/plan/[id]`,
      `/itineraries/[id]/timeline`→`/plan/[id]`, `/flights`→`/itineraries/new`. Lingering links
      (expenses row, week-calendar) repointed to `/plan/[id]`.
- [x] **Mobile nav**: added Navigate to the mobile overflow (Wallet was already there); desktop
      sidebar already carried both and none of the orphans.
**Done when:** one coherent navigation; no duplicate/orphan screens reachable; Brief → built plan
lands on `/plan/[id]` with home as a base. ✓

### Phase 1 — One unified day + privacy tag (Mode reconciliation)  `[x]` DONE 2026-06-14
*Edition III D1: there is no work/personal toggle — one blended day; the tag is a privacy boundary.*
**Depends on:** P0.
- [x] Removed the **Mode lens**: dropped `.eq("mode", activeMode)` from `/today`, `/plan`, `/tasks`,
      `/contacts`, wallet loader (+ dormant plan-capture). Retired `ModeSwitchControl` from the shell
      (sidebar + mobile appbar + the dead topbar); `switchMode`/`getActiveMode`/`mode-switch-control`
      now dormant.
- [x] **One timeline** with a quiet **work/personal tag**: new `ModeTag` (`.cc-mode-tag`) on the Plan
      list cards; stripped the "Work/Personal ·" eyebrow prefixes app-wide (the view is unified).
- [x] **`activeMode` reframed** from a cookie-toggle to the user's **primary mode** (derived from the
      default workspace's type in `requireUserContext`) — used only as the new-item default tag + the
      Clients↔People nav variant, never a lens.
- [x] **Flip in context**: `setItineraryMode` action + `PlanModeFlip` segmented control on `/plan/[id]`
      re-tags a whole day. RLS (`can_access_itinerary`) untouched → personal stays invisible upward.
- [ ] *Deferred (minor):* per-row tags on `/tasks` + `/contacts` (data now selects `mode`; needs
      TaskVM/ContactVM + row plumbing). Journey-list tag + flip cover the done-when.
**Done when:** a single unified day shows everything; work/personal reads as a tag; no toggle; RLS
boundary intact. ✓ Build green · 272 tests pass.

### Phase 2 — Capture completion (L0)  `[~]` mostly DONE 2026-06-14
**Depends on:** P0.
- [x] **Manual accommodation card** in `PlanAdd` — a "Stay" kind with hotel picker + check-in-from /
      check-out-by (constraint language); `addManualAnchor` gained an `accommodation` kind → an
      `accommodation` stop with the check-in/out window. (Ref/price/room are minor follow-ons.)
- [x] **Calendar import** as **confirmable proposals**: `googleListEvents` now captures `location`;
      `loadCalendarProposals` + `importCalendarEvents` (actions) + `PlanCalendarImport` panel on
      `/plan/[id]` list calendar events over the day, user ticks which land as appointments; the
      location string is geocoded by `addManualAnchor`'s address path. Nothing auto-inserts.
- [ ] **Barcode round-trip verification** — **DEFERRED (principled).** The pipeline stores zxing's
      `.text`, not raw `.bytes`; there's no raster decoder in deps to read a bwip-js re-encode back;
      and a blind verify-gate could **reject working tickets** without real RSP-6 data to validate
      against. The core integrity principle already holds (decoded payload stored **verbatim** and
      re-encoded as-is, never rebuilt from fields). Real verification needs: capture `.bytes`, add a
      raster decoder, and validate against real tickets + a gate — a dedicated task, not a blind gate.
**Done when:** the four capture methods (email, manual, calendar, barcode) produce confirmable
structured cards. ✓ for email/manual/calendar; barcode capture works, byte-identity *verification*
deferred. Build green · 272 tests pass.

### Phase 3 — Notes as a first-class entity  `[x]` DONE 2026-06-14
*Research-first (new entity): `docs/research/notes.md` → catalogue §6b.*
**Depends on:** P0.
- [x] `notes` + `note_attachments` tables (migration 0034, applied + advisor-verified), attachable to
      a **commitment (`stop_id`) or day (`itinerary_id`)**, `kind` = prep|outcome, markdown body +
      jsonb `checklist`/`action_items` + `source`/`template_key`/`transcript` (voice/templates
      designed-in, shipped later). Owner-scoped actions in `notes.ts`.
- [x] Prep + outcome notes surface **on the commitment** via `NotesPanel` on the plan spine (add/edit/
      delete, kind toggle, prep/outcome prompts).
- [x] **Org-review boundary in RLS** (one line): a workspace member reads a note only when
      `work` + `outcome` + `org_reviewable`; personal and all prep notes are owner-only. Defended in
      the action too (personal can't be made reviewable). Security advisor: clean on both new tables.
**Done when:** a commitment carries prep + outcome notes; work outcome notes are visible to the
workspace, personal notes are not. ✓ Build green · 272 tests pass.

### Phase 4 — Readiness check (the heart of preparation, B3.3)  `[x]` DONE 2026-06-14
*Research-first (new entity): `docs/research/readiness.md` → catalogue §6c. Derived, not stored.*
**Depends on:** P2, P3.
- [x] A **derived per-day checklist** from a rules engine (`src/lib/readiness/engine.ts`,
      `buildDaySummary` → `evaluateReadiness`, pure + unit-tested ×4): tickets (unbooked
      public-transport legs), bookings (uncovered nights, destination parking), documents (flight ID;
      international passport → IATA deep-link), devices (charge/adapter), international (eSIM/currency
      via UK-bbox heuristic), multiday (pack-shape). `readiness_state` (migration 0035, **owner-only**
      RLS — readiness is private prep) holds only the tick/dismiss/snooze overlay.
- [x] Each gap is **actionable**: `link` out, `task` (drop a reminder — wired via createTask now), or
      `book` (mocked until L5; auto-satisfies on book). `ReadinessPanel` on `/plan/[id]` — calm by
      default ("You're set"), grouped by category, tick/dismiss.
**Done when:** opening a day produces a tailored "have you got everything" checklist with
sorted/missing state and actionable gaps. ✓ Build green · 276 tests pass.

### Phase 5 — The night-before review (preparation's payoff, B3.6)  `[x]` DONE 2026-06-14
*Not a new entity — a composed view over P3/P4/timing. Built directly.*
**Depends on:** P4.
- [x] `buildDayReview` (composition action) assembles the **leave-by** (the one time that matters), the
      route shape (total time + legs), the commitments, **fragility** (a tight leg flagged via
      `checkLegFeasibility`), and the **readiness** counts → a calm verdict ("You're ready. Sleep easy.").
- [x] Surfaced on `/today` as the **"Tomorrow" card** for a plan that begins tomorrow (the night-before
      moment), reads as reassurance not a dashboard (`DayReviewCard`, leave-by as the hero figure).
**Done when:** the day before a trip, a single review surfaces leave-by + route + buffers + fragility
in one calm view. ✓ Build green · 276 tests pass.

### Phase 6 — Timing made visible (L1 finish)  `[~]` partial 2026-06-14
**Depends on:** P0.
- [x] **Buffer badges on the spine**: every leg now shows its feasibility classification —
      `.cc-leg-buffer` on `LegCard` (Comfortable / Tight · Xm / Insufficient), fed from
      `checkLegFeasibility` via `LegVM.buffer`. (Design handoff logged.)
- [ ] **Transition-pattern inference** (Direct / Drop-and-go / Hub-to-hub) — **OWED (buildable now).**
      Not a legitimate defer under the tightened rule (no later-phase/data/key dependency); it was a
      scope-skip. The UI slot exists (`.cc-leg-pattern`, hardcoded "Direct"); the classifier
      (geometry + timing → confirmable proposal) should be closed. *To do.*
- [ ] **True-door precision** — *deferred.* Needs entrance-level coord data beyond centroid; pairs
      with the data work when a richer hub/place coords source is wired.
**Done when:** the spine shows classified buffers; transition patterns are proposed and confirmable;
arrival resolves to a true door where known.

### Phase 7 — Commitment-aware navigation  `[ ]`
**Depends on:** P6.
- [ ] Guidance tone **carries consequence**: "turn left — no rush" with time in hand vs an urgent
      register when a hard commitment is genuinely at risk. Feed buffer/decision state into
      `use-guidance`.
- [ ] Live position feeds the whole-day timing (seam for the cascade in P9).
**Done when:** turn-by-turn guidance reflects time-in-hand, and live position updates the day's timing.

### Phase 8 — City mobility / TfL (C4)  `[x]` DONE 2026-06-14
**Depends on:** P6. **Procurement:** `TFL_APP_KEY` (free, api.tfl.gov.uk) — **mock until set.**
- [x] **TfL adapter** (`src/lib/integrations/tfl.ts`) behind a clean seam, **live + deterministic
      mock, env-gated** (`TFL_APP_KEY`): line status, **journey planner** (multimodal), **arrivals**,
      **StopPoint** (resolved via the journey's boarding point).
- [x] **Live line status** — `TflLineStatus` on `/today`, London-gated; concierge restraint; honest
      "· sample" when mock.
- [x] **Multimodal point-to-point + live arrivals** — every **London transit leg** on `/plan/[id]`
      resolves to a TfL plan (walk → line → walk) with **next-train arrivals** at the boarding stop
      (`TflLegPlan`). Design handoff logged.
- [→ P9] **Line-status-aware reroute** — genuinely depends on the **live-cascade engine (Phase 9)**;
      built there (a suspension re-plans the city day like a cancelled train).
- [→ P8b] **Network maps** (schematic + route highlight) — a large distinct data+design feature;
      re-scoped to its own phase.
**Done when:** a London day plans multimodal transit with live arrivals + line status. ✓ (reroute and
network maps are explicitly sequenced, not "partial"). Build green · 276 tests pass.

### Phase 8b — TfL network maps (schematic + route highlight)  `[ ]`
**Depends on:** P8 (done). **Procurement:** none beyond `TFL_APP_KEY`. **Position:** *parallelizable,
off the critical path — scheduled after the live-spine core (post-P11), or pulled forward on request.*
Heavily Design-led (schematic render). Re-scoped out of P8 as a distinct data+design feature.
- [ ] Line **route sequences** from TfL (`Line/{id}/Route/Sequence`) → the Tube/Overground schematic.
- [ ] Render the schematic with the **day's route highlighted** (the network map people navigate by).
**Done when:** a London transit leg shows the schematic line map with its route picked out.

### Phase 9 — Live spine A: decision-clock + consequence + live cascade (L2)  `[x]` DONE 2026-06-14
**Depends on:** P6; Darwin (DONE-partial) / TfL (P8).
- [x] **Pure live engine** (`src/lib/live/engine.ts`, unit-tested ×6): `decisionClock` ("act by"),
      `delayConsequence` (the calm sentence + broken/act-by), `cascade` (a missed hard connection
      carries its lateness onward). Signal-agnostic.
- [x] **Consequence translation — TfL path**: a disrupted line on a **London leg** runs the engine →
      impact on the next commitment, on the `TflLegPlan`.
- [x] **Consequence translation — RAIL path**: a booked train leg → `liveDeparture` (Darwin) → engine
      consequence as a `.cc-live-alert` under the leg. Dormant (no call) without `DARWIN_LDBWS_KEY`, so
      no false rail alarms; fires the moment the key flows.
- [x] **Decision-clock surface** — "Set off by HH:MM for X" on `/plan/[id]` (`.cc-decision-clock`).
- [x] **Line-status reroute** — a severe/suspended line shows the reroute prompt ("consider an
      alternative, or a taxi to keep the day").
**Done when:** a live delay (rail or TfL) states its consequence + act-by, and the reroute is offered.
✓ Build green · 282 tests pass. *The deeper **whole-day live re-solve** (re-propagating every downstream
time as a disruption unfolds) is the **disruption state machine → Phase 10**, not a P9 gap.*

### Phase 10 — Live spine B: fragility + disruption phase + on-service (L2)  `[x]` DONE 2026-06-14
**Depends on:** P9.
- [x] **Fragility detection** — `fragility()` in the live engine (unit-tested) + a `.cc-fragility`
      line on `/plan/[id]`: the thinnest connection read from the legs' buffer classification → "tight
      plan, one delay and it breaks; add a buffer while you can." Design handoff logged.
- [x] **Today disruption state** — a live rail break (Darwin) flips Today's character: a
      `TodayDisruption` banner + `cc-screen[data-disrupted]`, leading with the consequence. Additive
      over the existing projection; dormant without the key (no false alarms). Design handoff logged.
- [x] **Whole-day live re-solve** (carried from P9) — `cascade` runs across the day's commitments on a
      live delay; `/plan/[id]` shows the day-level ripple (`.cc-day-ripple`). Design handoff logged.
- [→ data-gated] **On-service tracking** — calling-points + stops-to-go **and** live train position.
      Both are (2) data-gated: the `calling_points` column exists but **the import doesn't populate it**
      (parsing intermediate stops from booking PDFs is a capture task), and there's **no RTT client**
      for live position. Position: a "deepen the rail pass" task (calling-points population) + an RTT
      adapter (live position) — fires when those land.
**Done when:** the day flags fragility, enters a true disruption state on a break, and (when data
exists) tracks you on the running service. ✓ for everything buildable now; on-service is data-gated.
**Done when:** the day flags fragility, enters a true disruption state on a break, and tracks you on
the running service.

### Phase 11 — Recovery / disruption (L3)  `[~]` in progress (core DONE 2026-06-14)
**Depends on:** P10. **Routing tools (RTJP dropped):** **Darwin** destination-filtered board (next
services — live in prod) + **TfL** journey planner (London, free) + **Valhalla** (taxi/drive fallback).
**RTJP is OUT** — effectively deprecated (the OJP SOAP feed is licence-only/de-listed on RDM) and
**mission-critical disruption must not hang on a bespoke paid licence**. Deep *route-alternative*
re-planning → a free self-hosted **OTP/GTFS** task (not RTJP). **Decision-gate:** *protect-target*
(founder's call) — until set, show the **trade-off**, don't rank.
- [x] **Re-planning fires only on a genuine break** — a cancelled / severely-delayed (≥16 min) booked
      train. Pure recovery engine (`src/lib/recovery/engine.ts`, unit-tested ×3): `buildRecoveryOptions`
      (each alternative's consequence on the next commitment) + `rankFor` (ready for protect-target).
- [x] **Viable alternatives** — `nextRailServices` (Darwin's destination-filtered board, live in prod;
      deterministic mock until the key). **Consequence band** = the `RecoveryCard` on `/plan/[id]` under
      the broken leg: each way-out + "makes your 2pm, 12 min spare" / "reaches it 18 min late".
- [x] **Trade-off display now** (soonest-first, no silent ranking) — honours the open protect-target.
- [→ decision] **Ranking** — `rankFor(target)` is built; switches on when the founder sets protect-target.
- [x] **Outbound+return pair as one unit** — the booked return (next locked rail departure downstream)
      is surfaced on every way-out: a service that lands after it strands you ("the trip's lost"); a
      tight turnaround is flagged. `bookedReturnDeparture` + engine `returnNote` (+test).
- [x] **Alternative routes (cross-network detour)** — `src/lib/integrations/otp.ts` (OpenTripPlanner2
      adapter: pure `planConnection` build + itinerary→`RecoveryCandidate` map, +tests) merged into the
      band via `nextRailServices`, deduped vs Darwin same-route. Surfaces "11:25 · via Coventry · 1
      change". **Gated on `OTP_URL`** (a self-hosted JVM — runbook in `docs/otp-self-hosting.md`),
      inert until stood up; the band degrades to Darwin same-route. *(Infra step, not code: same posture
      as self-hosting Valhalla/Photon — see capability map. Live GTFS-RT rail replanning via a
      Darwin→GTFS-RT bridge is a later sub-task; OTP plans the scheduled timetable until then.)*
**Done when:** a cancellation yields alternatives (same-route + cross-network detours) with live
consequence + the trade-off; the outbound/return pair handled as a unit. ✓ — code-complete; the OTP
detours light up the moment the self-hosted instance is pointed at by `OTP_URL`. Protect-target ranking
remains a founder decision (`rankFor` ready). Build green · 291 tests pass.

### Phase 12 — Contextual engine core + Weather + running-late (L4 ⭐)  `[x]` DONE 2026-06-14
**Depends on:** P9 (+P10). **Procurement:** DragonPass (mock); Open-Meteo (free, real).
- [x] The **rule framework** — `src/lib/context/engine.ts` (pure, ×6 tests): live signal → fixed-threshold
      condition → proposed `NudgeAction` → confirmable `Nudge`. **Never auto-inserted**, thresholds are
      sensible defaults (not learned). `evaluateContext` runs the rules, most-urgent first; adding a rule
      = a function + a line. Persistence of the verdict only (mig 0036 `nudge_states`, owner-only RLS);
      nudges themselves are always re-derived. Surfaces via `PlanNudges`→`NudgeCard` on `/plan/[id]`.
- [x] **Weather → leave earlier** — end to end on the **real free keyless** Open-Meteo feed
      (`integrations/open-meteo.ts`, pure `summarizeCorridor` ×3 tests; corridor precip/wind/snow over
      the leave-home leg's window → severity → a mode-scaled earlier-leave). Accept writes a prep note.
- [x] **Running late → expedite security** (flagship) on the **buffer-thinness baseline** (a flight
      anchor's airport dwell < 75 min). DragonPass fast-track behind a **mock adapter**
      (`integrations/dragonpass.ts`, env-gated `DRAGONPASS_KEY`) returning a real **QR-voucher** shape;
      accept mints the voucher + drops it on the flight's prep notes. "· sample" cue while mocked.
**Done when:** the engine fires the weather + running-late rules end to end with a confirmable
NudgeCard; the provider seam is ready for real DragonPass. ✓ — both rules fire on real conditions,
confirm applies through the seam (note / voucher), dismiss persists (never pesters). Build green ·
300 tests. Design handoff added (`.cc-nudges`/`.cc-nudge-done`). *Deferrals, positioned:* live
security-queue enrichment (Qsensor/FlightQueue — vendor-select, sharpens the baseline) and multi-point
corridor weather sampling are **P12-scope max-API** items behind their data/vendor; the full
**book-and-ticketise** the voucher onto a Pass is the **P14** connections framework.

### Phase 13 — Contextual engine: lounge · parking · gate-change (L4)  `[x]` DONE 2026-06-14
**Depends on:** P12. **Procurement:** Collinson/DragonPass (lounge), Parkopedia/Arrive (parking) — mocks.
Three more rules on the P12 framework (a function + a line each) — same `PlanNudges`/`NudgeCard` surface.
- [x] **Long layover → lounge** — `loungeForLayover` (the fast-track mirror: thin buffer < 75 →
      fast-track, long ≥ 90 → lounge, sized to the window). **Collinson mock** (`integrations/collinson.ts`,
      env-gated `COLLINSON_KEY`) → a lounge-pass QR shape; accept mints it onto the flight's prep notes.
- [x] **Car park likely full → pre-book** — `parkingLikelyFull` on a drive/taxi leg into an airport.
      **Parkopedia mock** (`integrations/parkopedia.ts`, env-gated `PARKOPEDIA_KEY`): `parkingOutlook`
      predicts occupancy (a daily curve peaking late-morning) → fires ≥ 85%; accept reserves a space.
- [x] **Gate changed → reroute the walk** — `gateChangeReroute` restates the in-terminal walk + the time
      still in hand. Live gate from **AeroDataBox** (`integrations/aerodatabox.ts`, free 600/mo, env-gated
      `AERODATABOX_KEY`, mock until keyed) diffed against the gate the plan last knew (`metadata.gate` +
      `flight_number`/`service_number`). Fires only on a real difference. *(Positioned follow-on, day-of:
      the continuous poll + persisted last-seen-gate loop — needs the live day-of loop; the source +
      rule + diff are built now and fire against a metadata baseline.)*
**Done when:** lounge, parking-full, and gate-change rules each produce a confirmable action behind
their provider seams. ✓ — lounge + parking fire on real conditions with mock providers; gate-change has
its real source (AeroDataBox) + rule + diff, with the day-of poll loop positioned. Build green · 304
tests (context engine ×9). Design handoff folded into the consolidated recovery+care round (below).

### Phase 14 — Connections framework + booking (L5)  `[~]` core DONE 2026-06-14
**Depends on:** P4 (readiness gaps feed it), P12/P13 (lounge/parking rules invoke it).
**Providers (D53, real contracts):** **Duffel Flights** (test key → LIVE validation), **Duffel Stays**
(pending sales activation), **Parkopedia** (email sent), **Assertis** (rail booking — email sent).
- [x] A reusable **supplier pattern** — `src/lib/connections/types.ts`: one Offer → Quote → Booking
      vocabulary every connector speaks + a `connectionProviders()` registry (live/test/mock/pending,
      derived from env). The money/irreversible step is the stub; the data path is real where possible.
- [x] **Modelled on the REAL Duffel contract** (research-first, June 2026): `integrations/duffel.ts` —
      Flights (offer_requests→offers→orders, `Duffel-Version: v2`, Bearer, test-by-token-prefix) +
      Stays (search→rates→quote→booking, 403→pending). Pure mappers (`mapDuffelOffer/Order/Stay`) ×4
      unit tests. Gated on `DUFFEL_API_TOKEN`; deterministic mock + `· sample` when unset.
- [x] **Validated against a real API** — Flights run **live against Duffel test mode** end to end:
      `searchFlightOffers` → compare → `bookFlightOffer` (refresh → create instant order, balance pay)
      → **lands as a flight run** via `addTransport`. The `FlightFinder` surface on `/plan/[id]`.
- [x] **Stays real-shaped** — `searchStayOffers`/`bookStayOffer` (lands an accommodation anchor);
      inert/pending until Duffel activates Stays on the account.
- [~] **Positioned in-phase follow-ons** (each tagged): **passenger-details capture** (test-mode
      defaults now → a proper passenger form, needs profile/traveller depth); **readiness-gap "book"
      wiring** (the finder is on the plan action row; wiring it from a P4 gap is a one-button connect);
      **stay-finder surface** (action ready, no UI yet — flights is the validated surface); **Assertis
      rail booking** + **Duffel Stays** (provider-gated); **hold/pay-later** orders (instant only today);
      **rail fares display** (Darwin/RDG fares feed — separate fast-follow).
**Done when:** a connection can be searched/compared/booked and lands in the day; **Duffel Flights works
live against test mode**; other adapters are env-gated real-shaped mocks. ✓ for the core + the live
flight path; the follow-ons above are positioned. Build green · 308 tests. **New env:** `DUFFEL_API_TOKEN`
(test now), `ASSERTIS_KEY`/`PARKOPEDIA_KEY` (pending). Design handoff (`.cc-conn*`) added.

### Phase ED-Flight — Flight entity to operator-app-redundant depth (L5)  `[~]` booking surface DONE 2026-06-15
*Spun out of P14 per the entity-depth rule + a flight-platform benchmark (Google Flights/Skyscanner/
Kayak/Hopper + airline apps + the full Duffel capability map). Catalogue: `docs/edition-iii-entity-
catalogue.md` (operate/refer/honest-limit).*
- [x] **Separate flight & stay flows** (killed the conflated toggle); **airport autocomplete** incl.
      **city/all-airports** options (LON/NYC/PAR — no IATA typing).
- [x] **Search depth**: one-way / **return**, adults + children, cabin.
- [x] **Compare depth** (our fare-honesty edge): fare brand, **baggage** (cabin/checked),
      **refundable/changeable**, **carbon**, round-trip — at compare time; **filters** (direct, airline)
      + **sort** (cheapest/fastest).
- [x] **Seat selection** — Duffel seat maps (`parseSeatMap`, +test) → a seat-grid picker at booking,
      best-effort with an honest "assigned at check-in" fallback.
- [x] **Real booking + rich ticket card** from Duffel order data (PNR, e-ticket, cabin, baggage, seat,
      order id) — **no email decode**; honest confirmation with the **airline check-in deep-link**.
- [→ positioned] **Manage booking** (change/cancel + refund quote) — order id now persisted, unblocked.
- [→ positioned] **Extra bags** ancillary (available_services); **multi-city**; **country-wide origin
      fan-out** ("any UK airport"); **airline-initiated-change webhook**; **price-track loop** (Duffel
      has no price intel — our own cache); wire the booked flight into **live status/gate** (AeroDataBox +
      live spine, already ours); **separate-ticket risk** via the fragility engine.
- [→ refer / honest limit] **Online check-in + boarding-pass barcode** are airline-DCS-only — deep-link
      check-in; reproduce the pass only once held (barcode rule). **Price prediction** needs a non-Duffel
      source. *(Verified — not faked.)*
**Done when:** the flight surface searches/compares/books to platform-credible depth with seats + a real
ticket card; servicing + ancillaries follow. ✓ for the **booking surface** (ready for Design); servicing/
ancillaries/multi-city positioned. Build green · 321 tests.

### Phase ED-Stay — Hotel/stay entity to operator-app-redundant depth (L5)  `[~]` booking surface DONE 2026-06-15
*Spun out of P14; benchmarked (Booking.com/Hotels.com/Expedia/Google/Airbnb + chain apps + Duffel Stays).
Catalogue: `docs/edition-iii-entity-catalogue.md`.*
- [x] **Independent location search** (geocoder) → search → **result cards** (star, guest review score,
      per-night + total, address).
- [x] **Property detail** (amenities, check-in time, special-requests) → **rooms/rates** (board,
      free-cancellation deadline, pay-at-property; `stayRates`/`mapStayRates`, +tests).
- [x] **Real booking** — `bookStayRoom` → Duffel **quote→booking** → a rich accommodation anchor
      (property, ref, board, price, free-cancel-until). Free-cancel filter; nights-aware pricing.
- [→ positioned] post-booking **view + cancel** (booking id persisted, unblocked); **loyalty-number
      capture** (gated on rate support); **`key_collection`** on the day-of card; photo gallery +
      reviews-breakdown; map-area search.
- [→ refer / honest limit] **digital room key, mobile check-in, loyalty points earn/redeem, on-property
      ordering** are chain-app-only — stated plainly in the surface (the stay-side boarding-pass limit).
**Done when:** the stay surface searches/compares/details/books to platform-credible depth; servicing +
loyalty follow. ✓ for the booking surface (ready for Design). Build green · 322 tests.

### Phase 15 — Mileage tracker (L6)  `[x]` DONE 2026-06-15
**Depends on:** P0 (day-object + routing). *Parallelisable, sequenced here for linear cadence.*
- [x] **Opt-in GPS drive capture** — `DriveRecorder` (watchPosition, high-accuracy, noise-filtered)
      records the actual route + live distance; on stop logs the trip with its GPS track
      (`source:"gps"`). *(Positioned: fully-automatic background detection — motion/geofence — needs
      native/Capacitor; the opt-in tap-to-record gets the route now.)*
- [x] **Business/personal classification** — an explicit per-trip segmented toggle (`classifyTrip`),
      never learned. A business trip carries the workspace tag for a later submission (P17).
- [x] **Claim-ready HMRC ledger + report** — pure tiered AMAP engine (`src/lib/mileage/engine.ts`,
      ×8 tests): car 45p/25p across the 10k threshold per **UK tax year**, motorcycle 24p, bicycle 20p;
      `buildReport` accumulates the tier chronologically. The `/mileage` ledger shows claimable £ +
      business miles, **CSV export**, manual add, and full edit/delete (`updateTrip`/`deleteTrip`).
- [x] **Private record** — `mileage_trips` (mig 0037, **owner-only RLS**, advisor-clean); the ledger is
      the user's own, distinct from the sharing boundary (employer submission is the explicit P17 step).
**Done when:** a drive auto-logs with its GPS route, classifies, and exports a claim-ready HMRC report.
✓ — record → trip+route, classify, export CSV at HMRC tiered rates. *Positioned enhancements:* Valhalla
**map-matched** (road-snapped) distance (currently honest straight-segment haversine — capability-map
P15 item); auto-distance-from-route on manual add (geocoder + Valhalla); route drawn on a map. Build
green · **316 tests**. Design handoff (`.cc-mileage*`) added.

### Phase 16 — Expenses depth + caps/spend-vs-cap (L6)  `[ ]`
**Depends on:** P15.
- [ ] **Receipt capture** bound to the leg/day (upload + store).
- [ ] **Spend-vs-cap**: a pre-approved cap, live used-vs-remaining, over-cap flagged.
- [ ] Cost-intelligence proposal ("a taxi here unlocks the day") — a proposal, never automatic.
**Done when:** expenses capture receipts and track against a cap with over-cap surfaced.

### Phase 17 — Org / B2B + approvals (L6, Part D)  `[ ]`
**Depends on:** P3 (outcome notes), P16 (caps). 
- [ ] **Set visits for staff** (already-restored `visit_plans`) appearing in the assignee's unified
      day as work commitments.
- [ ] **Track the work slice** + **review outcome notes** (work only; RLS-bounded).
- [ ] **Approval routing** for trips and over-cap spend; **RBAC enforcement** of the
      company_admin/team_manager/traveller roles (currently display-only).
**Done when:** an org assigns a visit, sees only the work slice + outcome, and routes trips/over-cap
through approval; roles gate actions.

### Phase 18 — Two-tier sharing + comms + safety (C14 / D4)  `[ ]`
**Depends on:** P9 (ETA), P17.
- [ ] **Employer tier**: status + ETA for work commitments only — never live location.
- [ ] **Personal tier**: live location as a **gift** to a named recipient — opt-in, per-journey,
      time-bounded, revocable.
- [ ] **Compose-message** ("running 15 late, start without me") handed to the OS send-sheet; **safety**
      reassurance for a lone/after-dark arrival.
**Done when:** a journey can share status+ETA upward and live-location to a named personal recipient
(revocable); messages compose to the OS sheet.

### Phase 19 — International (C9 / C10)  `[ ]`
**Depends on:** P2 (capture), P8 (transit generalises). **Procurement:** Airalo (mock), Rail Europe/
Lyko/Omio (mock).
- [ ] **Currency/FX** — spend shown in home currency (Frankfurter/exchangerate.host, free).
- [ ] **Timezones** — every time correct across the trip.
- [ ] **eSIM** in the readiness check (Airalo adapter, mock).
- [ ] **European/cross-border rail** capture (Eurostar + national operators) + a **no-redirect**
      booking interface (mock).
**Done when:** a London→Paris day shows home currency, correct tz, eSIM in readiness, and captured
European legs.

### Phase 20 — Rural & driving depth (C5)  `[ ]`
**Depends on:** P6, P12 (weather), P14 (parking connector).
- [ ] **No-rail orchestration** — a day planned on car/coach with no station-fallback assumption.
- [ ] **Rural parking** at unfamiliar destinations; **fuel/charge awareness** in readiness for the
      distance; **weather-on-corridor** (the leave-earlier rule on country roads).
**Done when:** a drive-only rural day plans with parking + fuel/charge in readiness and
weather-on-corridor watching.

### Phase 21 — Recurrence, reassurance pass, and go-live swaps  `[ ]`
**Depends on:** all prior.
- [ ] **Recurrence expansion** — user-set RRULE repeats actually generate instances (detection exists;
      add expansion + storage).
- [ ] **Reassurance/restraint audit** (C16) across every surface — completeness must land as calm.
- [ ] **Mock → real adapter swaps** as keys arrive (env-gated): RDM/Darwin·RTT·RTJP, TfL, DragonPass,
      Collinson, Parkopedia/Arrive, Duffel, Booking.com, Airalo, Xero/QuickBooks.
**Done when:** recurring commitments generate; the experience reads calm throughout; any provided key
flips its feature from mock to live with no code change.

---

## Entity-depth track (ED) — replace the operator's app, one entity at a time

**Sequencing decision (2026-06-14):** *press on with the dependency-ordered phases; enrich each
entity at the phase that powers it — don't front-load the ED track against mocks.* The research
showed most of each entity's depth rides on phases not yet built (flight gates/status → L4 + live;
hotel message/cancel → L5; cancel-by → P9; breakfast → leave-by → P6). So: **structural / no-partner
entity depth** is done opportunistically (as ED1's arrival payload was — buildable today, no API);
**API/live-powered depth folds into its capability phase** rather than being stubbed early. The
catalogue is the per-entity *depth checklist* each phase fulfils as it lands. ED2+ are therefore
**triggered by their powering phase**, not run upfront.

Runs **parallel to the capability phases** (it needs the day-object + capture, not the live engine).
**Every ED phase begins with a research pass** (a research agent → `docs/research/<entity>.md`):
discover the category apps' feature set (to match) + the third-party services/APIs that already
service the entity (to integrate, not reinvent). Then it takes the entry type to its full depth in
`docs/edition-iii-entity-catalogue.md` — the
operator-app-replacement checklist answered (operate / refer-purchase / honest-limit per row), the
structured schema built (no free-text dumping grounds), day-object hooks + readiness items wired, and
the max-scope APIs connected (or mocked). **Done when:** the user would have no reason to open the
operator's own app for that entity's travel-day needs.

- [~] **ED1 — Accommodation** (replace Hilton/Booking) — **core shipped 2026-06-14.** Structured
      `AccommodationDetails` model on the stay stop's `metadata.accommodation` (JSONB, no migration);
      deep manual capture in the PlanAdd "Stay" card (channel, confirmation, room/board, + an
      expandable **arrival payload**: phone, check-in/access, wifi, parking, breakfast, cancellation +
      free-cancel-until, price); the **arrival-payload card** rendered on the plan spine (the winnable
      edge — call the hotel, wifi, access, parking, cancel-by); brief/import mapped into the structured
      metadata. *Follow-ons (need APIs/other phases): message/modify/cancel via Booking.com/Expedia
      (mocked, L5), folio→expenses (P16), cancel-by→decision-clock (P9), breakfast→leave-by (P6),
      Wallet pass for stays.*
- [ ] **ED2 — Flight** (replace Virgin/BA). PNR, boarding pass reproduced (PDF417/BCBP), terminal/gate
      + bag-drop/boarding/gate-close → decision-clock, seat, baggage, status/gate-change → reroute.
      Couples to L4 (fast-track/lounge) + AeroDataBox.
- [ ] **ED3 — Car hire** · [ ] **ED4 — Parking** · [ ] **ED5 — Dining** · [ ] **ED6 — Meeting depth**
      (attendees + materials, on top of P3 notes) · [ ] **ED7 — Lounge/fast-track, eSIM, coach, ferry**.

Sequencing note: **ED1 (Accommodation) is the next build action** once the doc pass is locked —
it corrects the thinnest, highest-traffic entity and sets the template all other ED phases follow.

---

| Provider | For | Phase | Cost | Lead time |
|---|---|---|---|---|
| **Rail Data Marketplace** (Darwin·RTT·fares) | live rail, recovery | P9–P11 | free (Darwin) | start now |
| **OpenTripPlanner (self-hosted)** | route-alternative recovery | P11 | free OSS + hosting | infra: stand up a JVM (`docs/otp-self-hosting.md`) — RTJP dropped, replaced by this |
| **TfL Unified API** | city mobility | P8 | free | minutes (self-serve) |
| **Open-Meteo** | weather rule | P12, P20 | free | none (keyless) |
| **DragonPass** | fast-track + lounge | P12–P13 | revenue | apply early |
| **Collinson / Priority Pass** | lounge, SmartDelay | P13 | revenue | relationship-led |
| **Parkopedia / Arrive** | parking | P13, P20 | low / revenue | medium |
| **Duffel** | flights (Amadeus is dead 17 Jul) | L5 later | revenue | medium |
| **Booking.com Demand** | hotels | P14 | revenue | weeks — start early |
| **Airalo** | eSIM | P19 | net margin | self-serve |
| **Xero / QuickBooks** | accounting export | post-P16 | — | self-serve |

## Open founder decisions (don't block the build — defaults noted)

- **Protect-target** (gates L3 ranking, P11) — until set, recovery shows the trade-off, no ranking.
- ~~RTJP no-retailing licence (P11)~~ **DROPPED** — RTJP/OJP effectively deprecated; route-alternatives
  now via self-hosted **OTP** (code-complete, gated on `OTP_URL`; `docs/otp-self-hosting.md`).
- **Barcode reproduction comfort** (already buildable, P2) — a contractual/operational policy call.
- **eSIM commercial model** (P19) — net-pricing vs pure affiliate (merchant-of-record check).

---

## Progress Log

*(append one line per push: date · phase · what shipped · build/tests state)*

- 2026-06-14 · Plan authored. Inventory complete; Tell/Ask benched (prior push).
- 2026-06-14 · **Phase 0 shipped.** `/plan` is the single canonical itinerary surface: home renders
  as a base, the JourneyMap is ported onto `/plan/[id]`, the Brief lands there, and
  `/dashboard·/bookings·/itineraries·/itineraries/[id](+timeline)·/flights` redirect to their
  canonical equivalents (originals dormant). Navigate added to mobile. Build green · 272 tests pass.
  Also: API-capability map added — every API phase must build to *max scope*.
- 2026-06-14 · **Phase 1 shipped.** One unified day: the work/personal *lens* (the toggle + every
  `.eq("mode")` view-filter) is gone; `activeMode` is now the user's primary mode (from workspace
  type), used only as a default tag + nav variant. Added a `ModeTag` on the Plan list and an in-context
  `PlanModeFlip` on `/plan/[id]`; RLS boundary untouched. Deferred: per-row tags on tasks/contacts.
  Build green · 272 tests pass.
- 2026-06-14 · **Phase 2 mostly shipped.** Manual **accommodation** card ("Stay") in PlanAdd +
  `addManualAnchor` accommodation kind; **calendar import** as confirmable proposals (location now
  captured + geocoded, `PlanCalendarImport` on `/plan/[id]`). **Barcode byte-identity verification
  deferred** — principled: pipeline stores `.text` not `.bytes`, no raster decoder, a blind gate
  risks rejecting working tickets; core verbatim-reproduce integrity already holds. Build green ·
  272 tests pass.
- 2026-06-14 · **Entity-depth rule adopted** (founder). Only trains had real domain depth; everything
  else (esp. accommodation) was a thin wrapper. Added `docs/edition-iii-entity-catalogue.md` (the
  "replace the operator's app" rule + accommodation fully worked + flight/car/parking/dining stubs),
  bound the rule into Standing Rules, and added the **Entity-depth track (ED1–ED7)**. Next build
  action: **ED1 — deepen Accommodation** (structured model replacing `room_details`), then resume
  Phase 3.
- 2026-06-14 · **ED1 core shipped.** Structured accommodation model (`AccommodationDetails` on stop
  metadata — no migration), deep manual "Stay" capture (essentials + expandable arrival payload), the
  **arrival-payload card** on the plan spine (phone/wifi/access/parking/breakfast/cancellation), and
  brief/import mapped into it. The thin P2 card is now a real entity. Build green · 272 tests pass.
  Follow-ons noted (OTA message/cancel APIs, folio→expenses, cancel-by→decision-clock).
- 2026-06-14 · **Sequencing locked + Phase 3 shipped.** Decided: press on with the spine, enrich
  entities at their powering phase. **Notes** (new entity) got the research-first treatment
  (`docs/research/notes.md` → catalogue §6b), then built: migration 0034 (`notes` + `note_attachments`,
  applied to the live project + **security-advisor-verified** — the org-review boundary is one RLS
  line), owner-scoped actions, and a per-commitment `NotesPanel` (prep/outcome, work-outcome
  org-reviewable). Build green · 272 tests pass.
- 2026-06-14 · **Phase 4 shipped.** Readiness (new entity, research-first → `docs/research/readiness.md`,
  catalogue §6c): a **derived** checklist from a pure rules engine over the day-object (unit-tested ×4)
  + `readiness_state` (migration 0035, **owner-only** RLS — private prep) for the tick/dismiss overlay.
  Categories live: tickets/bookings/documents/devices/international/multiday; each gap actionable
  (link / reminder / book-mocked). `ReadinessPanel` on `/plan/[id]`, calm-by-default. Build green ·
  276 tests pass. Next: **Phase 5 — night-before review** (completes the Preparation trio).
- 2026-06-14 · **Phase 5 shipped — Preparation trio complete.** Night-before review (a composed view,
  not a new entity): `buildDayReview` assembles leave-by + route shape + commitments + fragility +
  readiness counts → a calm verdict; surfaced on `/today` as the "Tomorrow" card for a plan beginning
  tomorrow. Build green · 276 tests pass. Next: **Phase 6 — Timing made visible** (buffer badges on
  the spine + transition-pattern inference + true-door; also back-wires breakfast→leave-by for ED1).
- 2026-06-14 · **Design-handoff rule adopted + P6 (buffers) shipped.** Founder: Design is the
  front-end team — every UI phase now ships a handoff in `docs/design-handoff-edition-iii.md` (Code
  builds functional + on-token; Design skins). Caught up the back-catalogue (P0–P6 components) in that
  doc. P6 partial: **buffer badges** on every spine leg (Comfortable/Tight·Xm/Insufficient) via
  `LegVM.buffer` ← `checkLegFeasibility`. Deferred: transition-pattern inference + true-door precision.
  Build green · 276 tests pass. Next: continue P6 follow-ons or **Phase 8 — TfL** (first live-data API).
- 2026-06-14 · **Design round 6 integrated.** First brand pass over P0–P6 (`for-code-r6`) applied:
  `khonsera-edition-iii.css` (additive, imported last) + the markup hooks its selectors need (the two
  heroes restructured — AccommodationCard stay-document + DayReview leave-by figure; `data-panel` on
  ReadinessPanel; `data-open`/chevron on Notes; `data-checked` pick-boxes; the Stay detail grid; the
  PlanMap band). Removed Code's placeholder CSS for these so Design owns them. Design's redlines +
  class-map saved to `docs/design/`. Build green · 276 tests pass.
- 2026-06-14 · **Phase 8 (TfL) first cut — first live-data API.** Adapter (`integrations/tfl.ts`)
  behind a clean seam with a deterministic **mock**, env-gated on `TFL_APP_KEY` (free): line status
  over tube/overground/Elizabeth/DLR/tram. `TflLineStatus` on `/today`, London-gated, concierge
  restraint (disruptions first, rest withheld), honest "· sample" on mock. Proves the
  mocks-before-procurement rule end to end. Design handoff logged. **Procurement note to founder:
  add `TFL_APP_KEY` to flip mock → live.** Build green · 276 tests pass.
- 2026-06-14 · **Phase 8 COMPLETED (option A — honour the phase premise).** Founder rightly flagged
  that "partial then move on" erodes what a phase means. Tightened the Definition of Done (a phase is
  complete; deferrals carry an explicit tag; re-scope rather than ship "partial"). Finished TfL as a
  unit: adapter now also does the **journey planner + arrivals + StopPoint**; **every London transit
  leg on `/plan/[id]` resolves to a multimodal TfL plan + next-train arrivals** (`TflLegPlan`). The two
  genuinely-dependent pieces are tagged, not dropped: **line-status reroute → Phase 9** (needs the
  cascade engine), **network maps → new Phase 8b** (distinct data+design feature). Design handoff
  updated. Build green · 276 tests pass.
- 2026-06-14 · **Phase 9 started (live spine, part 1).** Built the pure live engine (`live/engine.ts`,
  unit-tested ×6): decision-clock, consequence translation, cascade. Surfaced the **consequence** on
  the TfL path — a disrupted line on a London leg runs through the engine and shows its impact on the
  next commitment (`TflLegPlan` disruption + consequence). Build green · 282 tests pass. **Remaining
  in P9 (positioned, next push, not advancing past):** decision-clock figure surface; the RAIL path
  (Darwin departure delay → consequence + whole-day cascade); line-status reroute.
- 2026-06-14 · **Phase 9 COMPLETE.** Closed the remainder in-phase: **rail consequence** (booked leg →
  `liveDeparture`/Darwin → engine consequence as `.cc-live-alert`, dormant without the key so no false
  alarms); **decision-clock** ("Set off by HH:MM for X" on `/plan/[id]`); **line-status reroute** prompt
  (severe/suspended). Both live signals (TfL + rail) now state consequence + act-by. Build green · 282
  tests pass. The deeper **whole-day live re-solve** is correctly placed in **P10** (disruption state
  machine), not a P9 gap. Next: **Phase 10** (fragility + disruption state + on-service).
- 2026-06-14 · **Darwin confirmed keyed in prod** — the var is **`DARWIN_LDBWS_TOKEN`** (set Jun 11);
  `darwinKey()` already reads it (it falls back `KEY ?? TOKEN`), and `liveDeparture` self-gates. So the
  **P9 rail consequence path is LIVE in production**, not dormant.
- 2026-06-14 · **Phase 10 started (live spine B, part 1).** **Fragility detection**: `fragility()` in the
  engine (unit-tested) + a `.cc-fragility` line on `/plan/[id]` reading the thinnest connection from the
  P6 buffers ("one delay and the day breaks; add a buffer while you can"). Build green · 283 tests pass.
  **Remaining in P10 (positioned, staying in-phase):** full Today disruption state machine; whole-day
  live re-solve (cascade across the day); on-service tracking (calling-points/stops-to-go; live train
  position is RTT-data-gated → tagged).
- 2026-06-14 · **P10 part 2: whole-day live re-solve.** Threaded every live delay (rail + TfL) through
  the `/plan/[id]` pass, ran `cascade` across the day's commitments, and surfaced the day-level ripple
  ("the day's running ~N min behind — …", `.cc-day-ripple`). Build green · 283 tests pass. **P10
  remaining (positioned):** full Today disruption state machine; on-service tracking (calling-points
  buildable; live train position RTT-gated).
- 2026-06-14 · **Phase 10 COMPLETE.** Today disruption state (additive `TodayDisruption` banner +
  `cc-screen[data-disrupted]`, Darwin-driven server-side, dormant without the key) — Today now flips to
  a disruption character on a live rail break. With fragility + the whole-day cascade already done,
  P10's buildable scope is finished. **On-service tracking is (2) data-gated** (the `calling_points`
  column isn't populated by the import; no RTT client for live position) → positioned as a
  calling-points-population task + an RTT adapter. Build green · 283 tests pass. Next: **Phase 11
  (Recovery)** — gated on the protect-target + RTJP-licence founder decisions (mock first).
- 2026-06-14 · **Design round 7 integrated.** Live-spine brand pass over P8–P10 (`for-code-r7`):
  `khonsera-edition-iii-live.css` (additive, imported last) + the markup reworked to its contract
  (TfL line board + leg plan, decision-clock `.label/.figure/.for`, rail/tube live-alerts, fragility,
  day ripple, the Today disruption takeover with `.cc-screen[data-disrupted]` recede). Removed all my
  inline placeholder styles on those surfaces (inline overrides a stylesheet). Tone rule held: calm
  caution carrying consequence, never alarm. Redlines + class-map saved to `docs/design/`. Build green
  · 283 tests pass.
- 2026-06-14 · **Phase 11 core shipped — recovery on Darwin, NOT RTJP.** RTJP confirmed effectively
  deprecated (OJP SOAP, licence-only/de-listed on RDM); mission-critical disruption must not hang on a
  bespoke paid licence, so it's dropped. Built the way-out on tools we have: pure recovery engine
  (`recovery/engine.ts`, ×3 tests; trade-off + `rankFor` ready), `nextRailServices` via Darwin's
  destination-filtered board (live in prod + mock), and the `RecoveryCard` consequence band on
  `/plan/[id]` under a cancelled/severe leg. Trade-off display (no ranking) honours the open
  protect-target. Design handoff added. **Remaining in P11:** outbound+return pairing (buildable);
  protect-target ranking (founder decision; `rankFor` ready). Deep route-alternative → free OTP/GTFS
  later, never RTJP. Build green · 286 tests pass.
- 2026-06-14 · **Phase 11 closed out — return-pairing + OTP alternative-routes (code-complete).**
  (1) Outbound+return as one unit: `bookedReturnDeparture` finds the next locked rail departure
  downstream; the engine adds a `returnNote` to every way-out ("lands after your 17:42 return — the
  trip's lost" / tight-turnaround). (2) Cross-network detours: built the **OpenTripPlanner2** adapter
  (`integrations/otp.ts` — pure `planConnection` build + itinerary→candidate map, ×4 tests), merged
  into `nextRailServices` (deduped vs Darwin same-route), surfaced as "via Coventry · 1 change" in the
  band. Gated on `OTP_URL`; **runbook `docs/otp-self-hosting.md`** (OTP 2.9/Java 25, GB GTFS +
  Geofabrik, `-Xmx8G`, Caddy → `/otp/gtfs/v1`) — same self-host posture as Valhalla/Photon, inert until
  stood up. RTJP formally struck from the provider table + founder decisions. Build green · 291 tests
  pass. Standing infra ask: deploy the OTP instance + set `OTP_URL`.
- 2026-06-14 · **OTP hosting PARKED (founder call).** Early self-hosting deemed not worth the standing
  upkeep with no traffic yet; recovery runs on Darwin same-route meanwhile (graceful). Code stays inert
  on `OTP_URL`. Revisit at real traffic (see `DECISIONS.md` D49). Pushed straight on to P12.
- 2026-06-14 · **Phase 12 DONE — contextual care engine (weather + running-late).** The L4 ⭐ care
  layer: a pure rule framework (`context/engine.ts`, ×6) where a live signal meets a fixed threshold
  and proposes a confirmable action — never auto-inserted, never learned. Two rules live: **weather →
  leave earlier** on the **real keyless Open-Meteo** feed (`open-meteo.ts`, ×3) over the leave-home
  corridor, and the flagship **running late → fast-track** on the airport-buffer baseline with a
  **DragonPass mock** (`dragonpass.ts`, QR-voucher shape, env-gated `DRAGONPASS_KEY`). Verdicts persist
  (mig 0036 `nudge_states`, owner-only RLS, advisor-clean); accept applies through the seam (a prep note
  / a minted voucher), dismiss never pesters. `PlanNudges`→`NudgeCard` on `/plan/[id]`. Design handoff
  added. Build green · **300 tests**. *User-visible:* the day now looks ahead — "heavy rain, leave 20
  min earlier" and "thin airport buffer, get fast-track", each a calm confirmable prompt.
- 2026-06-14 · **Phase 13 DONE — lounge · parking · gate-change (the framework proves out).** Three more
  rules, a function + a line each: **long-layover → lounge** (the fast-track *mirror* — same airport
  buffer, thin→fast-track / long→lounge; **Collinson** mock pass), **car-park full → pre-book** (a
  drive/taxi leg into an airport + **Parkopedia** mock occupancy ≥85% → reserve), **gate-change →
  reroute** (live gate from **AeroDataBox** free-tier mock, diffed vs the plan's last-known gate →
  restate the walk + time in hand). All accept→seam (pass/reservation/voucher + prep note), all
  dismiss persist. New env: `COLLINSON_KEY`, `PARKOPEDIA_KEY`, `AERODATABOX_KEY`. Build green · **304
  tests** (context engine ×9). *Deferrals positioned:* gate-change day-of poll loop (day-of), book→Pass
  (P14). **Design checkpoint reached** → packaged **Round 8** (the deviation & care layer: recovery band
  + the six nudges, two card states + one band) in `docs/design-handoff-edition-iii.md` for one
  consolidated brand pass. Round 8 returned + INTEGRATED same day.
- 2026-06-14 · **Provider procurement handoff + Collinson chosen (D52).** Wrote
  `docs/provider-procurement-handoff.md` (founder action list: who/what/why/cost/env per provider).
  Corrected the AeroDataBox "free" claim (it's low-cost paid; no free generous flight-gate feed).
  Founder picked **DragonPass** as the single active airport-experience partner (practical short-term) —
  both fast-track + lounge route through `dragonpass.ts` (`DRAGONPASS_KEY`). **Collinson** (Priority Pass
  + SmartDelay) is the long-term strategic **target**, kept **dormant** (`collinson.ts`) until that
  enterprise relationship is realistic; identical voucher shapes → one-line switch. 304 tests green.
- 2026-06-14 · **Round 8 (deviation & care) integrated** — `khonsera-edition-iii-care.css` last; recovery
  band + nudges reconciled to the contract (`.cc-recovery*`, `.cc-nudge*` with the `data-urgency`
  foresight→reaction flip), inline placeholders stripped. No token requests. 304 tests.
- 2026-06-15 · **Nav geocoder fixed + Phase 15 DONE (mileage tracker).** (1) Geocoding: the `/navigate`
  search ran on the slow public komoot Photon (~20s, patchy) — switched the primary to **Google Places
  Text Search** (one fast call, coords inline, full coverage; Photon kept as fallback). D54. (2) **P15
  mileage tracker**: opt-in GPS `DriveRecorder` captures the real route; explicit business/personal
  classification; pure tiered **HMRC AMAP** engine (car 45p/25p across the 10k tax-year threshold,
  motorcycle 24p, bicycle 20p; ×8 tests); `/mileage` ledger with claimable £, CSV export, manual
  add/edit/delete; `mileage_trips` owner-only RLS (mig 0037, advisor-clean). Readiness "book" gaps now
  deep-link to the connections finder (P14 closed). Build green · **316 tests**. Design handoffs
  (`.cc-mileage*`) added.
- 2026-06-14 · **Phase 14 core DONE — connections framework + Duffel Flights LIVE (test mode).** Built the
  shared supplier vocabulary (`connections/types.ts`: Offer→Quote→Booking + provider registry) and the
  real **Duffel** adapter (`integrations/duffel.ts`) to the researched June-2026 contract — Flights
  (offer→order) + Stays (search→quote→book), pure mappers ×4 tested, token-gated with `· sample` mock.
  Flights run **live end to end against Duffel test mode**: `searchFlightOffers` → compare in the
  `FlightFinder` → `bookFlightOffer` (refresh → instant order, balance pay, no real money) → **lands as a
  flight run** via `addTransport`. Stays real-shaped (pending Duffel activation → 403 falls to mock).
  This is the de-risking rung paying off: the framework is proven against a real offer→order lifecycle,
  not just mocks. Positioned follow-ons: passenger-details capture, readiness-gap wiring, stay surface,
  Assertis rail, hold orders. Build green · **308 tests**. New env `DUFFEL_API_TOKEN` (set in Vercel).
  Design handoff (`.cc-conn*`) added.

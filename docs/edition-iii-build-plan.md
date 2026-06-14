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
- Commit + push to the working branch; tick this file's boxes; append to the Progress Log; update
  `CLAUDE.md` if institutional knowledge changed.
- State the user-visible increment plainly (what can a person now do that they couldn't before).

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

### Phase 1 — One unified day + privacy tag (Mode reconciliation)  `[ ]`
*Edition III D1: there is no work/personal toggle — one blended day; the tag is a privacy boundary.*
**Depends on:** P0.
- [ ] Remove the **Mode lens**: drop `.eq("mode", activeMode)` view-filters from `/today`,
      `/plan`(+list), `/tasks`, `/contacts`, `/dashboard`-equivalent. Retire `ModeSwitchControl` from
      the shell.
- [ ] Render work + personal commitments in **one timeline**, each carrying a quiet **work/personal
      tag** (pill/dot) on the card.
- [ ] Keep `app_mode` as the per-item tag and the **RLS boundary unchanged** (personal never visible
      upward). Default new items sensibly (work when in a workspace context, else personal); let the
      user flip the tag in context.
**Done when:** a single unified day shows everything; work/personal reads as a tag; no toggle; RLS
boundary intact (verify a workspace member cannot see a personal-tagged item).

### Phase 2 — Capture completion (L0)  `[ ]`
**Depends on:** P0.
- [ ] **Manual accommodation card** in `PlanAdd` (check-in-from / check-out-by as constraints, hotel
      picker, ref, price, room) — parity with the brief's accommodation card.
- [ ] **Calendar auto-import**: turn read-only Google Calendar events into **confirmable proposals**
      (infer-never-manufacture) that land as commitments on confirm; resolve messy locations to a
      Place. Never auto-insert.
- [ ] **Barcode round-trip verification**: after decode→store, re-encode and **assert byte-identity**;
      on mismatch fall back to the original PDF. Make the guarantee explicit + tested.
**Done when:** all four capture methods (email, manual, calendar, barcode) produce confirmable
structured cards; barcode round-trip is asserted in a test.

### Phase 3 — Notes as a first-class entity  `[ ]`
**Depends on:** P0.
- [ ] Notes table/entity attachable to a **Commitment or Day**, with **prep** and **outcome** kinds
      (timestamps, edit history).
- [ ] Prep notes surface on the commitment (agenda, who, what to bring, context). Outcome notes
      recorded during/after.
- [ ] **Org-reviewable outcome notes** for *work*-tagged commitments only (personal notes stay
      private — enforce via RLS).
**Done when:** a commitment carries prep + outcome notes; work outcome notes are visible to the
workspace, personal notes are not.

### Phase 4 — Readiness check (the heart of preparation, B3.3)  `[ ]`
**Depends on:** P2, P3.
- [ ] A **per-day readiness checklist** assembled from what the day actually requires: tickets
      loaded/reproduced; documents (ID/passport+expiry/visa/licence) when the day needs them;
      bookings the day needs (parking/hotel/onward/table); devices & power; international
      (passport/visa/currency/eSIM/tz); rural (fuel/charge/parking/route); multi-day (check-in/out,
      pack-shape).
- [ ] Each gap is **actionable** (sets a Task now; books later via L5). Hook unbooked needs to the
      connections seam (mock until L5).
**Done when:** opening a day produces a tailored "have you got everything" checklist with
sorted/missing state and actionable gaps.

### Phase 5 — The night-before review (preparation's payoff, B3.6)  `[ ]`
**Depends on:** P4, and the timing surfacing of P6 (may run after P6).
- [ ] A calm, complete **pre-day review**: the back-calculated leave-by, the route + legs, the buffer
      on each commitment, anything fragile — "here's your day, here's when you leave, you're ready."
- [ ] Reachable the evening before (and on demand); reads as reassurance, not a dashboard (C16).
**Done when:** the day before a trip, a single review surfaces leave-by + route + buffers + fragility
in one calm view.

### Phase 6 — Timing made visible (L1 finish)  `[ ]`
**Depends on:** P0.
- [ ] **Buffer badges on the spine**: surface the existing feasibility classification
      (comfortable/tight/insufficient) on each leg/commitment.
- [ ] **Transition-pattern inference** (Direct / Drop-and-go / Hub-to-hub) from geometry + timing,
      surfaced as a **confirmable proposal** (never silently assumed).
- [ ] **True-door precision**: resolve real entrances (station entrance/platform, office door, car
      park) so the final leg is honest — extend hub/place coords beyond centroid where data allows.
**Done when:** the spine shows classified buffers; transition patterns are proposed and confirmable;
arrival resolves to a true door where known.

### Phase 7 — Commitment-aware navigation  `[ ]`
**Depends on:** P6.
- [ ] Guidance tone **carries consequence**: "turn left — no rush" with time in hand vs an urgent
      register when a hard commitment is genuinely at risk. Feed buffer/decision state into
      `use-guidance`.
- [ ] Live position feeds the whole-day timing (seam for the cascade in P9).
**Done when:** turn-by-turn guidance reflects time-in-hand, and live position updates the day's timing.

### Phase 8 — City mobility / TfL (C4)  `[ ]`
**Depends on:** P6. **Procurement:** TfL Unified API key (free, self-serve) — mock until present.
- [ ] **TfL adapter** behind the transit seam: live arrivals, line status, journey planner.
- [ ] **Multimodal point-to-point** (walk → Tube → walk) as a continuous plan between commitments.
- [ ] **Line-status-aware reroute** (a suspended line re-plans the city day like a cancelled train).
- [ ] **Network maps**: Tube/Overground schematic with the route highlighted.
**Done when:** a London day plans multimodal transit with live arrivals + line status, reroutes on a
suspension, and renders the highlighted network map. (Generalises later via GTFS-RT + OTP.)

### Phase 9 — Live spine A: decision-clock + consequence + live cascade (L2)  `[ ]`
**Depends on:** P6; Darwin (DONE-partial) / TfL (P8).
- [ ] **Decision-clock** — "act by HH:MM": the latest moment a decision can still be made. Derive and
      surface as the day's single most reassuring number.
- [ ] **Consequence translation** — "delayed 12 min → you'll miss the 09:40 → act by 09:12."
- [ ] **Whole-day cascade live** — a slip in one leg recomputes every downstream leg + buffer and
      re-stabilises or flags a break (run the solver reactively on live signals, not just at create).
**Done when:** a live delay shifts state, states its consequence, shows act-by, and recomputes the
day downstream.

### Phase 10 — Live spine B: fragility + disruption phase + on-service (L2)  `[ ]`
**Depends on:** P9.
- [ ] **Fragility detection** — flag a plan with no slack before it breaks (a robustness signal, not
      just a per-leg tight flag).
- [ ] **Full Today-state machine** — calm → imminent → live → **disruption**, adopting the character
      of whatever is most live.
- [ ] **On-service tracking** — calling-points, your stop, stops-to-go (Darwin calling points; RTT
      client behind an interface).
**Done when:** the day flags fragility, enters a true disruption state on a break, and tracks you on
the running service.

### Phase 11 — Recovery / disruption (L3)  `[ ]`
**Depends on:** P10. **Decision-gate:** *protect-target* (founder's call) + RTJP licence — until set,
show the **trade-off**, don't rank. **Procurement:** RTJP via RDM (mock until licensed).
- [ ] Re-planning fires **only on a genuine break**; generate viable alternatives (exclusions
      filtered).
- [ ] **Consequence band** showing the outbound+return pair as one unit, with each alternative's live
      impact as you step through.
- [ ] Trade-off display now; ranking once protect-target is locked.
**Done when:** a cancellation yields alternatives with live consequence and the outbound/return pair
handled as a unit.

### Phase 12 — Contextual engine core + Weather + running-late (L4 ⭐)  `[ ]`
**Depends on:** P9 (+P10). **Procurement:** DragonPass (mock); Open-Meteo (free, real).
- [ ] The **rule framework**: live signal → condition → proposed action → in-app booking, **confirmable,
      never auto-inserted**, thresholds as fixed sensible defaults (adjustable per-plan, never learned).
      Surfaces as a `NudgeCard`.
- [ ] **Weather → leave earlier** rule, end to end on the **real free** Open-Meteo feed.
- [ ] **Running late → expedite security** (the flagship) on the **buffer-thinness baseline**;
      DragonPass fast-track behind a mock adapter (QR voucher shape).
**Done when:** the engine fires the weather + running-late rules end to end with a confirmable
NudgeCard; the provider seam is ready for real DragonPass.

### Phase 13 — Contextual engine: lounge · parking · gate-change (L4)  `[ ]`
**Depends on:** P12. **Procurement:** Collinson/DragonPass (lounge), Parkopedia/Arrive (parking) — mocks.
- [ ] **Long layover / early arrival → lounge** sized to the window.
- [ ] **Car park likely full → pre-booked alternative** (Parkopedia live + predicted occupancy, mock).
- [ ] **Gate changed → reroute the in-terminal walk** and restate the time in hand.
**Done when:** lounge, parking-full, and gate-change rules each produce a confirmable action behind
their provider seams.

### Phase 14 — Connections framework + booking stub (L5)  `[ ]`
**Depends on:** P4 (readiness gaps feed it), P12/P13 (lounge/parking rules invoke it).
- [ ] A reusable **supplier pattern**: search → availability → book → confirm, behind a provider
      interface; the **transaction is faked** (the one stub); result flows back as a Ticket/Commitment.
- [ ] First mock connectors: parking, hotel, lounge, rideshare, eSIM.
- [ ] **Fares display** (informing only) where data exists; purchase referred.
**Done when:** a connection can be searched/compared/"booked" (stub) from a readiness gap or a nudge,
and lands in the day; real adapters are env-gated.

### Phase 15 — Mileage tracker (L6)  `[ ]`
**Depends on:** P0 (day-object + routing). *Parallelisable, sequenced here for linear cadence.*
- [ ] **Auto drive detection** (opt-in) storing the actual GPS route; auto-log distance/route/times.
- [ ] **Business/personal classification** (swipe + user-set rules, explicit never learned).
- [ ] **Claim-ready ledger + HMRC-rate report**; full manual edit + history. The ledger is the user's
      private record (distinct from the sharing boundary).
**Done when:** a drive auto-logs with its GPS route, classifies, and exports a claim-ready HMRC report.

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

## Procurement table (start these in parallel with the build — never block on them)

| Provider | For | Phase | Cost | Lead time |
|---|---|---|---|---|
| **Rail Data Marketplace** (Darwin·RTT·RTJP·fares) | live rail, recovery | P9–P11 | free / RTJP paid+licence | start now |
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
- **RTJP no-retailing licence** (P11) — raise through the RDM licence process.
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
  Next: **Phase 1** (one unified day + privacy tag). Also: API-capability map added — every API phase
  must build to *max scope* (see `docs/edition-iii-api-capability-map.md`).

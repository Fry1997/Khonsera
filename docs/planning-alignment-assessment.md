# Khonsera Planning View — Model Alignment Assessment

_Scope: planning modality only. Live-day, disruption, real-time tracking, and webhook-driven state changes are out of scope per the brief._

**Framing correction up front:** the brief's memory of a `journies` table is stale. The actual model is **`itineraries` → `stops` (facts) → `transitions` (adjacent pairs)** — which is *closer* to the canonical model than the doc assumed. The structural backbone is largely right; the gaps are almost entirely in the **engine logic** (ranking, buffers, exclusions, state) and a few **UX abstractions**, not the data shape.

Status legend: **Aligned / Partial / Not aligned / Not yet implemented**. Priority: **P1** (blocks correctness) / **P2** (impedes UX) / **P3** (refinement).

---

## A. Data model & structure

### A1 — Time-ordered list of facts, not trips-with-embedded-transport — **Aligned**
- **Evidence:** `supabase/migrations/0010_reshape_itineraries.sql:166–223` — `stops` (sequence, type, times) + `transitions(from_stop_id, to_stop_id, unique(from,to))`. No trip-with-embedded-transport array.
- **Priority:** —

### A2 — Transitions between adjacent facts, not entities tied to trips — **Aligned (nuance)**
- **Evidence:** `transitions` are persisted rows but keyed to **adjacent stop pairs** (`unique(from_stop_id,to_stop_id)`) and recomputed by the solver — not embedded in trip objects. Persisting them is correct (booked/locked legs need stable identity).
- **Priority:** —

### A3 — Insert by time; handle earlier-than-existing insertion — **Partial**
- **Evidence:** `createItineraryFromBrief` sorts chronologically at build (`src/lib/actions/itineraries.ts:440–449, 888–909`). But the *incremental* path `createStop` (`src/lib/actions/stops.ts:108–139`) **appends by `max(sequence)+1` or trusts a caller-supplied sequence**, then full-recomputes. The solver orders by **sequence, not time** (`src/lib/itinerary/solver.ts:61–79`) — so a fact that is earlier in time but appended at the end sequences wrong unless the caller computes placement.
- **Recommended:** add an engine-level "insert fact by `start_time`" that derives sequence from time and re-sequences neighbours.
- **Priority:** **P1** — this is the canonical "a new fact arrives → insert by time" behaviour and it is not robust at the engine level.

### A4 — Recomputes scoped to affected adjacent transitions — **Not aligned**
- **Evidence:** `resolveItineraryTimes` (`src/lib/actions/itineraries.ts:1555–1652`) refetches **all** stops + transitions and rebuilds every call.
- **Recommended:** scope recompute to the inserted fact's two adjacent transitions once correctness is locked.
- **Priority:** **P3** (perf/refinement; correctness is fine at current scale).

### A5 — Distinguish fact types — **Aligned**
- **Evidence:** `stop_type` enum (`0010_reshape_itineraries.sql:58–61` + `0022_transit_stop_types.sql`): start / end / appointment / accommodation / event / meal / transit_departure / transit_changeover / transit_arrival / stopover / other.
- **Priority:** —

---

## B. Transitions & mode evaluation

### B1 — Ranked by door-to-door time (all sub-legs) — **Partial**
- **Evidence:** `src/lib/planning/ranking.ts:18–22, 48–56` ranks by feasibility tier → cost → `totalDurationMinutes`, but `totalDurationMinutes` is **caller-supplied**; the engine never composes first-mile + main + last-mile into one total. The transition-row picker (`src/components/itinerary/transition-row.tsx:147–221`) shows per-mode previews in static order, not ranked.
- **Recommended:** compose door-to-door totals in the engine; rank on that.
- **Priority:** **P1** — core to the whole model.

### B2 — Top-4 fastest + "show all" expansion — **Not implemented**
- **Evidence:** flat pill list of all modes (`transition-row.tsx`); no fastest-N + long-tail expansion.
- **Priority:** **P2**.

### B3 — Exclusions at account + journey level — **Not aligned**
- **Evidence:** `src/lib/actions/travel-profile.ts:47–51` stores `walking_threshold_minutes`, `max_taxi_fare_pence`, `preferred_mode`, `luggage_default` — but there are **no reads** in `ranking.ts` / `feasibility/`. `preferred_mode` is only a tie-breaker. No journey-level exclusion field exists.
- **Recommended:** feed account thresholds + a per-itinerary exclusion set into ranking/feasibility.
- **Priority:** **P2** (load-bearing per the model).

### B4 — First-mile/last-mile use the same ranking logic — **Not aligned**
- **Evidence:** first/last-mile are chosen **manually via `GapModePicker`** (`src/components/itinerary/build-planning-timeline.ts:92–110`), explicitly *outside* the engine — `src/lib/actions/transitions.ts:479–482`: _"the user picks those modes via the existing 3-pill picker once the leg is inserted."_ The main leg is locked with `mode=train/flight`.
- **Recommended:** route first/last-mile through the same door-to-door ranker as the main leg.
- **Priority:** **P1**.

### B5 — Drop-and-go (Pattern 2) surfaced — **Not implemented**
- **Evidence:** no handover-point logic anywhere; only the manual `GapModePicker` stub. No park-and-ride inventory or composite drive→hub→drive product.
- **Priority:** **P2** (a whole pattern missing).

### B6 — Honest connection buffers (5–10 rail, 60–120 air) — **Not aligned**
- **Evidence:** `src/lib/feasibility/check.ts:34` — single `bufferMinutes ?? 10` for **all** modes. A flight connection with a 10-min buffer is flagged feasible.
- **Recommended:** mode-specific buffers (rail 5–10, airport 60–120, ferry/coach mid).
- **Priority:** **P1** — feasibility correctness.

---

## C. State propagation

### C1 — Resource state tracked (luggage / car / bookings) — **Not implemented**
- **Evidence:** solver propagates **times only** (`src/lib/itinerary/solver.ts:96–191`). `luggage_default` is static profile metadata (`travel-profile.ts:51`), no per-leg state; no car/bike location table.
- **Priority:** **P2**.

### C2 — Downstream reflects upstream (drove → return drive, car placed) — **Not implemented**
- **Evidence:** no resource forwarding; a return-from-station transition cannot infer the car is there.
- **Priority:** **P2**.

### C3 — State-break conflicts surfaced — **Partial**
- **Evidence:** solver surfaces **time** conflicts (`stop_anchor_mismatch`, `solver.ts:110–131`) but no **resource** conflicts.
- **Priority:** **P2**.

### C4 — Same resource never in two places — **Not implemented**
- **Evidence:** no resource identity/location tracking (depends on C1).
- **Priority:** **P3**.

---

## D. Appointment card

### D1 — Three-variable model (arrive / duration / leave-by) — **Aligned**
- **Evidence:** `Anchor.timingMode` (`src/components/itinerary/types.ts:43–57`): arrive_by / leave_by / around_then / maximize; relationships in `src/components/itinerary/helpers.ts:267–322`. Any two determine the third.
- **Priority:** —

### D2 — Values rendered with fuzzy / provisional / committed state; harden visually — **Partial**
- **Evidence:** `~` prefix for fuzzy, dashed borders + `--ink-faint` for soft (`anchor-card.tsx:991`, `stopover-card.tsx`). No distinct "provisional" tier; hardening is implicit.
- **Priority:** **P3**.

### D3 — "Maximise" bounded by standing facts / home-by / booked return / opening hours — **Partial**
- **Evidence:** maximize window computed from adjacent transitions + 10-min buffer (`src/components/itinerary/timeline.tsx:162–200`), but **not** bounded by standing facts (table unread) or opening hours.
- **Priority:** **P2**.

### D4 — Mode-toggle pills collapsed into plain field editing — **Not aligned**
- **Evidence:** explicit `TimingModeRow` pills still present (Arrive by / Leave by / Around then / Maximize, `src/components/itinerary/timing-mode-row.tsx:6–39`). The model wants the mode to *emerge* from what's set.
- **Priority:** **P2**.

### D5 — Microcopy attributes committed values — **Not implemented**
- **Evidence:** no "arrive 09:19, set by your 07:13 train" anywhere; summary shows time+duration without derivation.
- **Priority:** **P3**.

---

## E. Strategy decisions

### E1 — Trip-level strategy (rail vs drive) as a header chip — **Not implemented**
### E2 — Reopen strategy without disrupting the plan — **Not implemented**
### E3 — Strategy change collapses & rebuilds — **Not implemented**
- **Evidence:** no "strategy" concept anywhere; transport mode is chosen inline per-transition (`transition-row.tsx`). Whole section unbuilt.
- **Priority:** **P2** (each).

---

## F. Paired bookings

### F1 — Train outbound+return pairs, shared fare — **Partial**
- **Evidence:** `returnTransportBooking()` helper swaps hubs (`src/components/itinerary/transport-booking-card.tsx:85–109`); `booking_intents` has `outbound_summary` / `return_summary` **text** (`0010_reshape_itineraries.sql:354–355`). But stored as **two independent records** — no `paired_booking_id` FK, no shared-fare model.
- **Priority:** **P2**.

### F2 — Flights handled the same — **Partial**
- **Evidence:** same mechanism, no fare logic.
- **Priority:** **P2**.

### F3 — Booked pair commits into two solid cards at their times — **Partial**
- **Evidence:** bookings become transit stops/cards, but not as a *linked* pair.
- **Priority:** **P2**.

### F4 — Chevron-stepping to adjust outbound/return independently — **Not implemented**
- **Priority:** **P3**.

---

## G. Honest representation

### G1 — No live-day-only data in planning — **Aligned**
- **Evidence:** planning view is plan-construction only; no driver/tracking/overlays.
- **Priority:** —

### G2 — Suggested intents kept separate, never auto-inserted — **Aligned**
- **Evidence:** `intents` written to a **separate table** by `confirmCapture` (`src/lib/actions/tell-khonsera.ts:214–218`); nothing auto-inserts into the timeline; stopovers are user-added. "The engine threads only what the user gives it" holds at the data layer.
- **Priority:** —

### G3 — Fuzzy visually distinct from committed — **Aligned (partial polish)**
- **Evidence:** `~`, dashed, faint treatments present but not universal.
- **Priority:** **P3**.

### G4 — "This trip needs" surfaces only genuine items, not engine suggestions — **Not yet implemented**
- **Evidence:** no needs/suggestion panel exists; principle not violated.
- **Priority:** **P3**.

---

## Specific code pieces assessed

- **Fact data structure:** `itineraries` + `stops` + `transitions` (NOT `journies` — doc memory stale). Supports the time-ordered list + adjacent-transition model. **Aligned.**
- **Parser output (`src/lib/parser/`):** produces fact-shaped output — `fact_type`, slots with `source_range` / `confidence` / `fuzzy` / `inferred`, links; intents distinguishable (intent/task fact types route to the `intents` table); fuzzy values preserved (`slot.fuzzy`, `granularity`, `confidence`). **Good shape for threading** — but `materialise.ts` converts a payload to a whole brief → `createItineraryFromBrief` (all-at-once), not incremental fact threading.
- **Capture UI (`src/components/capture/`):** builds one payload → `confirmCapture` → one itinerary. **Not** incremental into an existing plan. Gap relative to "a new fact arrives → insert by time."
- **Drafts list (`/capture/drafts`):** structured around `captured_inputs` (raw-text drafts), **not** facts or trips. A draft → one itinerary on confirm (`created_itinerary_id`). Facts without a trip context = the `intents` table.
- **Planning view:** exists (`src/app/(app)/itineraries/[id]/itinerary-editor.tsx` + `src/components/itinerary/*`); assessed above.
- **Standing facts model:** `standing_facts` table exists (`0027_tell_khonsera_substrate.sql:143–168`) but is **read by nothing** in the planning engine (no references in `src/lib/itinerary/`, `src/lib/planning/`, `transitions.ts`, `feasibility/`). Dead to the engine.

---

## Summary

**Counts:** **P1 = 4** (A3, B1, B4, B6) · **P2 = 13** (B2, B3, B5, C1, C2, C3, D3, D4, E1, E2, E3, F1, F3 — F2 folds into F1) · **P3 = 7** (A4, C4, D2, D5, F4, G3, G4).

**Not yet implemented (whole features):** trip strategy chip (E), drop-and-go pattern (B5), resource-state propagation (C), paired-booking *linkage* + chevron (F1/F4), attribution microcopy (D5), suggestion/needs panel (G4).

**Genuinely aligned:** A1, A2, A5, D1, G1, G2 — the **structural kernel is sound**.

### Top 5 priority issues
1. **Door-to-door ranking with first/last-mile composed in the engine (B1 + B4).** Today the main leg is locked and the connecting legs are hand-picked outside the ranker — so "fastest option" is never actually computed across sub-legs. This is the heart of the three-pattern model.
2. **Mode-specific connection buffers (B6).** A flat 10-min buffer will green-light an impossible flight connection. Cheap to fix, high correctness payoff.
3. **Incremental "insert fact by time + recompute adjacent" (A3 + A4).** The canonical fact-arrival behaviour isn't an engine path; single-fact adds append + trust caller sequence + full-rebuild.
4. **Wire exclusions + standing facts into ranking (B3 + D3).** The constraints exist in the schema (`travel_profile`, `standing_facts`) but the engine never reads them — recommendations and "maximise" bounds are blind to them.
5. **Resource-state propagation (C1–C2).** No "drove to station → car is there → return-drive surfaces" intelligence; the engine assumes infinite, omnipresent resources.

### Genuine ambiguities (need human input before alignment can be finalised)
1. **What is a "fact" vs a `stop`?** Stops currently *require* a place. Capture intents with no date go to the separate `intents` table. Should the planning timeline ever thread a *placeless/timeless* fact, or does threading only begin once a fact resolves to time + place?
2. **Strategy granularity.** Is "rail vs drive" a per-itinerary strategy or per-leg? How should it interact with already-booked legs when toggled (E3 says "collapse and rebuild" — does that discard booked legs)?
3. **Drop-and-go data source.** Pattern 2 needs a handover inventory (park-and-ride / Westfield-and-tube points). Curated table, or derived from route geometry?
4. **Collapsing the timing-mode pills (D4).** The explicit pills are arguably *clearer* than inferring mode from fields. Confirm the inference model is wanted (trades discoverability for cleanliness).
5. **Paired bookings: fare logic vs linkage.** Is shared-fare modelling in scope now, or is the immediate need just the *linkage* (FK + coupled editing/chevron), with fares deferred?
6. **Full-day vs scoped recompute (A4).** Is full recompute actually a problem at current scale, or is scoping it premature optimisation?

### Suggested next-build sequence (the view exists; this closes engine gaps)
1. **Composite routing + buffers** — compose first-mile + main + last-mile into one door-to-door total, ranked on that, with mode-specific buffers (B1, B4, B6). _Biggest correctness unlock._
2. **Constraint wiring** — feed `travel_profile` thresholds + per-journey exclusions + `standing_facts` into ranking/feasibility and "maximise" bounds (B3, D3).
3. **Incremental fact threading** — an "insert fact by `start_time`" action that re-sequences and recomputes only the two adjacent transitions (A3, A4).
4. **Pattern completeness** — model drop-and-go handover, and fold hub first/last-mile into the unified ranker (B5, B4).
5. **Resource state** — minimal car/luggage position propagated through the chain with conflict surfacing (C1–C4).
6. **UX alignment** — strategy chip (E), collapse timing-mode into field editing (D4), attribution microcopy (D5), paired-booking linkage + chevron (F).
7. **Opt-in panels** — "you might want" / "this trip needs" reading `intents` + genuine gaps (G4).

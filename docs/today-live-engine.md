# Today — the live-day engine

> This is a functional design, not a screen spec. The Today page is the engine
> that gets an individual through a moving day. It is written down so the build
> follows one logic, not a series of patches.

## 0. The shift in framing

Today is a **real-time engine** with one job, evaluated continuously:

> From where you **are right now**, what is your next obligation, can you still
> make it, and what should you see or do about it?

Two principles fall out of that and govern everything else:

1. **Live position is the spine.** The "from" for every prediction is your
   current GPS — never the plan's assumed origin. The plan says where you're
   *meant* to be; the engine reconciles that against where you *are*. (The bug
   you caught — "Harpenden → Luton" while you're in Wellingborough — is exactly
   this: the engine must read your location, not the plan's start.)
2. **The plan is a set of fixed points, not a script.** The day flexes — you
   move, things slip, you change your mind. The engine keeps the next fixed
   point reachable, or tells you honestly when it isn't and what to do.

If the day goes right, the engine is nearly silent: you see your cards, scan
your ticket, hop on, watch the stops count down, get off, walk the last bit.

## 1. Inputs (the signals it consumes)

- **The plan** — Journey → Anchors (fixed points) + Legs (transitions) +
  Intentions (preferred modes, do/don'ts) + Resources (ResourceState: car / bike
  / lift, each with a location) + Tickets (wallet, with eligibility).
- **Live position** — `watchPosition`, continuous, accuracy-aware.
- **Live transport status** — Darwin (rail: departures, arrivals, platforms,
  calling points, delays, cancellations), TfL (London), OTP later. Polled for the
  services actually on today's path.
- **Now.**

## 2. Output: one derived state, rendered thinly

Each tick the engine emits a `DayState`:

- `phase` — `at_rest | readiness | in_transit | at_node | on_service | arrived | disruption`
- `nextObligation` — the fixed point that matters now, and its hard time
- `feasibility` — from current position: leave-by, band, the mode cascade, buffer left
- `onService` — when aboard: calling points, stops-to-go, your stop, live delay
- `alerts` — disruptions + knock-on consequences + options
- `navTarget` — where point-to-point would take you

The Today view is a **thin renderer** of `DayState`. No logic in the view — that
is what ends the patching.

## 3. Reconciling the plan with where you are (the careful bit)

The hard part is deciding "what matters now" from live position **without
guessing wrong**. Proximity is not commitment, and we must never silently
abandon something you might still intend to do. So reconciliation is
confidence-gated.

**Act silently only on high-confidence transitions:**

- **Arrived** — you *dwell* within an anchor's radius (not merely pass its
  time). Satisfied.
- **Effectively there** — you're within trivial reach of the next anchor (a
  short walk). The planned *method* stops mattering: we don't tell you to take
  the tube one block, or to "go back to go forward". Collapse the leg.
- **Boarding** — at the platform around departure, then moving with the
  service. On service.
- **On track** — moving along the planned route toward the next point. Stay
  quiet.

**Everything else is ambiguous — never guess; offer a fork:**

- **"Closer" is not progress.** Fifty miles out, you drive three miles to a
  shop — you're nearer the destination, but the station is back the other way
  and the train is still the method. The engine keeps computing the leave-by
  *from where you actually are, by the right method*; it never reads
  distance-reduction as commitment, nor as a skip.
- **Running late is not abandonment** — least of all for an appointment. It is
  not ours to assume you're not going. The buffer / feasibility cascade still
  runs (you may now need a taxi, or you'll be *N* late), but the obligation
  stands.
- When the engine genuinely can't reconcile where you are with the plan — you've
  persisted off-pattern, or you're between two plausible obligations — it asks a
  **fork**, not a guess: *"Still heading to the museum, or moving on to the
  station?"* **Persistence triggers it**: a quiet state first, and only if it
  continues do we put the decision to you. We can't know without you, so we ask —
  we never silently drop or reorder an obligation.

**Net:** feasibility (the from-here leave-by) is always live and
direction-agnostic; obligation *resolution* is conservative — silent only when
certain, a fork when not, and never an assumed abandonment. The **from** is
always current GPS.

## 4. The day as a state machine (what each phase shows)

- **At rest** — nothing imminent; the day at a glance.
- **Readiness** — a fixed point ahead. Quiet: *"Leave by 16:34 to make the 16:56
  from Luton — start navigation."* Only the leave-by updates, banded as the window
  closes.
- **In transit (self-powered)** — navigating to the node: inline 3D turn-by-turn;
  off-route + running-late detection.
- **At a node (boarding)** — the loud platform, the named train ("towards Corby"),
  the wrong-train guard, scan the Aztec.
- **On a service** — calling points with **stops-to-go** (*"Wellingborough in 3
  stops — get off next"*), your live position down the line, the live delay, and
  whether it threatens the next thing.
- **Arrived / between** — confirm, hand to the next obligation.
- **Disruption** — delay / cancellation / missed connection → options.

## 5. The four reactions

### A. You move (live position)
Recompute leave-by from where you are; confirm arrival by *dwell*; collapse the
next leg when you're effectively there; during nav, off-route → reroute. Where
position can't be reconciled with the plan, raise a **fork** (§3) — never an
assumed skip, never an assumed abandonment.

### B. Things go wrong (external)
Poll the next service's live status.
- **Delay** → recompute the connection; if a downstream fixed point (a connection,
  the meeting) is now at risk, surface it.
- **Platform change** → update the boarding callout loudly.
- **Cancellation** → next-service flow.
- **Knock-on propagation** — a slip on leg N shifts its arrival → re-test legs
  N+1… and the terminal obligation; surface the *worst* consequence and the options.

### C. You go wrong (running late / deviation)

As the window closes the engine narrows the buffer quietly. At the **feasibility
cliff** — the preferred mode no longer makes it — it stops deciding *for* you and
lays out the choice, because nothing is secured until you say so:

- **A faster mode is a proposal, not a switch.** *"Walking won't make the 16:56.
  A taxi will — it would need to leave by 16:22. Want us to arrange it?"* You can
  **accept** (we secure it — the booking seam — with its own leave-by) or
  **reject** it. Resource-aware: only modes you actually have (taxi / your car / a
  lift you set), never a bike you don't own.
- **Being late is a legitimate choice, not a failure.** If you'd rather just walk
  and be late, that's your call — we don't force a modality on you. The only
  question is *how* late and whether that's OK; a couple of minutes usually is.
  *"Walk it and you're ~8 min late — happy with that?"* (Some events carry an
  acceptable-lateness tolerance; within it we may not even ask.)
- **Event-aware help once you accept lateness:**
  - *Dinner / reservation* → surface the venue's number to call ahead (or offer to
    message), with the revised arrival.
  - *Meeting with someone* → offer to send them the updated ETA.
  - *Train* → the next service, with the ticket-eligibility check riding along
    (Anytime hops on; Advance may need a new/excess fare).
  - *Flight* → its own hard case (cut-offs) — escalated, not casually re-timed.
- **Override is always available.** Any automated feasibility call can be
  rejected; we re-evaluate from what's left. The engine proposes; you decide.

So the cliff is a **fork of real options** — arrange a faster mode, accept a known
lateness (helped), or take the next service — never a silent auto-decision. Lifts
only ever appear if you set one.

### D. Smooth sailing (the point of the product)
Quiet and delightful: cards stacked (now / next / ticket), scan and board,
stops-to-go, get off, walk the last bit. If the day goes right, you barely hear
from us.

## 6. Point-to-point navigation — first-class

A headline reason never to leave the app for Google Maps. From **where you are**
to the next point: the 3D heading-up FOV view, voice, offline corridor, reroute.
Inline from the next move, returning to Today. Open stack (Valhalla / Photon /
Protomaps), self-hostable. It has to be genuinely top-notch.

## 7. Architecture (an engine, not patches)

- **`src/lib/today/engine.ts`** — pure: `(plan, position, liveStatus, resources, now) → DayState`.
  Unit-tested without GPS or network, the way `leave-by.ts` / `feasibility.ts` /
  `projectToday` already are. It consolidates them.
- **Live data layer** — a position watcher + Darwin/TfL pollers (client hooks)
  feeding the engine; throttled, offline-aware.
- **Today view** — thin renderer of `DayState`.
- Reuses: leave-by + `checkPickup`, Darwin departures + **GetServiceDetails**
  (calling points), the nav stack + offline cache, the wallet/Aztec.

## 8. Gap analysis (have vs need)

**Have:** plan projection (`projectToday`), leave-by / feasibility primitives,
Darwin departures + platform + destination, the boarding callout, the nav stack +
offline, the wallet/Aztec.

**Missing:** continuous position watch wired to Today; skip / arrival detection;
on-service calling points + stops-to-go (Darwin `GetServiceDetails` — the parked
8/6/9 cluster); disruption + knock-on propagation; next-service / re-plan seam;
the ResourceState-driven mode cascade.

## 9. Build order

1. The pure `DayState` engine + the position-aware next-obligation resolver.
2. Wire continuous **live position** into Today — the "from" is you.
3. On-service tracking (`GetServiceDetails` → stops-to-go + arrival platform +
   changeover time).
4. Disruption + knock-on propagation (live status → downstream re-test).
5. Resource-aware mode cascade + next-service seam (+ notify-contact for meetings).
6. Navigation: already strong — integrate inline everywhere, keep it best-in-class.

## 10. Consequence for the bench

The bench stops being a fixed fictional script and a "feasibility test". It
renders the **plan view** driven by the engine, with the **from** taken from your
live location — so testing from Wellingborough routes *you → your real departure
point*, not a fictional Harpenden origin.

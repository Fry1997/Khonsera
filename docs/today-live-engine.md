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

## 3. The next-obligation resolver (the heart)

Picking "what matters now" is not "next anchor by clock". It reconciles
plan-time with live position:

- Walk fixed points in time order; the candidate is the earliest not yet satisfied.
- **Arrival** is confirmed by *dwelling* within a radius of an anchor, not by the
  clock passing — so we know you actually got there.
- **Skip detection** — if you're well past an anchor's time **and** far from it
  **and** closer to a *later* anchor, assume you've moved on: ask "skipped the
  museum?" and advance. We never nag about an abandoned stop while you're standing
  at the next one.
- The **from** is always current GPS.

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
Recompute leave-by from where you are; detect arrival (dwell) and skip (past +
far + nearer a later point); during nav, off-route → reroute.

### B. Things go wrong (external)
Poll the next service's live status.
- **Delay** → recompute the connection; if a downstream fixed point (a connection,
  the meeting) is now at risk, surface it.
- **Platform change** → update the boarding callout loudly.
- **Cancellation** → next-service flow.
- **Knock-on propagation** — a slip on leg N shifts its arrival → re-test legs
  N+1… and the terminal obligation; surface the *worst* consequence and the options.

### C. You go wrong (deviation)
The buffer → mode → next-service cascade: the buffer erodes (*"4 min left"*) →
preferred mode infeasible → next-fastest **available** mode (resource-aware) → no
mode → *"catch the next train?"* (rail) / *"tell them you're running late?"*
(a meeting). Lifts only appear if you set one.

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

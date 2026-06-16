# Navigation — Experience & Engineering Spec (Edition III, the elevation)

**Status:** spec / not yet built. **Owners:** Code (engines, data, seams) + Design (surface, modality,
motion). **Supersedes:** the "hand off to Google Maps" idea (D83 — navigation is a first-class in-app
tool). **Companion docs:** `docs/navigation.md` (what exists today), `docs/design/maps-capability.md`
(theme levers), `DECISIONS.md` D83–D85.

---

## 0. The bar

Two bars, both mandatory. We clear the table-stakes one *and* win on the second.

**Bar 1 — operational trust (match the Goliaths where it counts).** The moment-to-moment feeling that
"this is taking me the right way and it knows where I am" must equal Google/Apple Maps: fast position
lock, the dot glued to the road, the next manoeuvre unmistakable, instant honest re-route when you go
off-line, legible at a glance at arm's length in sunlight or a dark train. We are **not** matching their
*coverage* (POI graph, lane guidance, Street View) or — yet — **live road traffic** (we have no probe
network; that comes via a paid feed later, see §7). We do not pretend to. But the *craft* of the guidance
surface must feel first-class, not like a map bolted into a tab.

**Bar 2 — the concierge angle (beat them on the thing they can't do).** Every other nav app answers one
question: *"when will my car reach this point on the map?"* Ours answers a better one: ***"will I make my
day, and what do I do if I won't?"*** Our ETA is to **events**, not points. Our re-routing is triggered
not only by a wrong turn but by **falling behind**, by **a delayed train**, by **a connection about to
break** — and it doesn't just re-draw a line, it **makes a recommendation**. That is the product. Navigation
is where the concierge becomes real-time.

> Guiding rule (unchanged): **calm caution that carries consequence, never alarm.** The voice is Khonsera.
> No emojis. Honest about what's live vs estimated.

---

## 1. The core idea: event-aware ETA

A normal ETA is a function of `(position, route, speed) → clock at destination`. Ours adds the day:

```
EventETA(commitment) = arrival at the commitment's PLACE
                       via the chosen door-to-door route (walk/drive/rail/tube),
                       measured against the commitment's NEEDED-BY time
                       and its comfort buffer (per D77),
                       continuously re-derived from live position + live disruption.
```

The number the user sees is never a bare clock. It is a **relationship to their commitment**:

- *"Brixton 14:32 — 13 min before the 14:45 meeting."* (on track, the buffer is visible — D82)
- *"Brixton 14:48 — 3 min after. You'll be late; the 14:45 is the pinch."* (falling behind → consequence)
- *"Set off by 14:05 to keep your 12-min cushion."* (the decision-clock, back-calculated)

This reuses, verbatim, the engines that already exist:
- **`decisionClock(connections, now)`** (`src/lib/live/engine.ts`) — the single "act by" time.
- **`delayConsequence(connection, delayMin)`** — turns a delay into a sentence about the *next* commitment.
- **`cascade(connections, firstLegDelay)`** — ripples one delay across the whole remaining day.
- **`fragility(slacks)`** — "one delay from collapse?".
- Comfort buffers (`src/lib/itinerary/buffers.ts`) define "early enough".

**Navigation's job is to feed these engines a *live* position and *live* disruption, then surface their
output as the ETA + the decisions.** Today they're fed by scheduled times only; nav makes them live.

---

## 2. The living plan — falling behind triggers decisions

This is the loop that makes nav a concierge, not a renderer. It runs continuously during a navigation
session.

```
every position fix (and every live-disruption event):
  1. SNAP        position → the active route (guidanceTick / snapToRoute, src/lib/nav/guidance.ts)
  2. PROJECT     recompute the live door-to-door ETA to the NEXT commitment (and the chain beyond it)
  3. COMPARE     EventETA vs needed-by(+buffer) → slack now
  4. CLASSIFY    on-track | thinning | will-miss   (with the pinch-point named)
  5. ACT         if the classification crosses a threshold, raise ONE calm, confirmable decision
```

Triggers for step 5 (any of):
- **Pace** — GPS shows you slower than the route assumed; the cushion is eroding.
- **Off-route** — the existing `useGuidance` off-route detector (25/50/80 m walk/cycle/drive, sustained
  8 s) already auto-re-routes the *geography*; the elevation is to also re-run the **consequence** (does
  the detour still make the meeting?).
- **Disruption** — a Darwin train delay/cancellation or a TfL line suspension on a leg ahead (the live
  spine already detects these on `/plan/[id]`; nav consumes the same signals live).
- **A connection about to break** — `fragility` flips, or `decisionClock` goes tight.

Decisions are **recommendations, not just redraws**, sourced from the recovery engine
(`buildRecoveryOptions`, `rankFor` with a `ProtectTarget` of `earliest-arrival | protect-return |
least-disruption` — `src/lib/recovery/engine.ts`):
- *"The Victoria line's suspended ahead. Re-routing via the 38 bus gets you there 14:51 — you'd miss the
  14:45 by 6. Or hold for the line: unknown. **Take the bus?**"*
- *"You're 8 min behind. Drive the last leg instead of walking and you keep the meeting. **Switch to drive?**"*

Accept → the route + plan update (and the day re-solves downstream via the existing solver). Dismiss →
never nags again for the same event (the `nudge_states` pattern, D-care layer). Every option is honest
about uncertainty ("hold for the line: unknown") — never a fabricated certainty.

---

## 3. Modalities (the surface is multi-modal by design)

Navigation is not one map. It's a **session** that stitches modes and switches *representation* to suit
the leg you're on.

### 3a. Geographic turn-by-turn (exists, to be elevated)
Valhalla routing (`src/lib/nav/valhalla.ts`), `guidanceTick` engine, `useGuidance` (watchPosition, voice,
off-route reroute), `NavMap` (MapLibre). The elevation is **craft**: a proper full-screen guidance surface
(see §4), not the current inline 190px preview.

### 3b. The Underground / network modality (the USP — D83/D85)
When the active leg is the Tube, the map **folds** from geography into the **diagram** (Design D85):
streets desaturate and lift, lines straighten to 45°, the "you" dot travels continuously through the
**line/station graph**; one curtain-draw, ~560 ms, standard ease. **TfL canonical line colours are
honoured** (trusted wayfinding); Khonsera owns the ground, the type, and the single **gold "you" pulse**
+ a mono `ALIGHT IN 4 · BRIXTON` tab. Underground = no GPS, so position is **graph-relative** (dead-reckon
from board times / station dwell), not lat-lng. This is its own component fed by the line-graph data (§5).

### 3c. Multimodal stitching
A real journey is `walk → rail → tube → walk`. The session sequences legs and hands the active one to the
right modality (geographic vs network), carrying the event-ETA across the whole chain. The transit legs
come from the adapter seam beside `valhalla.ts` (TfL for London, OTP for national GTFS — `docs/navigation.md`).

---

## 4. The premium surface (Design owns; this is the brief shape)

Navigation is a **destination surface**, reachable as a first-class action (not a buried tab), entered
from any leg ("Take me there") and from the day-of Today view. It must hold these states to the bar:

- **Acquiring** — locating you (calm, never a dead grey screen).
- **Guiding (geographic)** — full-bleed map, the dot + heading, the **next manoeuvre banner** (turn now +
  the one after), distance-to-turn, the **event-ETA chip** (§1) always visible, a thin **consequence band**
  when the day is at risk.
- **Guiding (network/underground)** — the diagram modality (§3b).
- **Decision** — a calm, confirmable card when the loop (§2) raises one. One primary recommendation,
  the trade-off named, accept/dismiss.
- **Re-routing** — honest, fast, non-jarring ("Re-routing…" → new line, no flash).
- **Off-signal** — the cached route still draws (offline nav cache exists, `src/lib/offline/nav-cache.ts`);
  say so plainly.
- **Arrived** — closes the loop, returns to the day; "You made it — 11 min before."

Design references: `docs/design/maps-capability.md` (theme levers — route/casing/label slots already in),
the existing `next-leg-map.tsx` full-screen `FullLeg`, `ManeuverGlyph`, the speech cadence in `useGuidance`.
The bar for motion/clarity is Bar 1 (§0): glue, legibility, calm.

---

## 5. Data shapes (what Design asked Code to spec)

These are the contracts the surface designs against. All provider-gated (§7).

### 5a. Live position feed
```ts
type NavFix = {
  lat: number; lng: number;
  heading: number | null;     // degrees, null if unknown
  speedMps: number | null;    // for pace projection
  accuracyM: number;          // gate jitter; widen off-route thresholds when poor
  at: string;                 // ISO timestamp
  source: "gps" | "graph";    // "graph" = underground dead-reckon (no GPS)
};
```
Geographic legs: `navigator.geolocation.watchPosition` (already in `useGuidance`). Underground legs:
`source:"graph"` — position is a station-graph index + progress, dead-reckoned from board times.

### 5b. Route + leg model (extends existing `NavRoute`, `src/lib/nav/types.ts`)
```ts
type NavSession = {
  legs: NavLeg[];               // walk | drive | rail | tube … in order
  activeLegIndex: number;
  eventETAs: EventETA[];        // one per downstream commitment (§1)
};
type NavLeg = {
  mode: "walk" | "cycle" | "drive" | "rail" | "tube" | "bus";
  representation: "geographic" | "network";
  route?: NavRoute;             // geographic legs (Valhalla shape + maneuvers)
  network?: TubeLegPlan;        // network legs (§5c)
  scheduled: { departIso: string; arriveIso: string };
  live?: { delayMin: number; status: "on_time"|"delayed"|"suspended"|"cancelled" };
};
type EventETA = {
  commitmentId: string; name: string; place: string;
  neededByIso: string; bufferMin: number;       // from D77
  projectedArrivalIso: string;                  // live
  slackMin: number;                             // projected vs neededBy(+buffer)
  state: "on_track" | "thinning" | "will_miss";
  pinch?: string;                               // the leg/connection that breaks first
};
```

### 5c. TfL line + station graph (the underground modality)
```ts
type TubeGraph = {
  lines: { id: string; name: string; colorHex: string }[];   // TfL canonical colours
  stations: { id: string; name: string; lat: number; lng: number; lineIds: string[] }[];
  edges: { fromStationId: string; toStationId: string; lineId: string; runMins: number }[];
  interchanges: { stationId: string; walkMins: number }[];   // platform-to-platform
};
type TubeLegPlan = {
  boardStationId: string; alightStationId: string; lineId: string;
  via: string[];                  // ordered station ids for the diagram path
  stopsToAlight: number;          // "ALIGHT IN 4"
  liveLineStatus?: "good" | "minor" | "severe" | "suspended";  // TfL line status
};
```
Source: **TfL Unified API** (line status, station list, journey planner) — gated on `TFL_APP_KEY`; mock +
"· sample" cue when unset (the gating rule). The graph is largely static (cache it); only `liveLineStatus`
is live.

### 5d. Disruption inputs (already flowing on `/plan/[id]`, made live in nav)
- **Rail**: Darwin LDBWS (`liveDeparture`, gated `DARWIN_LDBWS_*`) → `delayMin`, cancellation.
- **Tube**: TfL line status → `liveLineStatus`.
- **Pace**: derived from `NavFix.speedMps` vs the leg's assumed speed.
These feed the §2 loop and the existing `cascade`/`delayConsequence`.

---

## 6. Architecture & seams (build on what exists — don't reinvent)

| Concern | Existing piece | Elevation |
|---|---|---|
| Geographic routing | `src/lib/nav/valhalla.ts`, `actions/nav.ts` | unchanged engine; self-host before traffic (§7) |
| Guidance loop | `src/lib/nav/guidance.ts` (`guidanceTick`,`snapToRoute`), `components/nav/use-guidance.ts` | add the **event-ETA projection + decision step** (§2) |
| Map render | `components/nav/nav-map.tsx`, `journey-map` themes | premium full-screen surface + network modality |
| Event consequence | `src/lib/live/engine.ts` (`decisionClock`,`delayConsequence`,`cascade`,`fragility`) | feed it **live** position/disruption, not just schedule |
| Recovery decisions | `src/lib/recovery/engine.ts` (`buildRecoveryOptions`,`rankFor`,`ProtectTarget`) | trigger from the nav loop, not just `/plan` |
| Care/nudges | `src/lib/context/engine.ts`, `nudge_states` | the dismiss-never-nag pattern for nav decisions |
| Transit | adapter seam beside `valhalla.ts` (TfL/OTP) | build the TfL adapter + the tube graph (§5c) |
| Offline | `src/lib/offline/nav-cache.ts` | the off-signal state (§4) |
| Buffers | `src/lib/itinerary/buffers.ts` (D77) | "early enough" in every EventETA |

**The one new thing to build is the orchestrator** — a *navigation session* that owns the leg sequence,
runs the §2 loop, projects EventETAs, and switches modality. Everything it calls already exists.

---

## 7. Provider posture & honesty (non-negotiable)

- **Self-host before real traffic**: Valhalla + Protomaps tiles + Photon + (when transit lands) OTP are on
  free/community instances today — env-var swaps to our own boxes. Pre-launch checklist, not optional.
- **Live road traffic** is the one true gap. We don't have it; we don't fake it. When we add it, it's a
  **paid feed** (Google/TomTom/HERE) behind an adapter — drive-leg ETAs gain traffic without touching the
  rest. Until then, drive ETAs are honestly "typical", and our *delay intelligence comes from rail/tube/pace*,
  which the Goliaths largely ignore — that's the trade we win.
- **Every external adapter self-gates** on its env var and returns mock + a "· sample" cue when unset — the
  build never blocks on a key, and an unset key never raises a false alarm. (TfL, Darwin, OTP, traffic.)
- **Honest live-vs-estimated** everywhere: a live board says so; a projection says "estimated"; underground
  dead-reckoning says it can't see live position.

---

## 8. Phasing (each phase ships a coherent slice)

- **N0 — EventETA core (no new UI).** The session orchestrator + EventETA projection wired from the existing
  geographic guidance + live spine. Proves the concierge ETA against a real walk/drive leg. *Unblocks the
  number that makes us different.*
- **N1 — Premium geographic surface.** The full-screen guidance states (§4) to Bar 1. Design-led.
- **N2 — The decision loop.** §2 triggers (pace/off-route/disruption) → recovery recommendations in nav.
- **N3 — Underground modality.** TfL adapter + tube graph (§5c) + the fold transition (§3b). The USP.
- **N4 — Multimodal stitching.** Full `walk→rail→tube→walk` sessions carrying one EventETA throughout.
- **N5 — Live traffic** (paid feed) — when commercially warranted.

**Unblocks Design now:** §4 (surface states) + §5 (data shapes) + §3b (modality) — Design can build the
network-mode component and the guidance surface against the real contracts here.

---

## 9. Definition of done for "premium" (the measurable bar)

A navigation session is premium when, on a mid-range phone, in real conditions:
1. Position locks in < 2 s and the dot stays glued to the route (no rubber-banding).
2. The next manoeuvre is unmistakable at arm's length; the voice prompt lands before the turn, once.
3. Going off-route re-routes within ~8 s **and** re-states the event consequence, not just the line.
4. The **event-ETA chip is always answerable**: the user can glance and know *if they make their day*.
5. A delay/disruption ahead produces **one** calm decision with a named trade-off — never a silent
   stale ETA, never an alarm.
6. It works to the barrier with no signal (cached route + honest "offline").
7. It never opens another app. If the day makes you leave Khonsera, this spec has failed.

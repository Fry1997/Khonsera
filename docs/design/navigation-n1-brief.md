# Navigation N1 — Design Brief (the premium guidance surface)

**For Claude Design.** Code→Design spec request per the protocol. The navigation *brain* is built and
tested (event-aware ETA + the decision loop); **N1 is the surface that shows it.** This brief binds your
components to the **real contracts** Code already exposes, so what you design plugs straight in.

**Read alongside:** `docs/navigation-experience-spec.md` (the full spec — esp. §0 the bar, §4 the
surface, §9 definition of premium), `docs/design/maps-capability.md` (map theme levers — route/casing/
label slots already in your hands).

---

## 1. What N1 is

The full-screen, first-class **guidance surface** for an active leg — not the 190px inline preview, not a
tab. It's where someone navigating a real leg lives. The bar (spec §0): **operational trust equal to
Google/Apple** (lock, the dot glued to the route, the next move unmistakable, instant honest re-route,
legible at arm's length in sun or a dark train) — **plus** our differentiator always on screen: the
**event-ETA** (will I make my day) and, when it matters, **one calm decision**.

Scope of N1: the **geographic** modality (walk/drive). The Underground fold is N3 (direction already set,
D85) — design N1 so the same chrome can host the network modality later.

---

## 2. The components to design — bound to real props

These are the live contracts (already built + unit-tested). Design the components; Code wires the data.

### A. `EventETAChip` — the number that makes us different (always on screen)
Bound to `EventETA` (`src/lib/nav/event-eta.ts`), one per upcoming commitment (lead one prominent):
```ts
EventETA = {
  name: string;            // "the 14:00 meeting"
  place: string;           // "Dancing Duck"
  projectedArrivalIso: string;
  spareMin: number;        // how early you land (neg = late) — the live D82 spare
  slackMin: number;        // margin vs your comfort buffer
  state: "on_track" | "thinning" | "will_miss";
  neededByIso: string; bufferMin: number;
}
```
It must answer at a glance: *do I make it, and by how much?* e.g. `BRIXTON · 14:32 · 13 MIN EARLY` (on
track) → `· 3 MIN LATE` (will_miss). Three states to style — `on_track` (calm/sage), `thinning`
(amber-ish, attention not alarm), `will_miss` (rust, still calm). This is the hero of the surface.

### B. `ManeuverBanner` — the next move (table-stakes craft)
The turn now + the one after, distance-to-turn, the road/step name. `ManeuverGlyph` already exists. Bar:
unmistakable at arm's length, the single most prominent thing while driving/walking a step.

### C. `DecisionCard` — the concierge moment
Bound to `NavDecision` (`src/lib/nav/decision-loop.ts`) — raised only when the day thins/breaks:
```ts
NavDecision = {
  severity: "calm" | "act";   // calm = informing; act = a choice to confirm
  headline: string;           // "Victoria line is cancelled ahead."
  consequence: string;        // "You'd reach the 14:00 meeting 15 min late."
  pinchName: string;
  recommendation?: {          // present on "act"
    option: { label: string; mode: "rail"|"tube"|"bus"|"taxi"|"walk"|"mixed";
              departIso: string; arriveIso: string; changes?: number; note?: string;
              consequence: string; makesIt: boolean };
    tradeoff: string;         // the honest impact (+ a return-threatened note)
  };
}
```
Two shapes: **calm** (a quiet band — headline + consequence, dismissible) and **act** (headline +
consequence + the recommended option + its trade-off + Accept / Dismiss). One recommendation, never a
wall of options. Calm caution that carries consequence — **never alarm, no emoji**. Dismiss must feel
final (it never re-nags — Code enforces via the decision `key`).

### D. The map frame
Full-bleed `NavMap` (MapLibre). The route/casing/label styling is **already yours** via the theme slots
(maps-capability brief) — N1 is the chrome *around* the map: chip, banner, decision, controls.

### E. Re-centre / overview / end controls
Standard nav affordances — re-centre on the dot, zoom-to-overview, end navigation (returns to the day).

---

## 3. The states to cover (spec §4)

| State | What it shows |
|-------|---------------|
| **Acquiring** | locating you — calm, never a dead grey screen |
| **Guiding** | map + `ManeuverBanner` + `EventETAChip` (+ a thin consequence line if the day's at risk) |
| **Decision** | the `DecisionCard` over the guiding surface (calm or act) |
| **Re-routing** | "Re-routing…" → new line, no jarring flash |
| **Off-signal** | the cached route still draws; say so plainly (offline is real — we cache routes) |
| **Arrived** | closes the loop: "You made it — 11 min before." → back to the day |

---

## 4. What's fixed (Code) vs yours (Design)

**Code owns:** MapLibre mechanics, GPS/snap/off-route detection + auto-reroute, *when* a decision is
raised + its copy source (the engines), the dismiss/never-renag logic, the data.

**Design owns:** the entire visual + motion language of the surface — the chip, banner, decision card,
controls, the state transitions, type, the route/casing/label theme values, and the **feel** that clears
the §9 premium bar. If you need a datum the contracts above don't carry, request it as a named field
(same as the map slot requests) and Code adds it.

---

## 5. Rules (non-negotiable)

- **Voice is Khonsera** — concierge, calm, factual; never a human name; **no emojis, ever**.
- **Honest live-vs-estimated** — a live board says so; a projection says "estimated"; offline says it.
- **Tokens, not raw values** — the app's `.cc-*` + token system (the map theme objects are the one
  documented exception). New shared values are token requests.
- **Calm carries consequence, never alarm** — even `will_miss` is stated levelly.

---

## 6. How to return

Same as prior rounds: a drop-in `.cc-*` skin (e.g. `khonsera-edition-iii-nav.css`, imported last) +
redlines naming the components/states above and any new token/field requests. Code wires the real
`EventETA` / `NavDecision` data into your markup. Optional: an HTML proof of the guiding + decision
states (like the map theme proof) so the feel is unambiguous.

**This unblocks you fully:** the data is real and tested; you're designing the surface over a working
brain, not a mock.

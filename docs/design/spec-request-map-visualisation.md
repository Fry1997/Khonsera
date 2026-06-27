# Spec Request: Map / journey visualisation

*Code → Design, per the Design↔Code Handoff Protocol §4a. Paste this into Claude
Design alongside the `theme` and the §3 contract entry ("Map / journey
visualisation — already built; Design themes it, doesn't rebuild").*

Version: 2026-06-27 · Medium: **Hybrid** (Design returns a styled real-map
reference + the values; Code owns the production implementation).

---

## Purpose & user context

The door-to-door **day map** is the hero of `/plan/[id]` ("THE ROUTE, DOOR TO
DOOR"), and the same component renders on `/today` and `/navigate`. It should
feel like a calm, premium, editorial **concierge map** — the kind you'd trust to
run your day. Right now it looks generic and busy.

**Why it looks wrong today (important — it's not the design, it's a switch):**
the screenshots are rendering the **raster OpenStreetMap fallback** (flat,
orange-road generic tiles), because the branded **vector basemap** is gated
behind `NEXT_PUBLIC_PMTILES_URL`, which is unset. The vector basemap (Protomaps
+ `protomaps-themes-base`, already built and brandable) is the real surface to
design. Connor is hosting the tiles; once the switch is on, the map renders the
palette below. **So Design is tuning a real vector map, not rescuing raster.**

## What Design is restyling (and what it is NOT)

Design themes two layers; it does **not** rebuild the map engine (MapLibre):

1. **The vector basemap palette** — land, water, parks/greens, roads (by class),
   buildings, rail, boundaries, and map labels. In code these are one object,
   `JourneyTheme.mapStyle` + brand `colors`, fed into Protomaps'
   `protomaps-themes-base` by `brandVectorTheme()`
   (`src/components/journey-map/map-style/brand-vector-theme.ts`). Recolouring a
   slot here recolours the whole map.
2. **Our overlays on top** — the route line (outbound vs return), the
   station/place markers, and the label badges (these are drawn by us in
   `journey-map.tsx`, not by the basemap).

## The "recreatable map" problem (Connor's instinct — correct)

A map mocked free-hand in an image tool produces a **fake, non-recreatable map**
(see inspiration #3: garbled labels "Cuiy", "Brotencs Flashold" — that's an AI
hallucinating cartography, not a real map). To return something Code can
reproduce **1:1**, mock against a **real Protomaps vector base**:

- **Recommended now:** open **Maputnik** (the free MapLibre style editor) with a
  **Protomaps `basemaps` style** pointed at a Protomaps `.pmtiles` (their public
  demo tileset or API). Recolour the layers live; the result is a real OSM-backed
  map. Export the colours → they map directly onto the slots below.
- **Once Connor hosts the tiles:** Design can style against a preview deploy with
  `NEXT_PUBLIC_PMTILES_URL=/api/basemap` set — i.e. the *actual* Khonsera map.
- **Do not** hand back a painted/AI map; we can't recreate it.

Because we start from Protomaps' `namedTheme("light")` (≈80 sane colour slots),
Design only needs to specify the **brand-carrying** slots; the rest inherit.

## The exact knobs (the contract — current `dusk` values are the starting point)

Design returns a value per slot for each theme (`dusk` = default warm cream;
`midnight` = dark; `sahara` = daylight ochre). Tune `dusk` first.

### Basemap palette — `JourneyTheme.mapStyle`
| Slot | Current (dusk) | What it paints |
|------|----------------|----------------|
| `land` | `#efe9da` | The ground / land fill |
| `landEdge` | `#e7e1d0` | Land tonal edge |
| `water` | `#b8c2a8` | Rivers, lakes, sea (today a sage-green) |
| `road` | `#fffefb` | Road fill |
| `roadStroke` | `#dcd2bb` | Road casing/outline |
| `rail` | `#d6cdb8` | Railway lines |
| `cityLabel` | `#3a342c` | Place/city label text |
| `countryLabel` | `#6e6557` | Region/country label text |
| `boundary` | `#9c917f` | Admin boundaries |
| `sky` / `skyHorizon` | `#aebccf` / `#ecdfca` | Sky + horizon (3D pitch) |

These also drive derived slots in `brandVectorTheme()`: parks/woods/scrub
(quiet greens off `water`), buildings (a shade of `land`), highways (warm
`goldMuted`), pedestrian areas, etc. Design can call out "greens warmer/cooler",
"buildings more/less contrast", "highways more/less gold" and Code maps it.

### Overlays — `JourneyTheme.colors`
| Token | Current | Where |
|-------|---------|-------|
| `gold` / `goldMuted` | `#9c6714` / `#b8893f` | Outbound route line; gold = **punctuation only** |
| `routeReturn` | `#1d6f73` | Return-leg line (cool teal, distinct from outbound) |
| `routeCasing` | `rgba(20,16,10,.62)` | Dark casing under the route so it lifts off pale roads |
| `markerFill` / `markerStroke` | `#a07520` / `#1a1612` | Station/place dots |
| `labelBadge` / `labelBadgeText` | `#1a1612` / `#fbf8f1` | The marker label pill (the black chips in the screenshot) |
| `labelHalo` | `#fbf8f1` | Halo behind map labels |

### Geometry — `JourneyTheme.geom`
`railWidth 2.8 · railGlowWidth 9 · casingWidth 5.5 · walkWidth 1.6 · walkDash
"2 5" · markerRadius 5 · originRadius 7`. Design can propose new weights/dash for
a lighter, more editorial route.

## Data it must display (real shapes)

- **Legs**, each with a `mode`: `rail` (solid), `road` (solid hairline), `walk`
  (dashed), `flight` (great-circle arc), `transit`, `ferry`; and a `direction`:
  `out` vs `back` (coloured distinctly so a round-trip doesn't overlap as one
  line).
- **Markers**: `origin` (home/base), `destination`, `intermediate` (changeovers
  / stations). Each has a short label — a station **code** ("WEL", "LEI") or a
  place name ("Wilce Avenue").
- Totals: `totalDistanceMi`, `totalDurationLabel` (available for an optional
  caption).

## States to cover

- Single road leg (home → one place) · multi-leg with changeovers (home → station
  → train → station → place) · round-trip (out + back, distinct) · a flight arc ·
  walk legs · empty (no routable legs → the map shouldn't render junk) · long
  labels · markers very close together (see known issue).

## Known issues to design around (Code is fixing the bugs; Design sets the look)

1. **Label-pill collision** — markers are left-anchored, so adjacent ones overlap
   ("WEL" over "ILCE AVENUE", "LEI" clipped). Design should specify marker +
   label treatment that survives crowding (e.g. dot-only with label on the side
   that has room, or a collision rule). Code wires the rule.
2. **Route weight** — the current line reads heavy. Design should set the
   editorial weight/casing/opacity (the inspirations use a thin, confident line).
3. **Phantom branch** — the western spur in the screenshot is a **data bug** (one
   leg stored a wrong route polyline); Code fixes it separately. Mock with a
   single clean route.

## Tokens & constraints

- **Tokens only.** Map colours live in the `JourneyTheme` objects (dusk /
  midnight / sahara) — that *is* the map's token set. Any new shared value Design
  wants becomes a new slot there (a token request back to Code), never a hardcode.
- Mobile-first; calm motion; **no emoji**; brand voice = **Khonsera**; gold is
  **punctuation, never a fill**.

## Return format (per §4b + Hybrid medium)

1. A **styled reference of a real Protomaps map** (Maputnik export or screenshot)
   for `dusk` — the visual contract.
2. The **values per slot** in the tables above (basemap palette + overlay colours
   + any geometry changes), so Code can drop them into `dusk.ts` /
   `brand-vector-theme.ts`.
3. The **marker + route treatment** (incl. the collision rule and route weight).
4. Optionally `midnight` / `sahara` deltas.
5. Any **new tokens** introduced, to register back into the theme.

## Once Design returns

Code maps the values into `themes/dusk.ts` (+ `brand-vector-theme.ts` derived
slots) and the overlay paint in `journey-map.tsx`. Connor sets
`NEXT_PUBLIC_PMTILES_URL=/api/basemap` + `PMTILES_UPSTREAM_URL` → the hosted R2
`.pmtiles`, and the day map renders the new look across `/plan`, `/today`,
`/navigate`.

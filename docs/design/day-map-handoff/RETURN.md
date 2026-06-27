# Spec Return: Map / journey visualisation — `dusk`

*Design → Code, per Handoff Protocol §4b · Hybrid medium · 2026-06-27*

This is the return for `uploads/spec-request-map-visualisation.md`. Design tuned
the **vector basemap palette**, the **route/marker/label overlays**, and the
**route geometry**. Code drops these values into `themes/dusk.ts` +
`brand-vector-theme.ts` and the overlay paint in `journey-map.tsx`. **No map
engine rebuild** — MapLibre + Protomaps stay as-is.

## Files in this folder
- **`Day Map.html`** — the live, recreatable reference. A real MapLibre +
  Protomaps vector basemap recoloured with the `dusk` values below, with our
  overlays drawn on top, and a state switcher (multi-leg · round trip · flight ·
  single road). Open it with network access and the hosted/demo `.pmtiles` to
  see the *actual* themed basemap; offline it falls back to an SVG treatment of
  the same overlay contract. **This is the visual contract — recreate it 1:1.**
- **`dusk-reference.png`** — static capture of the reference (overlay contract).
- **`spec-request-map-visualisation.md`** — the original request, for context.

> **Why a real map, not a painting:** per Connor's instinct (and spec §"The
> recreatable map problem"), the reference is themed against a genuine Protomaps
> vector base so Code reproduces it exactly. Nothing here is hand-painted
> cartography.

---

## 1. Basemap palette — `JourneyTheme.mapStyle` (`dusk`)

Drop these into `themes/dusk.ts`. Only the brand-carrying slots are specified;
the rest inherit from Protomaps `namedTheme("light")`.

| Slot | Current (dusk) | **Proposed** | What it paints |
|------|----------------|--------------|----------------|
| `land` | `#efe9da` | **`#efe9da`** *(keep)* | Ground / land fill |
| `landEdge` | `#e7e1d0` | **`#e8e2d1`** | Land tonal edge |
| `water` | `#b8c2a8` | **`#c4cfd4`** | **Was sage-green → calm pale slate-blue.** Water should read as water, not parkland. |
| `road` | `#fffefb` | **`#fdfcf8`** | Road fill |
| `roadStroke` | `#dcd2bb` | **`#e1d9c7`** | Road casing/outline |
| `rail` | `#d6cdb8` | **`#cdc2ab`** | Railway lines (basemap, not our route) |
| `cityLabel` | `#3a342c` | **`#33302a`** | Place/city label text |
| `countryLabel` | `#6e6557` | **`#6e6557`** *(keep)* | Region/country label text |
| `boundary` | `#9c917f` | **`#b4a995`** | Admin boundaries (quieter) |
| `labelHalo` | `#fbf8f1` | **`#fbf8f1`** *(keep)* | Halo behind map labels |

### Derived slots (in `brandVectorTheme()`) — set explicitly
The spec notes these are *derived* from the base palette. Design pins them:

| Derived slot | **Proposed** | Note |
|------|--------------|------|
| `park` / woods / scrub | **`#dde2cd`** | **Greens live HERE (warm muted sage), off `water`** — not the other way round. |
| `building` | **`#e7e0ce`** | A shade of `land`, low contrast |
| `buildingOutline` | **`#ddd4bf`** | |
| `highway` (major roads) | **`#efe4cf`** | **Warm sand, NOT gold.** Gold is reserved for the route overlay only. |

**Direction notes for Code's derived-slot maths:** greens slightly warmer than
current; buildings low-contrast (barely above land); highways warm sand, never
gold.

---

## 2. Overlays — `JourneyTheme.colors`

Drawn by us in `journey-map.tsx`, over the basemap.

| Token | Current | **Proposed** | Where |
|-------|---------|--------------|-------|
| `gold` | `#9c6714` | **`#9c6714`** *(keep)* | Outbound route line. **Punctuation only.** |
| `goldMuted` | `#b8893f` | **`#b8893f`** *(keep)* | Route glow / walk-leg dashes |
| `routeReturn` | `#1d6f73` | **`#1d6f73`** *(keep)* | Return-leg line — cool teal, distinct from outbound so a round-trip never reads as one line |
| `routeCasing` | `rgba(20,16,10,.62)` | **`rgba(20,16,10,.46)`** | Dark casing under the route. Lighter than current — lifts off pale roads without reading heavy. |
| `markerFill` (origin/dest) | `#a07520` | **`#9c6714`** | Origin / destination dot — gold punctuation |
| `markerFillMid` (changeover) | — | **`#1a1612`** | **NEW intent:** changeover/intermediate dots are **ink**, not gold — only the ends carry gold. |
| `markerStroke` | `#1a1612` | **`#fbf8f1`** | Marker ring is now the **paper halo** (`#fbf8f1`), so dots sit on a clean ring above the map |
| `labelBadge` | `#1a1612` | **`#1a1612`** *(keep)* | Marker label pill |
| `labelBadgeText` | `#fbf8f1` | **`#fbf8f1`** *(keep)* | Pill text |
| `labelHalo` | `#fbf8f1` | **`#fbf8f1`** *(keep)* | Halo behind map labels |

---

## 3. Geometry — `JourneyTheme.geom`

A lighter, more editorial line. Proposed vs current:

| Key | Current | **Proposed** |
|-----|---------|--------------|
| `railWidth` | 2.8 | **2.2** |
| `railGlowWidth` | 9 | **6** |
| `casingWidth` | 5.5 | **4** |
| `walkWidth` | 1.6 | **1.6** *(keep)* |
| `walkDash` | `"2 5"` | **`"1 4"`** (finer, more dotted) |
| `markerRadius` | 5 | **4.5** |
| `originRadius` | 7 | **6.5** |

---

## 4. Marker + route treatment (the rules Code wires)

1. **Two marker tiers.** Ends (origin + destination) are the larger **gold** dot
   (`originRadius`, `markerFill` gold). Intermediates/changeovers are the smaller
   **ink** dot (`markerRadius`, `markerFillMid`). Both sit on a paper halo ring
   (`markerStroke` `#fbf8f1`) so they read on any basemap colour.
2. **Label-pill collision rule (fixes the WEL/ILCE-AVENUE overlap).** Pills are
   **not** hard left-anchored. Default side is the one with more room; when two
   markers are within a collision radius, the closer-to-edge marker drops to
   **dot-only** (no pill) or flips its pill to the open side. Ends keep their
   pill preferentially; intermediates yield first. Code owns the collision test;
   this is the visual rule.
3. **Route weight.** Thin, confident line (geometry above). Casing is the lighter
   `routeCasing`; the gold sits on top at `railWidth`. The glow (`railGlowWidth`,
   `goldMuted`, blur ~4, opacity ~.4) is a soft lift, not a halo.
4. **Direction colour.** Outbound = `gold`; return = `routeReturn` teal. A
   round-trip bows the two legs apart so they never overlap as a single stroke.
5. **Leg modes.** `rail`/`road` solid; `walk` dashed (`walkDash`, `goldMuted`);
   `flight` a great-circle **dashed gold arc** (same dash as walk, gold). Single
   hairline for `road`.
6. **Empty state.** No routable legs → render the calm basemap centred on the
   day's anchor; **draw no route junk** (no phantom branch — that western spur in
   the old screenshots is a Code data bug, mocked clean here).

---

## 5. `midnight` / `sahara` deltas (optional, not yet tuned)

Only `dusk` is tuned per the spec ("Tune `dusk` first"). Direction for the other
two when Code/Design get to them:

- **`midnight`** (dark): `land` → deep ink (`#1a1714`-ish), `water` → darker
  slate, labels → warm cream (`#e8e2d1`), route gold unchanged (it pops on dark),
  return teal lifted ~10% lightness, casing → a light glow instead of dark.
- **`sahara`** (daylight ochre): warmer `land` (`#f3ead4`), `water` a touch
  greener-blue, highways a hair more sand — but **still not gold**.

These are deltas to register as their own theme objects; not part of this return.

---

## 6. New tokens introduced (register back into the theme)

- **`colors.markerFillMid`** (`#1a1612`) — the ink changeover-dot fill. Currently
  the theme has a single `markerFill`; the two-tier marker treatment needs this
  second slot. **Token request back to Code.**

Everything else maps onto existing `JourneyTheme` slots.

---

## Once Code maps this in
Code drops §1–§3 into `themes/dusk.ts` (+ derived slots in
`brand-vector-theme.ts`), wires §4's collision rule and leg-mode paint in
`journey-map.tsx`, and registers `markerFillMid` (§6). Connor sets
`NEXT_PUBLIC_PMTILES_URL=/api/basemap` + `PMTILES_UPSTREAM_URL` → the hosted R2
`.pmtiles`. The day map then renders this look across `/plan`, `/today`,
`/navigate`.

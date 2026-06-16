# Maps — What Design Can Play With

**Handoff brief for Claude Design.** Per the Design↔Code protocol, Design and Code share no memory,
so this is the canonical "controllable surface" for the maps. It says what you can move, what's
fixed (Code-owned mechanics), and the current values as your starting point. Return changes as
**named-slot values** (e.g. `routeReturn: "#1b6566"`) and Code drops them straight into the theme
files — no code reading required on your side.

---

## 1. How the map is built (one paragraph)

The day map is **MapLibre GL**. The streets/water/labels underneath are the **basemap**; our journey
(route lines + station/place markers) is an **overlay** drawn on top. There are **two basemaps**:
the default **raster OSM** (always on, no key) and an opt-in **premium Protomaps vector** basemap
(branded, 3D buildings + terrain). The overlay is identical on both. Everything visual reads from a
**theme object** — there are three themes: **dusk** (warm cream, default), **midnight** (dark),
**sahara** (daylight ochre). You edit the theme; Code owns the MapLibre wiring.

Files (for Code; you don't edit these — you return values):
`src/components/journey-map/themes/{dusk,midnight,sahara}.ts`.

---

## 2. The levers you control (per theme)

### A. Route lines — `colors`
The journey is drawn as coloured lines. **Outbound and return are now coloured separately** (they used
to overlap as one gold line). A crisp **casing** (outline) is drawn under each line so it stands off
the road.

| Slot | What it is | dusk | midnight | sahara |
|------|-----------|------|----------|--------|
| `gold` | **Outbound** route (away from base) | `#9a6a12` | `#e0a84e` | `#9a6815` |
| `routeReturn` | **Return** route (heading home) | `#1f6f73` | `#5cc2cf` | `#1b6566` |
| `routeCasing` | Outline drawn UNDER the route (contrast vs roads) | `rgba(20,16,10,0.55)` | `rgba(0,0,0,0.55)` | `rgba(32,24,14,0.5)` |
| `goldGlow` | Soft glow under rail lines | `rgba(160,117,32,0.18)` | `rgba(212,160,77,0.22)` | `rgba(168,120,38,0.20)` |

**Open question for you:** outbound-gold vs return-teal is a sensible default we set — refine the two
hues and the casing weight/opacity to taste. The constraint: the two directions must stay clearly
distinct, and both must read against the warm basemap roads.

### B. Line geometry — `geom`
| Slot | Meaning | current (all themes) |
|------|---------|------|
| `railWidth` | rail line thickness | `2.5` |
| `railGlowWidth` | glow thickness | `9` |
| `walkWidth` | walk line thickness | `1.5` |
| `walkDash` | walk dash pattern | `"2 5"` |
| `markerRadius` | intermediate marker dot | `5` |
| `originRadius` | origin (home) dot | `7` |

(Code currently renders rail at width 3, walk dashed at 2, road at 2.5, casing at 5 — these can be
moved to `geom` slots if you want to own them; tell us.)

### C. Markers & labels — `colors`
Station codes / appointment / place names now render as a **solid badge** (so they sit above basemap
town names — "WEL" no longer lost in "Wellingborough"). The badge currently uses:
| Slot | Role | dusk | midnight | sahara |
|------|------|------|----------|--------|
| `markerFill` | destination dot / intermediate ring | `#a07520` | `#d4a04d` | `#a87826` |
| `markerStroke` | origin ring **+ label badge ground** | `#1a1612` | `#f4e8cf` | `#20180e` |
| `labelHalo` | **label badge text** | `#fbf8f1` | `#2a2030` | `#f7f0db` |
| `labelText` | (legacy bare-text colour, now unused on badges) | `#3a342c` | `#e0d4bc` | `#3a2e1c` |

**Note:** on midnight the badge currently inverts (light ground, dark text) because `markerStroke`
is light there — confirm that's the look you want, or give us a dedicated `labelBadge`/`labelBadgeText`
pair if labels should be styled independently of the marker dots.

### D. Basemap palette — `mapStyle` (the streets underneath)
This is the whole look of the map *under* the route. All editable per theme:
| Slot | dusk | midnight | sahara |
|------|------|----------|--------|
| `water` | `#b8c2a8` | `#1a2a28` | `#c2ccb0` |
| `land` | `#efe9da` | `#2a2030` | `#f3e8c8`* |
| `landEdge` | `#ede7d8` | `#352b3e` | … |
| `rail` | `#d6cdb8` | `#4a3f55` | … |
| `road` | `#fffdf9` | `#332940` | … |
| `roadStroke` | `#d8cfb8` | `#3e3448` | … |
| `cityLabel` | `#3a342c` | `#e0d4bc` | … |
| `countryLabel` | `#6e6557` | `#9a8e7a` | … |
| `boundary` | `#9c917f` | `#5a4f65` | … |

This is where you can push the basemap further from the route (e.g. desaturate/lighten roads) if the
route-vs-road contrast still isn't enough after the casing.

### E. Premium vector basemap (optional, opt-in)
If we self-host Protomaps vector tiles, there's a second, richer brand theme
(`brand-vector-theme.ts`) with full control of every map layer's colour + 3D buildings + terrain.
Currently off by default (raster OSM). Flag if you want to design against the vector basemap — it's
the path to full brand control of the map's look.

---

## 3. What's fixed (Code-owned — not design levers)

- **MapLibre mechanics** — pan/zoom, the `khnav://` cache protocol, tile loading, offline.
- **Direction logic** — *which* legs are "out" vs "back" is computed (a leg is "back" when it ends
  closer to the day's base). You colour them; you don't decide the split.
- **Label badge structure** — it's an HTML element (ground + text + shadow). You set the colours via
  the slots above; the box/shadow shape is Code's (tell us if you want those as tokens too).
- **Marker dot shapes** (bullseye origin, filled destination, ringed intermediate) — structure fixed,
  colours yours.

---

## 4. The big one coming — the Underground modality (D83)

Founder direction: navigation is being elevated to a **first-class in-app experience**, and the USP is
a **different map modality when you enter the Underground** — you leave the geographic street map and
enter a **tube-network representation** where you watch yourself move through the line/station graph
(think the iconic diagrammatic tube map, animated to your position). This is **not built yet**, but
it's the next major map surface. Worth Design starting to think about now:
- a distinct visual language for "network mode" vs "geographic mode" (and the transition between them),
- line colours (TfL has canonical line colours — do we honour them or rebrand to dusk/midnight/sahara?),
- the "you are here / next interchange" treatment on a diagrammatic map.

If you want, Code can spec the data we'll have (TfL line + station graph, live position) so you design
against the real shape.

---

## 5. How to return changes

Reply with named-slot values per theme, e.g.:

```
dusk.colors.routeReturn = "#2a7d6f"
dusk.colors.routeCasing = "rgba(20,16,10,0.65)"
dusk.mapStyle.road = "#fffefb"   // lighten roads further from the route
```

Code drops them into the theme files verbatim — zero ambiguity, no code on your side. New slot
requests (e.g. a dedicated `labelBadge`) are welcome — name it and say what it's for, Code adds it.

> **Token note:** the map theme objects are the *documented exception* to the app's "tokens only, never
> raw hex" rule (they're a separate map-rendering values-holder). So raw hex is fine **here** — but
> only inside these theme files, via these named slots. Don't introduce map colours anywhere else.

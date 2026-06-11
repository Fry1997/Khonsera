# Point-to-Point Navigation

Build spine §6. A fully open-source door-to-door navigation system: pick any two points
(stations, saved places, addresses, GPS), get a turn-by-turn route, follow it live, and —
the part the others don't do — **save it to the device so the whole thing works with zero
signal** at the platform.

## Stack — open source end to end, self-hostable by env var

| Concern | Engine | Endpoint (env var) | Default |
|---|---|---|---|
| Routing (walk/cycle/drive) | [Valhalla](https://github.com/valhalla/valhalla) | `VALHALLA_URL` | FOSSGIS community instance (`valhalla1.openstreetmap.de`) |
| Free-text geocoding | [Photon](https://github.com/komoot/photon) (OSM) | `PHOTON_URL` | `photon.komoot.io` |
| Rendering | MapLibre GL + OSM raster tiles | — | (Protomaps upgrade path, as JourneyMap) |

Both public instances are community-run with fair-use policies — fine for development and
small scale. **Before real traffic, self-host both** (each is a single Docker container +
an OSM extract) and point the env vars at them. No code change needed.

All provider calls go through server actions (`src/lib/actions/nav.ts`) so the public
instances see one origin, and swapping to self-hosted needs no client release.

## Architecture

```
src/lib/nav/                      — provider-agnostic core (pure, unit-tested)
  types.ts                        — NavRoute / NavManeuver / NavPoint / SavedNavRoute
  valhalla.ts                     — request builder + response→NavRoute mapper
  shape.ts                        — encoded-polyline decoder (precision 5 AND 6 — Valhalla is 6)
  guidance.ts                     — snap-to-route, maneuver progression, off-route, formatters
  tiles.ts                        — slippy-tile math + corridor enumeration for offline save
src/lib/actions/nav.ts            — fetchNavRoute (Valhalla), geocodeSearch (Photon)
src/lib/offline/nav-cache.ts      — IndexedDB `khonsera-nav`: routes + tile blobs (refcounted)
src/components/nav/
  navigate-screen.tsx             — plan + guidance UI, saved-routes list
  nav-map.tsx                     — MapLibre surface; khnav:// tile protocol (IDB-first)
  endpoint-search.tsx             — unified suggest: GPS / hubs / saved places / OSM geocode
  use-guidance.ts                 — watchPosition + voice + auto re-route around the pure engine
src/app/(app)/navigate/page.tsx   — the surface; deep-link ?dlat=&dlng=&dname=
```

A transit provider (TfL for London, OTP national) slots in beside `valhalla.ts` mapping to
the same `NavRoute` shape — the UI and guidance engine never see provider JSON.

## Behaviour

- **Plan**: from/to via one search box each (current location, transport hubs with CRS
  codes, the user's saved places/client sites, then Photon for pubs/addresses/anything,
  all proximity-ranked when an anchor is known). Mode: Walk / Cycle / Drive. Route renders
  gold-on-paper with the full maneuver list and stroke glyphs (no emojis, ever).
- **Guidance camera**: follow mode is a Google-Maps-style nav view — zoomed to the street
  (17.5), pitched 55°, **heading-up** (the map rotates so travel direction is "up"), dot kept
  low so the road ahead has room. A gold **FOV cone** (canvas image on a map-aligned symbol
  layer, `nav-map.tsx`) shows which way you face. Heading comes from `use-heading.ts` — the
  device **compass** (`webkitCompassHeading` / absolute `deviceorientation`), so orientation
  shows even standing still; it falls back to GPS course. iOS gates the compass behind a
  permission requested on the Start tap. The cone rotates every frame (cheap source update);
  the camera is throttled to ~3/s so the compass can't thrash it.
- **Guidance**: `watchPosition` → pure `guidanceTick` (snap to line with a no-rewind
  look-back, distance to next maneuver, remaining distance/time, arrival inside 25m).
  Spoken instructions via SpeechSynthesis (`en-GB`, muteable) as each maneuver comes
  within ~80m. Off-route beyond a mode-specific threshold (50m walk / 75 cycle / 100
  drive), sustained 12s while online → automatic re-route from the live fix (30s
  cooldown). Offline you keep the saved line and watch yourself rejoin it.
- **Save offline**: pins the route JSON plus a corridor of map tiles — z13+z15 along the
  whole line (250m buffer) and z16 around every maneuver point, deduplicated and
  hard-capped at 400 tiles (coarse zooms win the trim so the whole route stays mapped).
  Tiles are refcounted per saved route; deleting a route sweeps tiles no other route
  claims. The cap + corridor shape is deliberate respect for the OSM tile policy — this
  saves a ribbon, never an area.
- **Offline rendering**: NavMap's tiles flow through a custom MapLibre protocol
  (`khnav://z/x/y`) that reads IndexedDB first and falls back to the network — so a saved
  route paints with no signal and online browsing is unchanged. The service worker (which
  never touches cross-origin) is not involved; tile offline-ness lives entirely in the
  protocol + IndexedDB.
- **Deep link**: `/navigate?dlat=…&dlng=…&dname=…` pre-fills the destination — the seam
  for "take me there" buttons on anchors/legs.

## Today integration — true leave-by + Navigate

Today consumes the router as the day-of brain (`src/app/(app)/today/page.tsx`):
- **True leave-by** (`src/lib/planning/leave-by.ts`, pure + tested): `leaveBy = arriveBy −
  travel − buffer`. The `NextMove` hero card (`src/components/today/next-move.tsx`) routes
  from the device's live GPS to the next anchor via `fetchNavRoute` and back-calculates the
  door time, with a live countdown + urgency. It shows the plan's computed leg time
  immediately and only upgrades to live GPS when permission is **already** granted — Today
  never pops a location prompt on load; consent lives behind a Recheck/Navigate tap.
- **The spine** (`src/components/today/today-spine.tsx`): the whole day threaded on the
  `.cc-spine` rail with a live NOW pulse that ticks every 30s — done anchors recede (dimmed,
  above the line), the next is lifted, the rest wait below. Every anchor with coordinates
  carries a **Navigate** link → `/navigate?dlat&dlng&dname`.
- Coordinates + leg travel times come from the existing stop joins
  (location/customer_site/transport_hub) and the plan's transitions — no new tables.

## Premium basemap — Protomaps vector (optional, one env var)

By default the basemap is raster OSM (always works, no key). Set
`NEXT_PUBLIC_PMTILES_URL` to a Protomaps **v4** `.pmtiles` archive and the whole app
(NavMap + JourneyMap) switches to a **vector** basemap — smooth zoom/rotation, crisp
labels at any pitch, branded to the dusk/midnight/sahara palettes, with **3D buildings**
and **terrain/hillshade**. Fully open-source, all self-hostable.

- **Build**: `src/components/journey-map/map-style/build-vector-style.ts` uses
  `protomaps-themes-base` (the maintained v4 layer set) themed by `brand-vector-theme.ts`
  (the Khonsera palette mapped onto Protomaps' colour slots — one source of colour truth).
  3D = a `fill-extrusion` on the `buildings` layer (`height`/`min_height`, small default).
  Terrain = a free AWS terrarium DEM (`NEXT_PUBLIC_TERRAIN_URL`, `off` to disable).
- **Tiles**: the `pmtiles` lib reads the archive by HTTP range; `PMTiles.getZxy` returns
  decoded PBF. Both online and offline flow through the shared cache-aware `khnav://`
  protocol (`pmtiles-source.ts`) — IndexedDB first, then the archive. Saved-route corridors
  pin **vector PBF** tiles (separate `khonsera-nav-v` IndexedDB so it never mixes with raster
  bytes). Protomaps tops out at z15; MapLibre overzooms beyond.
- **Hosting**: the default URL is the Protomaps **demo bucket** — fair-use/dev only. For
  production, self-host a regional `.pmtiles` extract (one file) + the glyph/sprite assets,
  and point the env var at it. Same posture as Valhalla/Photon.
- **Offline labels/terrain**: glyphs, sprites and the DEM are not corridor-cached, so a
  saved route offline renders geometry + buildings but may drop labels/relief. The route
  line and your position always draw.

## Limits / next steps

- **Transit legs** (TfL first, then OTP/GTFS national) — the locked plan; the provider
  seam is ready. Today's leave-by treats transit hops as a walk fallback until then.
- The FOSSGIS Valhalla instance has no SLA; production wants the self-hosted pair above.
- Re-routing requires signal (routing is server-side by design); the offline fallback is
  the saved line, which covers the planned-ahead scenario.
- The per-anchor buffer is a flat default (`DEFAULT_BUFFER_MIN`); readiness back-calc
  (spine §4) can make it anchor-specific later.

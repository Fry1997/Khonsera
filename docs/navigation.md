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

## Limits / next steps

- **Transit legs** (TfL first, then OTP/GTFS national) — the locked plan; the provider
  seam is ready.
- The FOSSGIS Valhalla instance has no SLA; production wants the self-hosted pair above.
- Re-routing requires signal (routing is server-side by design); the offline fallback is
  the saved line, which covers the planned-ahead scenario.
- Wire "take me there" deep links from AnchorCard / leg views.

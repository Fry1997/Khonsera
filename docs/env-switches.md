# Environment Switches — "the supply is built, the switch is off"

**Why this doc exists.** Khonsera follows a strict **provider-gating rule** (see CLAUDE.md): every
external adapter self-gates on its env var and **degrades quietly** to a mock / fallback / cheaper
path when the var is unset. The build *never* blocks on a missing key. That's deliberate and good —
but it has a failure mode: a feature can be **fully coded and shipped, yet silently render in its
budget fallback** because a switch is off. No error, no crash — it just looks or feels worse than
it is. (This bit us twice: the vector basemap rendering as raster OSM, and the "To" geocode taking
40 s on the Photon fallback.)

This is the one place that lists **every switch, its default-when-unset behaviour, and what to set
to light it up**. Check Tier 1 first whenever something "looks/feels un-premium but the code is
clearly there."

> Scope note: `process.env` is read at **build time** for `NEXT_PUBLIC_*` (client) vars — those must
> be set on the deployment **before** the build, and a change needs a redeploy. Server vars are read
> at request time.

---

## Tier 1 — Silent quality degradation (the ambush class)

These have **no "· sample" cue** and throw no error. The feature works, just in a worse mode. If the
app feels budget, look here first.

| Env var | Gates | Unset → (the silent fallback) | Set it to |
|---|---|---|---|
| **`NEXT_PUBLIC_PMTILES_URL`** | The **vector basemap on every map** (day map + nav): crisp labels, brand styling, **sky/atmosphere, 3D buildings**. This is the master *on-switch* — `vectorEnabled()` is false until it's set. | **Raster OpenStreetMap.** Flat, generic tiles. No sky, no 3D buildings, no brand colours — on *all* maps. | `/api/basemap` (the same-origin proxy). Client var → **redeploy** after setting. |
| **`PMTILES_UPSTREAM_URL`** | The **supply** behind `/api/basemap` — where the proxy fetches the `.pmtiles` archive (our R2 bucket). | The proxy auto-resolves a **fair-use Protomaps** build (works, but not self-hosted → not for real traffic). | The R2 (or other CDN) URL of the hosted `.pmtiles`. *Distinct from the switch above — supply vs. demand.* |
| **`GOOGLE_MAPS_API_KEY`** | **Fast geocoding** (Places Text Search) for the nav "To"/"From" box, plus **Google Routes** and **Static Maps**. | **Public Photon/komoot** geocode — slow (~10–20 s, time-boxed to 6 s) and patchy. Routes/Static degrade too. | A Google Maps Platform key (Places API New + Routes + Static enabled). Server var. |
| `VALHALLA_URL` | Walking/cycling/driving **route geometry**. | The **FOSSGIS community** instance (`valhalla1.openstreetmap.de`) — fair-use, fine for dev, **self-host before real traffic**. | Your self-hosted Valhalla URL. |
| `PHOTON_URL` | The **no-key geocode fallback** itself. | Public komoot (`photon.komoot.io`) — slow/fair-use. Only used when `GOOGLE_MAPS_API_KEY` is unset. | Your self-hosted Photon (or just set the Google key and ignore this). |
| `NEXT_PUBLIC_TERRAIN_URL` | **3D terrain** (a terrarium DEM) under the vector basemap. | Terrain **off** (flat). Buildings still render; only the ground relief is absent. | A terrarium DEM tile URL. Client var → redeploy. Needs the vector basemap on. |

**Production "make it premium" checklist:** set `NEXT_PUBLIC_PMTILES_URL=/api/basemap`,
`PMTILES_UPSTREAM_URL` → R2, and `GOOGLE_MAPS_API_KEY`. Those three close the gap between "the code
is there" and "it looks/feels finished."

---

## Tier 2 — Gated live providers (honest mock until keyed)

These degrade to **mock/sample data with a visible "· sample" cue** (or simply return nothing), so
they're *less* of an ambush — you can see it's not real. Each is inert until its key is set. See
CLAUDE.md "Live & contextual layer" + "Connections / booking" for the engines they feed.

| Env var(s) | Provider / feature | Unset → |
|---|---|---|
| `DARWIN_LDBWS_TOKEN` / `DARWIN_LDBWS_KEY` / `DARWIN_LDBWS_ENDPOINT` | **Darwin** live rail (decision clock, delay/cascade, recovery boards) | No live rail signal; engines degrade silently |
| `TFL_APP_KEY` / `TFL_API_BASE` | **TfL** live London status | No live London signal |
| `OTP_URL` / `OTP_GRAPHQL_PATH` | **OpenTripPlanner** cross-network transit detours | Inert until self-hosted (`docs/otp-self-hosting.md`) |
| `DRAGONPASS_KEY` | **DragonPass** fast-track + lounge nudges | Mock voucher/pass with "· sample" |
| `PARKOPEDIA_KEY` | **Parkopedia** car-park outlook nudge | Mock outlook |
| `AERODATABOX_KEY` / `AERODATABOX_URL` | **AeroDataBox** gate info (gate-change reroute) | Mock gate |
| `AVIATIONSTACK_API_KEY` / `AVIATIONSTACK_BASE_URL` | Flight status | Mock / none |
| `DUFFEL_API_TOKEN` / `DUFFEL_URL` | **Duffel** flights (+ stays) — search/compare/book | `duffel_test_…` → test mode (no charge); unset → mock. Stays 403 → mock |
| `OPEN_METEO_URL` | **Open-Meteo** weather (weather→leave-earlier nudge) | **Keyless real** by default (public endpoint); var only overrides the host |
| `FX_URL` | Currency conversion | Defaults to public `frankfurter.app` |
| `COLLINSON_KEY` | Collinson (dormant long-term airport-experience target) | Dormant — not wired |
| `ASSERTIS_KEY` | Assertis rail booking | Pending — not wired |

---

## Tier 3 — Required infrastructure (not a "switch")

The app genuinely depends on these; they're not graceful-degradation switches.

| Env var(s) | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client (DB/Auth/RLS) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_GMAIL_REDIRECT_URL` / `GOOGLE_OAUTH_REDIRECT_URL` | Google OAuth for Gmail import + Calendar |
| `NEXT_PUBLIC_APP_URL` | Absolute-URL base for callbacks/links |

*(`SUPABASE_TEST_URL` / `SUPABASE_TEST_ANON_KEY` / `SUPABASE_TEST_SERVICE_ROLE_KEY` are test-harness
only — never set in production.)*

---

## When you add a new adapter

1. Self-gate on the env var; return `null`/mock when unset (never throw, never block the build).
2. If unset renders a **fallback that looks real**, it belongs in **Tier 1** here — add the row.
3. If unset shows an honest **"· sample"** cue or nothing, it's **Tier 2** — add the row.
4. Keep the `· sample` cue honest: an unset key must never raise a false *live* alarm.

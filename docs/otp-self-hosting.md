# Self-hosting OpenTripPlanner (OTP2) — alternative-route recovery

OTP is the **route-alternative** engine behind disruption recovery (Phase 11). Darwin answers *"the
next trains on your booked route"*; OTP answers *"the line's blocked — what's another way there?"* by
planning across the whole GB transit graph (rail + bus + tube). It is open-source and **self-hosted on
the same posture as Valhalla/Photon for nav**: one JVM + a GB feed + an OSM extract, pointed at by an
env var. **The codebase is already wired** (`src/lib/integrations/otp.ts`, merged into
`src/lib/recovery/provider.ts`) and **inert until `OTP_URL` is set** — standing up the instance is the
only remaining step.

## What the app needs

| Env var | Required | Meaning |
|---|---|---|
| `OTP_URL` | yes | Base URL of the instance, e.g. `https://otp.khonsera.com`. Unset = adapter is a no-op; recovery shows Darwin same-route options only. |
| `OTP_GRAPHQL_PATH` | no | Defaults to `/otp/gtfs/v1` (OTP2 canonical). Override only if pinned to the legacy `/otp/routers/default/index/graphql`. |

The adapter POSTs a `planConnection` GraphQL query (the current 2.x query; the flat `plan` is
deprecated) and maps each itinerary into a `RecoveryCandidate` that merges into the existing trade-off
band, deduped against Darwin's same-route departures.

## Standing up the instance

### 1. Inputs (one directory, by convention `/var/opentripplanner/`)
- **GB transit GTFS** — easiest single feed: **`travelwhiz-ltd/GB-Bus-Train-Metro-GTFS`** (GitHub) —
  bus, coach, National Rail, Underground, metro, ferry; regenerated nightly; free (compilation CC BY
  4.0, sources keep their licences). *Alternative / more control:* convert the official **ATOC-CIF**
  rail timetable from the **Rail Data Marketplace** (`raildata.org.uk`, free, registration) with
  `ITSLeeds/UK2GTFS` or `thomasforth/ATOCCIF2GTFS`, plus **BODS** bus GTFS
  (`data.bus-data.dft.gov.uk/downloads/`). Note **BODS does not include heavy rail** — rail must come
  from RDM/ATOC.
- **Street/walk network** — Geofabrik Great Britain extract:
  `https://download.geofabrik.de/europe/great-britain-latest.osm.pbf` (~2 GB; excludes NI — use the
  `united-kingdom` extract if NI is needed).

### 2. Build the graph (OTP **2.9.0**, **Java 25**)
```bash
# all inputs (*.osm.pbf, *.gtfs.zip, build-config.json) in /var/opentripplanner
java -Xmx8G -jar otp-2.9.0-shaded.jar --build --save /var/opentripplanner
```
Footprint: GB-scale wants **~8–16 GB heap** (start `-Xmx8G`, raise if it OOMs) and **~15–25 GB free
disk** (pbf + GTFS + the serialised `graph.obj`). The shaded jar is on the GitHub releases /
Maven Central (`org.opentripplanner:otp`).

### 3. Serve it
```bash
java -Xmx8G -jar otp-2.9.0-shaded.jar --load /var/opentripplanner   # listens on :8080
```
Or Docker: `docker.io/opentripplanner/opentripplanner:latest`, mount data into `/var/opentripplanner/`,
set heap via `JAVA_TOOL_OPTIONS=-Xmx8g`. Put Caddy/Nginx in front, reverse-proxy
`https://otp.<domain>/` → `:8080`, then set `OTP_URL=https://otp.<domain>`. The GraphQL endpoint is
`{OTP_URL}/otp/gtfs/v1`; GraphiQL is at `/graphiql` for sanity-checking the schema.

### 4. (Later) live-disruption replanning
OTP2 ingests **GTFS-RT TripUpdates** / **SIRI-ET** via graph updaters in `router-config.json`. BODS
publishes GTFS-RT/SIRI-VM for buses out of the box. For **rail** real-time, Darwin is push-port/STOMP,
not GTFS-RT — a small **Darwin→GTFS-RT bridge** would feed OTP live rail predictions. Until then OTP
plans on the **scheduled** timetable (still a real, useful detour) and Darwin supplies the live
same-route status. This bridge is its own task; not required for the static-timetable alternatives.

## Operational notes
- **Fair-use → self-host before real traffic**, same rule as Valhalla/Photon. There is no public OTP
  instance to lean on for GB.
- The graph is a **nightly-staleness** artifact — rebuild on a schedule (cron the build step against
  the refreshed feeds, then hot-swap `graph.obj` and reload).
- Keep the box regional (GB only) to keep heap/disk sane; this is not a planet build.

## Verification once live
1. `curl -s {OTP_URL}/otp/gtfs/v1 -H 'content-type: application/json' -d '{"query":"{ feeds { feedId } }"}'`
   returns the loaded feed(s).
2. On `/plan/[id]`, a severely-delayed/cancelled booked rail leg whose stations carry coords now shows
   **detour** options ("11:25 to Derby · via Coventry · 1 change") merged into the recovery band — the
   `· sample` cue drops off once Darwin (or OTP) is returning real data.

## Sources
- OTP releases & docs: https://github.com/opentripplanner/OpenTripPlanner/releases ·
  https://docs.opentripplanner.org/en/latest/apis/GTFS-GraphQL-API/
- GB GTFS: https://github.com/travelwhiz-ltd/GB-Bus-Train-Metro-GTFS ·
  https://github.com/ITSLeeds/UK2GTFS · https://data.bus-data.dft.gov.uk/downloads/ ·
  https://raildata.org.uk/
- OSM extract: https://download.geofabrik.de/europe/great-britain.html
- Real-time: https://docs.opentripplanner.org/en/latest/GTFS-RT-Config/

# CLAUDE.md — Institutional Knowledge for Khonsera

**Every session must read this before making changes. Update it before ending.**

## Mandatory: Keep docs/ updated

After making changes to any itinerary page, the Gmail import pipeline, or the shared Timeline component, **update `docs/itinerary-pages.md`** to reflect the change. This document is the design reference for anyone picking up the codebase — it must stay current. If a new page is added, add a new doc file for it.

## Known Bugs (as of 2026-05-26)

### Planning page after brief submit
- All previously listed bugs FIXED (see git history)
- ~~Batch transition insert crashed on unique constraint~~ FIXED: `.insert()` → `.upsert()` with onConflict
- ~~Changeover stops (Leicester) had no transport_hub_id~~ FIXED: Gmail import now resolves changeover station names via resolveHubByName
- ~~Google Transit duration overwrites booked train times~~ FIXED: skip `computed_duration_minutes` overwrite for locked (is_locked=true) legs
- ~~Changeover duration uses arrival instead of departure~~ FIXED: use `from.end_time` (departure) instead of `from.start_time` (arrival) for changeover stops
- ~~No return-home walk transition without "be home by"~~ FIXED: always create a type="end" return-home stop so the transition loop generates the walk-home leg
- ~~Feasibility warnings on locked train legs~~ FIXED: skip feasibility checks for locked transitions (0m slack on a booked train is a fact, not a warning)
- ~~Badge times empty on first load~~ FIXED: fall back to transition's computed_duration_minutes when preview cache is empty

## Architecture

- **Next.js App Router** + **Supabase** (Postgres) + **Server Actions**
- Deployed on **Vercel** (serverless). Native Node modules (e.g. old `pdf-parse`) crash on Vercel — use pure JS alternatives or dynamic imports with try/catch.
- Supabase project: `attbfwemjoslugvtfbrt` (EU West 1)
- Vercel project: `prj_Dwmmyzk75AT0sJDchcJ52rU9ZTLz`, team `team_zK6YQHcoKN5rkpkCfohV4nXg`

## Design Principles

### One Toolkit, Two Views
The brief (`/itineraries/new`) and planning (`/itineraries/[id]`) share the same edit capabilities. Planning adds visual/mapping on top but never withholds a tool the brief offers, and the brief never withholds a tool planning has. If you add a feature to one page, it must exist on the other.

### Bookings Are Facts, Stops Are Events
- **Transport bookings** (train tickets) create timeline events (departure + arrival stops)
- **Accommodation bookings** are constraints (check-in-from, check-out-by), NOT fixed journey points. The user places hotel visit stops on the timeline as needed.
- One way to add booked transport. One way to add accommodation. Same pattern on both pages.

### No Emojis
The app does not use emojis anywhere. Ever. This has been explicitly stated by the user multiple times.

## Gmail Booking Import — HARD-WON FIXES

These fixes were debugged over many hours. Do NOT revert them.

### Search Query (buildSearchQuery in `src/lib/actions/gmail.ts`)
The Gmail search query MUST use three paths:
1. `from:trainline OR from:lner...` — direct from known senders
2. Subject keywords + provider in body — catches forwarded emails
3. Provider name anywhere in email — broadest fallback

Subject keywords MUST include: `eticket`, `etickets`, `tickets` (plural), `trip` — in addition to `confirmation`, `booking`, `ticket`, `e-ticket`, etc. Trainline sends emails with subject "Your etickets to Derby" — "etickets" as one word does NOT match "ticket" or "e-ticket".

**DO NOT** revert to a narrow query like `(from:sender) AND (subject:keyword)`. This was tried and fails for:
- Forwarded emails (sender is the forwarder, not Trainline)
- Trainline eticket emails (subject says "etickets" not "ticket")

### Parser (`src/lib/gmail/parsers.ts`)
- **Marketing filter**: Skip emails with `unsubscribe|newsletter|win |competition|offer|savings|discount|% off|promo` in the SUBJECT (not body). Trainline's email footer has "unsubscribe" in the body — checking the body would kill real bookings.
- **Forwarded email detection**: When no SENDER_CONFIG matches, check the email BODY for known provider names ("trainline", "easyjet", etc.) AND booking-like content (HH:MM times, "booking ref", "e-ticket", etc.). This catches forwarded confirmation emails.
- **HTML-only emails**: iPhone forwards often have only `text/html` and no `text/plain` MIME part. When there's no plain text, strip HTML tags to produce text for regex parsing. Without this, the parser receives empty text and fails silently.
- **Trainline eticket format**: Two emails per booking (eticket + booking confirmation). The eticket is the richer source:
  - Body text: "Adult 1, WEL to LEI: TTBQEBVV49M" patterns give station codes + ticket refs + outbound/return split
  - PDF attachments (one per leg): departure/arrival times, operator, ticket type, route restriction, price, NRS booking ref, coach/seat
  - PDF images: Aztec barcode decoded via unpdf extractImages + zxing-wasm → full RSP barcode payload for ticket regeneration
  - Booking confirmation subject: departure times in "(DD Month at HH:MM - DD Month at HH:MM)" pattern
  - Marketing filter: no-reply@comms.trainline.com + "Open this email for tickets" → skip
  - Deduplication: booking confirmation preferred over eticket for same-date Trainline bookings
- **Price extraction**: Trainline SAS footer contains "capital of 118 513.94 Euros" — `findTrainlinePrice` strips text after "Terms and Conditions" before searching
- **PDF library**: Use `unpdf` (pure JS) NOT `pdf-parse` (native modules crash on Vercel serverless)
- **Barcode decoding**: `zxing-wasm/reader` with `{formats: ["Aztec"]}` — pass plain `{data, width, height}` object, NOT `ImageData` constructor (unavailable in Node.js)

### Scan Cache (`gmail_scanned_emails` table)
- Every scanned email is persisted with sender, subject, parsed data, and parse_failed flag
- Already-scanned messages are NOT re-fetched (saves Gmail API calls)
- EXCEPT parse_failed=true messages — these ARE retried on subsequent scans so parser improvements take effect
- Previously scanned but not-imported bookings are still shown to the user

## Transport Hub Search (`src/lib/actions/travel-profile.ts`)

### Station Search Ranking
The search MUST prioritize prefix matches over substring matches:
1. Exact code match first (e.g. "WLB" → Wellingborough)
2. Name prefix match (e.g. "Wel" → Wellingborough)
3. Substring fallback ONLY when prefix returns < 3 results AND query is >= 3 chars

Without this, typing "wel" returns "Abbey Well" above "Wellingborough".

### Debounce
The TransportHubPicker debounce is 350ms (not 200ms). The 11k+ hub table with ilike queries needs the extra pause to avoid hammering the server.

## Brief Page Structure (`/itineraries/new`)

### Layout (top to bottom)
1. Base location card (home/office, with address)
2. Trip dates (start/end — defaults booking dates)
3. Bookings bar: `+ Transport`, `+ Accommodation`, `Import from Gmail`
4. Confirmed reservations (condensed chips with Edit/Remove/+ Return)
5. Active booking forms (not yet confirmed)
6. Timeline: anchors with AddBetween inline, transition rows
7. Transport booking markers (read-only, from confirmed bookings)
8. Accommodation constraint markers (dashed, check-in-from)
9. Be home by toggle
10. Notes + title override
11. Build my day button
12. Spine preview (right column)

### Transport Booking Card
- Starts compact (mode picker only)
- Expands on mode selection: date, from/to station hub pickers, depart/arrive times, changeovers, service number, booking ref, seat, price
- "Done" button confirms → condenses to reservation chip
- "+ Return" on confirmed chips creates a new card with stations swapped, date defaulting to trip end
- Changeover support: "+ Add changeover" for train/flight/tube

### Accommodation Booking Card
- Check-in from / Check-out by (constraint language, not "check-in date")
- Includes time fields (defaults 15:00 / 11:00)
- Hotel picker, provider, ref, price, room

### Booking Card Lifecycle
Cards only condense when the user clicks "Done" (sets `confirmed: true`). Picking a station or filling a field does NOT auto-collapse. The user explicitly confirms. "Edit" on a chip re-expands the card.

## Server Action: createItineraryFromBrief (`src/lib/actions/itineraries.ts`)

### Stop Ordering
All stops (home, anchors, transport booking departure/arrival/changeover, accommodation, be-home-by) are sorted chronologically by `start_time` before being inserted. Home stays first, be-home-by stays last.

### Transitions
After all stops are inserted, transitions are created for ALL adjacent stop pairs (not just user-specified anchor pairs). Transport booking legs (departure → changeover → arrival) get `is_locked = true`.

### Hub Coordinates
Transport booking stops store `transport_hub_id`. The `transport_hubs` table has `latitude`/`longitude` columns (migration 0019). The `pickPoint()` function in `src/lib/actions/transitions.ts` checks transport_hub coordinates alongside location and customer_site coordinates.

### Solver
`resolveItineraryTimes()` is called at the end of `createItineraryFromBrief()`. The solver propagates times from anchored stops through transitions, computing departure times for unfixed stops.

## UK Rail Network (OSM-seeded)

### How it works
The entire UK rail network (~643k edges) is stored in `rail_network_edges` (migration 0025). Seeded once from the user's browser via `/settings/rail-network` (Overpass blocks Vercel IPs, so the browser makes the Overpass calls). Admin-only page (requires `is_admin = true` on profiles).

### Routing: Dijkstra, not BFS
`routeRailPath()` in `src/lib/actions/rail-network.ts` uses Dijkstra with haversine edge weights. BFS (node-count shortest) was tried and failed — it preferred routes with fewer nodes even when geographically longer (e.g., via Beeston instead of direct to Derby at Trent Junction).

### Endpoint handling
Rail polylines end at the nearest rail node to the station, NOT at the station entrance coordinates. Snapping to entrance coordinates caused visible zigzags at close zoom because entrances are offset from the track.

### Caching
Two-tier: `rail_route_cache` (L1, by CRS code pair) → `routeRailPath` BFS (L2, from `rail_network_edges`). Results cached after first computation.

### Pipe characters in polylines
Google's encoded polyline format can produce `|` characters. Google Static Maps uses `|` as a path parameter delimiter. The `buildStaticMapUrl` function in `src/lib/google/maps.ts` uses `encodeURIComponent` on the polyline and manually appends path params (NOT `URLSearchParams`, which double-encodes `%7C`).

## Admin Role

`is_admin` boolean on `profiles` table (migration 0026). Separate from `is_staff`:
- **Staff**: demo mode, palette picker, feature testing
- **Admin**: system tools (rail network seeding, data management)

`requireUserContext()` returns `isAdmin` alongside `isStaff`. Admin pages redirect non-admins. Admin server actions reject non-admins.

## JourneyMap (MapLibre)

### Architecture
`src/components/journey-map/` — interactive map replacing Google Static Maps (RouteMap).
- **MapLibre GL JS** with OSM raster tiles (basemap, desaturated + warm-tinted)
- **GeoJSON layers** for journey lines (rail solid gold + glow, walk dashed, road solid hairline)
- **maplibregl.Marker** for station markers (bullseye origin, gold disc destination, ringed intermediate)
- Zero SVG — everything renders in MapLibre's WebGL/HTML pipeline, zero lag on pan/zoom

### Themes
Three themes: `dusk` (warm cream, default), `midnight` (dark), `sahara` (daylight ochre). Theme drives basemap raster paint (saturation, brightness) and overlay colours. Theme files in `src/components/journey-map/themes/`.

### Tile source
Currently OSM raster tiles (always available, no API key). Upgrade path: Protomaps or MapTiler vector tiles for full brand control (custom layer colours, hidden POIs). Requires an API key.

### Calling Points (intermediate stations)
Trainline PDF etickets contain an "Itinerary" section listing intermediate stops with times. These are parsed by `parseItineraryCallingPoints()` in `trainline-pdf.ts` and stored as `calling_points` on:
- `TrainlinePdfTicket.calling_points` — raw parse output
- `ParsedTransportSegment.calling_points` — flows through Gmail import
- `BriefTransportBooking.segmentCallingPoints` — client state (array of arrays, one per segment)
- `travel_booking_segments.calling_points` — DB column (jsonb, migration 0027)
- Stop `metadata.calling_points` — on transit_departure/transit_changeover stops, enriched with lat/lng at insert time

On the **map**, calling points populate `Leg.waypoints` in the editor's journey builder. Rendered as small gold-bordered circles (5px) with 7.5px labels at 70% opacity — subtler than origin/destination/intermediate markers.

On the **timeline** (both brief spine and planning page), calling points appear:
1. As a "calling at KET, MKC +1 more" hint on the collapsed transport booking in the spine
2. As a visual strip (time · dot · station code) between the station names and ticket details on the `TrainTicketCard`

### Next steps
- Planning-page transport booking: polyline + duration should work when adding transport during planning (not just from brief)
- Day-of mode: live position dot, adaptive zoom — component API supports it, just needs wiring
- Leicester→Derby routing: Dijkstra may fork toward Nottingham at Trent Junction — calling point waypoints could help constrain the polyline to the correct branch

## Key File Map

| File | Purpose |
|------|---------|
| `src/app/(app)/itineraries/new/new-itinerary-form.tsx` | Brief page form (all state + render) |
| `src/app/(app)/itineraries/new/page.tsx` | Brief page server component (data loading) |
| `src/app/(app)/itineraries/[id]/itinerary-editor.tsx` | Planning page |
| `src/components/itinerary/transport-booking-card.tsx` | Transport booking card component + types |
| `src/components/itinerary/accommodation-booking-card.tsx` | Accommodation booking card + types |
| `src/components/itinerary/transition-row.tsx` | Travel mode picker between stops |
| `src/components/itinerary/journey-spine.tsx` | Spine preview (chronological timeline) |
| `src/components/itinerary/types.ts` | Shared types (Anchor, BriefTransition, etc.) |
| `src/components/itinerary/helpers.ts` | Empty factories, sort, timing helpers |
| `src/components/transport-hub-picker.tsx` | Station/airport autocomplete |
| `src/lib/actions/itineraries.ts` | createItineraryFromBrief + solver |
| `src/lib/actions/gmail.ts` | Gmail scan + import |
| `src/lib/gmail/parsers.ts` | Email HTML parsers (Trainline, airlines, hotels) |
| `src/lib/gmail/types.ts` | ParsedBooking types |
| `src/lib/actions/transitions.ts` | Route previews, pickPoint, transition CRUD |
| `src/lib/actions/travel-profile.ts` | Hub search (searchTransportHubs) |
| `src/lib/itinerary/solver.ts` | Time propagation solver |
| `src/lib/osm/rail-routes.ts` | getRailPolyline: cache check → BFS route → cache result |
| `src/lib/actions/rail-network.ts` | seedRailEdges, routeRailPath (Dijkstra), clearRailNetwork |
| `src/components/journey-map/journey-map.tsx` | JourneyMap component (MapLibre + GeoJSON layers) |
| `src/components/journey-map/map-style/build-map-style.ts` | Theme → MapLibre style JSON |
| `src/components/journey-map/themes/` | dusk, midnight, sahara theme definitions |
| `src/app/(app)/settings/rail-network/` | Admin page for seeding UK rail network |
| `scripts/backfill-rail-polylines.mjs` | CLI alternative for seeding (requires terminal) |

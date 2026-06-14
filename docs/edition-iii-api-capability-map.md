# Khonsera — API Capability Map (max-scope per provider)

**Principle:** when a phase integrates a provider, it builds to that provider's **full useful
capability surface**, not a thin slice. Every pound of integration cost (auth, adapter, mock, types)
is paid once; squeeze the maximum product value out of it before moving on. This doc is the
companion to `docs/edition-iii-build-plan.md`: each API phase's Definition of Done includes "ticked
the provider's **Max scope** list here (or logged why a capability is deferred)."

Format per provider: **role · cost · phase(s)** → **Max scope** (every capability we can use → the
Khonsera feature it powers) → **MVP slice** (the smallest first cut) → **Deferred/notes**.
Cost legend: free / low / paid / revenue (supplier collects, we commission or keep net margin).
Verified specifics come from `docs/edition-iii-master.md` Part G + K (June 2026 web pass).

---

## Foundation — routing, geocoding, maps (self-host, free)

### Valhalla / OSRM (routing) · free · P6–P7, orchestration
**Max scope:**
- Turn-by-turn for **walk / cycle / drive** — the owned nav (already DONE for A→B).
- **Time-distance matrix** → multi-stop ordering, "is this day's leg-chain feasible", cheapest
  re-order of soft legs.
- **Isochrones** → the **unplanned-time radius** ("what's reachable in the 40-min gap") and the
  decision-clock's "still catchable" set.
- **Optimized-route** (TSP) → best order for a multi-drop field day (rural persona).
- **Map-matching / trace-attributes** → snap GPS to road for the mileage tracker's true route.
- **Elevation/auto_shorter costing** → honest cycle effort + EV range on hills (rural).
- **Alternatives + exclude-locations/polygons** → avoid a closed road / flooded corridor.
**MVP slice:** A→B walk/drive (done). **Deferred:** isochrones (P7/orchestration), matrix (P6),
map-match (P15 mileage).

### Photon / Nominatim (geocoding) · free · P2, P6
**Max scope:** forward search + autocomplete; **reverse geocode** (drop-pin → address for mileage +
"where am I"); **structured/POI** lookup for true-door (entrances, car-park polygons); bounding-box
bias from the day's anchors. **MVP:** free-text search (done). **Deferred:** reverse + entrance POIs (P6).

### MapLibre + Protomaps/OpenFreeMap · free · ongoing
**Max scope:** vector basemap branded to the three themes; 3D buildings + terrain; offline corridor
tiles (done in nav); schematic overlays for transit network maps (P8). Self-host `.pmtiles` + glyphs.

---

## Rail (UK) — all via the Rail Data Marketplace (raildata.org.uk, REST)

### Darwin / LDBWS · free · P9–P10
**Max scope:**
- **Departure + arrival boards** by CRS → live platform, ETD/ETA, cancellations (partly DONE).
- **Service details / calling points** → **on-service tracking** (your stop, stops-to-go), and the
  intermediate waypoints to draw on the JourneyMap rail leg.
- **Delay + cancellation reason codes** → the **consequence translation** copy ("held at signal →
  +12 min → you miss the 09:40").
- **Station messages / NRCC alerts** → disruption banner + recovery trigger.
- **Formation / coach data** (where the Push Port exposes it) → "your coach C is at the front."
**MVP:** departure board for the booked service (DONE-partial). **Deferred:** calling points +
reasons + on-service (P10).

### Realtime Trains (RTT) · free/low · P10
**Max scope:** independent live running + **per-service tracking**; **historical performance** (this
service's lateness record) → seeds **fragility priors** ("this connection fails 1 in 5"); allardyce
location pings between stations. **MVP:** corroborate Darwin at the boarding station. **Deferred:**
performance history → fragility (P10).

### RTJP (Real Time Journey Planner) · paid + licence · P11
**Max scope:** point-to-point **multi-leg re-planning at the disruption moment** → the recovery
alternative set (the L3 scalpel; most journeys make zero calls). Gate: protect-target + no-retailing
licence. **MVP:** alternatives for a single broken connection. **Deferred:** full multi-leg optimise.

### National Rail Knowledgebase · free · P4, P6
**Max scope:** **station facilities** (step-free/lifts, toilets, ticket office hours, car parks,
taxi ranks, cycle storage, retail) → enrich the **readiness check** + **true-door** arrival
("Derby: step-free, car park P2") + station info card; **incidents** feed. **MVP:** station name +
basic facilities. **Deferred:** accessibility routing inputs.

### RDG fares feed (via RDM) · — · fares phase (fast-follow)
**Max scope:** fare options per O-D + routeing guide → **fare display** ("09:40 £45 Anytime / 10:10
£28 Off-Peak"), **split-ticket** detection (the saving engine), railcard-adjusted prices. Purchase
referred. **MVP:** show the booked fare type. **Deferred:** split-ticket optimiser.

---

## Transit (city) — TfL now, GTFS/OTP everywhere

### TfL Unified API · free (app_id/app_key) · P8 (feeds P9–P10)
**Max scope — the whole of London, not just Tube arrivals:**
- **Live arrivals** for Tube/DLR/Overground/Elizabeth/**bus**/tram → "next Victoria line 2 min."
- **Line status + disruption** (all modes) → the **line-status reroute** + Today disruption state.
- **Journey planner** (multimodal) → walk→Tube→walk point-to-point between commitments.
- **StopPoint search + facilities** → nearest entrance, step-free access, which exit for your road.
- **Line route sequences** → the **schematic network maps** (Tube/Overground) with route highlight.
- **Santander Cycles (cycle hire) availability** (BikePoint) → a bike leg option mid-city.
- **River bus / IFS Cloud cable car / coach** → complete modal coverage.
- **Disruption push / arrivals streaming** → battery-friendly live updates.
**MVP:** live arrivals + line status for the planned legs. **Deferred:** cycle hire + river bus +
schematic maps (still inside P8's max scope — do them).

### OpenTripPlanner (OTP2) + GTFS / GTFS-RT · free (self-host) · P8 follow-on, P19
**Max scope:** generalise the *exact* TfL capability set to **any city/country** (Manchester, Paris,
Berlin…) — multimodal routing + realtime arrivals + alerts from the local agency's GTFS-RT. The
adapter seam beside the TfL adapter. **MVP:** one second city. **Deferred:** broad city library.

---

## Air + airport experience

### Duffel · revenue · L5 (P14+)
**Max scope:** flight **search + book** (NDC); **seat maps + ancillaries** (bags, seats); **order
change / cancel**; **schedule-change + disruption webhooks** → flight-delay feeds the contextual
engine and the recovery layer. Replaces Amadeus self-service (dead 17 Jul 2026). **MVP:** capture +
status. **Deferred:** in-app booking.

### AeroDataBox · free 600 units/mo · P13
**Max scope:** flight **status**; **terminal + gate** → the **in-terminal walk routing** and the
**gate-change reroute** rule; **aircraft/airport** metadata. **MVP:** status + gate. **Deferred:**
swap to a webhook provider (Cirium/FlightAware) when polling volume grows.

### DragonPass · revenue · P12 (fast-track ⭐) + P13 (lounge)
**Max scope (the flagship mechanism):**
- **Fast-track security + immigration prebooking** (`/v2/orders/...prebooking`) → the
  **running-late → expedite** flagship; **QR voucher** at the lane.
- **Lounge prebooking** sized to the window → the long-layover lounge rule.
- **Availability queries + cancellable orders** → honest "is there a slot" + clean cancel.
**MVP:** fast-track for one UK airport (mock until keyed). **Deferred:** full lounge catalogue.

### Collinson (Priority Pass / LoungeKey) · revenue · P13 (+P11)
**Max scope:** 1,800+ **lounges**; **meet-and-assist** → the **tight-connection** rule; **transfers /
rentals**; **SmartDelay** — lounge access **auto-triggered by a flight delay** → a disruption-moment
revenue line wired into recovery (P11). **MVP:** lounge access. **Deferred:** SmartDelay + assist
(still P13/P11 scope).

### Security wait-times (Qsensor / FlightQueue) · low · P12
**Max scope:** third-party live queue estimates (140+ airports) → **sharpen** the running-late rule
beyond the buffer-baseline. No official UK feed exists. **MVP:** buffer-baseline only (day one).
**Deferred:** live-queue enrichment (vendor-select in P12).

---

## Ground transport + parking

### Parkopedia / Arrive (one relationship: find + pay + reserve) · low/revenue · P13, P20, P4
**Max scope:**
- **Parking find-data** (location, price, height/restrictions) → readiness "parking sorted?".
- **Live + predicted occupancy** → the **car-park-full → pre-booked alternative** rule.
- **On-street pay** (RingGo / ParkMobile) → pay without a third app.
- **Reserve** (YourParkingSpace) → book the bay in advance; **airport + rural** parking.
- One Arrive commercial relationship spans 90+ countries.
**MVP:** find + occupancy for the contextual rule. **Deferred:** in-app pay + reserve (P14 connector).

### Rideshare — Uber / FREE NOW / Bolt · revenue · P14
**Max scope:** **price + ETA estimate** → the "**a £12 taxi unlocks the meeting**" cost-intelligence
nudge; **deep-book** the ride; track to pickup. **MVP:** price/ETA for the nudge. **Deferred:** book.

### GBFS / CityBikes (micromobility) · free · P8/P20
**Max scope:** dock/vehicle availability for bike + e-scooter legs → a micromobility leg option.

### Coach / Ferry — FlixBus·National Express / Direct Ferries · revenue · L5
**Max scope:** capture + (later) book coach + ferry legs as first-class modes (rural + island days).

---

## Stay + connectivity + context

### Booking.com Demand · revenue (weeks to approve — start early) · P14
**Max scope:** hotel **search + availability + book**; **rich content** (photos, facilities,
check-in/out times, **cancellation policy**) → powers the **accommodation card** + readiness
("free cancel until Tue"); price + map. **MVP:** search + book stub. **Deferred:** content depth.

### Airalo (eSIM) · net margin · P19
**Max scope:** package catalogue (200+ destinations); **order + install via iOS Universal Link**
(one-tap); **low-data webhooks** → "you're down to 200 MB" nudge; usage view. Net-pricing keeps the
margin. **MVP:** eSIM in readiness + install link. **Deferred:** usage dashboard.

### Open-Meteo (weather) · free (keyless) · P12, P20
**Max scope:** **hourly forecast along the corridor** (precip, wind, gusts, visibility, temp, snow);
severe-weather → the **leave-earlier** rule + readiness (de-ice, fuel, "take a coat"); marine + air
quality where relevant. **MVP:** corridor precip/wind → leave-earlier. **Deferred:** multi-point
corridor sampling.

### FX — Frankfurter / exchangerate.host · free · P19
**Max scope:** live + historical rates → **home-currency view everywhere** (each foreign spend),
per-day totals in £, locked-rate at capture time. **MVP:** live convert. **Deferred:** historical.

### Dining — Places/Foursquare + OpenTable/TheFork · low/revenue · L5
**Max scope:** POI for the **unplanned-time radius** + **client-dinner booking** → reservation flows
back as a Commitment. **MVP:** search nearby. **Deferred:** book.

### European rail — Rail Europe / Lyko / Omio · revenue · P19
**Max scope:** 200+ operators (Eurostar, SNCF, DB, Trenitalia, Italo, Renfe, SBB, ÖBB, SNCB, NS);
**no-redirect in-app booking** (Lyko/Omio commission-share) — matches the membrane; live data via
SNCF (Navitia) + DB OpenData where exposed. **MVP:** capture + a no-redirect booking interface
(mock). **Deferred:** per-operator live running.

---

## Admin / accounting

### Xero / QuickBooks · — · post-P16
**Max scope:** **export + two-way sync** of expenses + mileage as claim-ready entries; cost-centre /
category mapping; the override package. **MVP:** CSV/claim export. **Deferred:** live sync.

---

## Cross-cutting rule

Every provider above is reached through a **clean adapter seam with a deterministic mock** (Standing
Rules). The **Max scope** list is the integration's true Definition of Done — wiring the thin MVP
slice and walking away leaves value on the table and forces a costly re-open later. Where a capability
is genuinely deferred, log it in the Progress Log with the reason and the phase that will claim it.

# Itinerary Pages — Design & Technical Reference

Last updated: 2026-05-26

---

## The Two-Page Model

Khonsera's itinerary system is split into two pages that share a single rendering pipeline:

1. **Brief** (`/itineraries/new`) — where the user *builds* a day
2. **Planning** (`/itineraries/[id]`) — where the user *refines and executes* that day

They are not "create" and "edit". They are "intent" and "reality". The brief captures what the executive wants to happen. Planning turns that into a workable schedule with real travel times, feasibility checks, and a map.

Both pages render through the same shared `<Timeline>` component (`src/components/itinerary/timeline.tsx`). Each page has its own builder function that converts its data into `TimelineEntry[]` — the universal format the Timeline understands.

---

## Brief Page

**Route:** `/itineraries/new`  
**File:** `src/app/(app)/itineraries/new/new-itinerary-form.tsx`  
**Purpose:** Capture everything needed to plan a day trip (or multi-day) in one pass

### What it is

A single-scroll form where the user declares:
- Where they're starting from (home/office)
- What trains/flights they've booked (or imports them from Gmail)
- What appointments, meals, or events they have
- Where they're staying (if overnight)
- When they need to be home

The output is a structured brief that `createItineraryFromBrief` converts into stops, transitions, and constraints in the database.

### Why it exists

Executives have confirmed bookings + rough plans scattered across email and memory. The brief page is where they dump it all in one go, before Khonsera figures out the schedule. It should feel like telling a PA "I need to be in Derby by 9, I've got a 2pm return train, and I want to squeeze in the brewery."

### Layout (top to bottom)

```
Starting From card (home/office, date, leave-by, back-by)
  |
Active booking forms (transport/accommodation being filled in)
  |
Timeline (shared <Timeline> component)
  - Interleaved: transport tickets, anchors, hotels
  - Between each: gap mode pickers (walk/drive/taxi) or transition rows
  - Context gaps ("You're in Derby for 6h")
  - Maximize panels (computed available time)
  - Home return line
  |
Compact toolbar (Scan / + Stop / + Transport / + Hotel)
  |
Notes + title override
  |
Day summary (travel time, cost)
  |
[Build my day] button
```

### Key behaviours

**Booking cards** start expanded, collapse on "Done" (confirmed). The user explicitly confirms — picking a field doesn't auto-collapse. "Edit" on a confirmed chip re-expands.

**Gap mode pickers** appear between transport hubs and anchors (walk/drive/taxi/cycle to/from a station). They show duration previews fetched from the Google Routes API.

**Transition rows** appear between two user-placed anchors. They offer full mode selection (walk/drive/train/flight/bus/tube/taxi). Station-based modes expand to show local connection picks.

**Maximize mode** — when an anchor has timing mode "maximize", the brief computes the largest window between the surrounding transport bookings minus travel time and a 10-minute buffer.

**Stopovers** — between two anchors, the user can add a lightweight "drop in somewhere" with just a place and duration. These are weaker than anchors; they have no fixed time.

**+ Return** on a confirmed transport card creates a new card with stations swapped and date defaulting to trip end.

### How it submits

`createItineraryFromBrief` (in `src/lib/actions/itineraries.ts`):
1. Creates the itinerary row
2. Inserts all stops chronologically (home first, be-home-by last)
3. Creates transitions between all adjacent stop pairs
4. Locks transport booking legs (`is_locked = true`)
5. Runs the time propagation solver (`resolveItineraryTimes`)
6. Redirects to the planning page

---

## Planning Page

**Route:** `/itineraries/[id]`  
**File:** `src/app/(app)/itineraries/[id]/itinerary-editor.tsx`  
**Purpose:** Refine the schedule with real data, check feasibility, execute the day

### What it is

A two-column layout:
- **Left:** the timeline (same shared `<Timeline>` component) with inline editing
- **Right:** a map + day digest sidebar

Everything the brief creates is editable here. Anchors can expand back to their full form. Transitions show computed durations and distance. The map plots all stops.

### Why it exists

After submitting the brief, the user needs to see if it all fits. Can they walk from the station to the brewery in time? Is the 15:08 return train feasible given lunch at 14:00? The planning page answers these with computed travel times, feasibility flags, and a visual map.

### Layout

```
Masthead (title, stats, status, action buttons)
  |
Feasibility callout (if any legs are tight/infeasible)
  |
Two-column grid:
  LEFT:
    Day header
    Home row + transition to first stop
    Timeline (shared <Timeline> component)
      - Anchors (summary mode, click Edit to expand)
      - Transit groups (ticket cards for locked legs)
      - Stopovers (with back-calc: earliest arrive / latest leave)
      - Transition rows with TransitionMeta (duration, distance, feasibility)
      - Inline adds (+ stop, + stopover, + transport between entries)
    Bottom InlineAddsRow (add at end of trip)
  RIGHT:
    JourneyMap (MapLibre interactive map with SVG overlay, falls back to RouteMap)
    Day digest (on-site window, travel time, distance, costs)
```

### Key behaviours

**Anchors** default to summary mode. Edit expands them in-place. Changes are flushed to the server on Done (via `updateStop` action). Multiple anchors can be expanded at once.

**Transit groups** — consecutive locked transit stops (departure → changeover → arrival) render as a single transport entry with ticket cards per leg. This grouping is handled by `buildPlanningTimeline`.

**TransitionMeta** — below each transition row, shows computed duration, distance in miles, and a feasibility badge (tight/infeasible) when travel time doesn't fit between two time-fixed stops.

**Stopovers with back-calc** — the planning page computes the available window for stopovers based on surrounding anchors' times and leg transition durations. Shows "fits", "tight", or "infeasible" status.

**Inline adds** — between any two anchors, the user can insert a new stop, a stopover, or a transport leg (train/flight). The TransitLegForm appears inline when triggered.

### Data flow

```
Server (page.tsx loads stops, transitions, journey legs, route previews)
  → ItineraryEditor component
    → anchorsFromStops() converts DB rows to Anchor shapes
    → timelineFromStops() builds EditorTimelineItem[]
    → transitionsFromDb() builds BriefTransition map
    → buildPlanningTimeline() produces TimelineEntry[]
    → <Timeline entries={...} /> renders them
```

Edits accumulate in local state (`editedAnchors`, `editedStopovers`) until the user clicks Done, then flush to the server. `router.refresh()` reloads the page data.

---

## Shared Timeline Component

**File:** `src/components/itinerary/timeline.tsx`  
**Type file:** `src/components/itinerary/types.ts` (TimelineEntry union)

### What it is

A polymorphic renderer that accepts `TimelineEntry[]` and renders each entry using the appropriate component. It doesn't know about pages, server actions, or data sources — it just renders what it's given.

### Entry kinds

| Kind | Renders | Components used |
|------|---------|----------------|
| `home` | Leave-by time hint | Inline JSX |
| `transport` | Ticket cards for a booked journey | `TrainTicketCard` |
| `anchor` | Stop card (expanded/summary) + maximize panel | `AnchorCard` |
| `hotel` | Hotel constraint card | Inline JSX |
| `stopover` | Drop-in stop between anchors | `StopoverCard` |
| `gap-transition` | Mode picker between user stops | `TransitionRow` |
| `gap-mode` | Walk/drive/taxi picker (station connections) | `GapModePicker` |
| `context-gap` | "You're in X for Y" prompt | Inline JSX |
| `free-time` | "Z free before your train" hint | Inline JSX |
| `day-break` | Day header when date changes | Inline JSX |
| `home-return` | "~17:07 Home" arrival line | Inline JSX |
| `add-stop` | Button to insert a stop | Inline JSX |
| `inline-adds` | Planning's add affordances | Inline JSX |

### Builder functions

| Function | File | Input | Output |
|----------|------|-------|--------|
| `buildBriefTimeline` | `build-brief-timeline.ts` | Client state (anchors, bookings, gap modes, callbacks) | `TimelineEntry[]` |
| `buildPlanningTimeline` | `build-planning-timeline.ts` | DB data (stops, transitions, route previews, callbacks) | `TimelineEntry[]` |

Callbacks are closed over by the builder — the Timeline component receives entries with handlers already wired up.

---

## Gmail Import Pipeline

**Entry point:** "Scan for tickets" button on the brief page  
**Files:**
- `src/lib/actions/gmail.ts` — scan action, search query, email fetching
- `src/lib/gmail/parsers.ts` — email body/PDF parsing
- `src/lib/gmail/types.ts` — `ParsedBooking` type

### What it does

1. Searches the user's Gmail for booking confirmation emails
2. Parses them into structured `ParsedBooking` objects
3. Presents found bookings to the user for selection
4. Selected bookings populate transport/accommodation cards on the brief

### Search strategy (three paths)

The Gmail search query uses three progressively broader paths:
1. `from:trainline OR from:lner...` — known senders
2. Subject keywords + provider in body — catches forwarded emails
3. Provider name anywhere — broadest fallback

Subject keywords include: `eticket`, `etickets`, `tickets`, `trip`, `confirmation`, `booking`, `ticket`, `e-ticket`. Trainline sends "Your etickets to Derby" — "etickets" as one word must be an explicit keyword.

### Parsing pipeline

```
Email → Marketing filter (skip by subject keywords)
      → Sender match (SENDER_CONFIG)
      → OR: Forwarded email detection (provider name + booking patterns in body)
      → HTML-only handling (strip tags when no text/plain part)
      → Provider-specific parser:
          - Trainline: body text patterns + PDF attachment parsing
          - Airlines: subject line + body patterns
          - Hotels: confirmation patterns
      → ParsedBooking output
```

### Trainline-specific parsing

Two emails per booking:
- **eticket email** (richer): station codes, ticket refs, PDF attachments with times/barcode
- **booking confirmation**: departure times in subject

PDF parsing uses `unpdf` (pure JS — no native modules that crash Vercel). Barcodes decoded with `zxing-wasm/reader` in Aztec format.

### Caching

Every scanned email is persisted in `gmail_scanned_emails` with:
- Sender, subject, parsed data, `parse_failed` flag
- Already-scanned messages are NOT re-fetched (saves API calls)
- EXCEPT `parse_failed=true` — these ARE retried so parser improvements take effect
- Previously scanned but not-imported bookings still show to the user

---

## Design Principles (cross-cutting)

### One Toolkit, Two Views
Both pages share the same edit capabilities via the shared Timeline. Planning adds map/feasibility on top but never withholds a feature the brief offers.

### Bookings Are Facts, Stops Are Events
Transport bookings create departure/arrival stops. Accommodation bookings are constraints (check-in-from, check-out-by), not fixed journey points.

### No Emojis
The app never uses emojis anywhere.

### Terminology
- **Anchor** — a user-placed stop with a fixed time (appointment, meal, event, hotel check-in)
- **Stopover** — a lightweight drop-in between two anchors (no fixed time, just duration)
- **Transition** — travel between two stops (mode + optional booking)
- **Gap mode** — local connection mode (walk/drive/taxi) for getting to/from a station
- **Maximize** — timing mode where Khonsera computes the largest available window
- **Feasibility** — whether the executive can physically arrive on time given travel duration

---

## File Map

| Area | File | Role |
|------|------|------|
| Brief page | `src/app/(app)/itineraries/new/page.tsx` | Server component, data loading |
| Brief page | `src/app/(app)/itineraries/new/new-itinerary-form.tsx` | Client form, state, Timeline wiring |
| Planning page | `src/app/(app)/itineraries/[id]/page.tsx` | Server component, data loading |
| Planning page | `src/app/(app)/itineraries/[id]/itinerary-editor.tsx` | Client editor, state, Timeline wiring |
| Shared renderer | `src/components/itinerary/timeline.tsx` | The unified Timeline component |
| Brief builder | `src/components/itinerary/build-brief-timeline.ts` | Brief state → TimelineEntry[] |
| Planning builder | `src/components/itinerary/build-planning-timeline.ts` | DB data → TimelineEntry[] |
| Types | `src/components/itinerary/types.ts` | Domain types + TimelineEntry union |
| Helpers | `src/components/itinerary/helpers.ts` | Constants, factories, formatting |
| Anchor card | `src/components/itinerary/anchor-card.tsx` | Expandable stop card |
| Stopover card | `src/components/itinerary/stopover-card.tsx` | Lightweight drop-in card |
| Transition row | `src/components/itinerary/transition-row.tsx` | Mode picker between stops |
| Gap picker | `src/components/gap-mode-picker.tsx` | Walk/drive/taxi station connection |
| Ticket card | `src/components/train-ticket-card.tsx` | Train ticket rendering |
| Spine | `src/components/itinerary/journey-spine.tsx` | Brief right-column preview |
| Transport booking | `src/components/itinerary/transport-booking-card.tsx` | Booking form card |
| Accommodation | `src/components/itinerary/accommodation-booking-card.tsx` | Hotel booking form |
| DB converters | `src/components/itinerary/from-db.ts` | Stop rows → Anchor/Stopover shapes |
| Gmail scan | `src/lib/actions/gmail.ts` | Search + fetch + cache |
| Gmail parsers | `src/lib/gmail/parsers.ts` | Email → ParsedBooking |
| Server actions | `src/lib/actions/itineraries.ts` | createItineraryFromBrief, solver |
| Feasibility | `src/lib/feasibility/check.ts` | Leg feasibility computation |
| Hub search | `src/lib/actions/travel-profile.ts` | Station/airport autocomplete |
| Journey map | `src/components/journey-map/` | MapLibre-based interactive map |
| Journey map entry | `src/components/journey-map/index.tsx` | Public exports |
| Journey map core | `src/components/journey-map/journey-map.tsx` | Main component (use client, MapLibre) |
| Map themes | `src/components/journey-map/themes/` | dusk, midnight, sahara theme objects |
| Map style builder | `src/components/journey-map/map-style/build-map-style.ts` | Theme to MapLibre style JSON (Protomaps tiles) |
| Map overlay | `src/components/journey-map/overlay/` | SVG journey-overlay, leg-path, station-marker |
| Map hooks | `src/components/journey-map/hooks/use-map-projection.ts` | project(lngLat) from MapLibre camera |
| Map utils | `src/components/journey-map/utils/` | decode-polyline, compute-bounds |
| Route map (legacy) | `src/components/route-map.tsx` | Google Static Maps fallback |

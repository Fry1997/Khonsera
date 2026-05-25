# CLAUDE.md — Institutional Knowledge for Khonsera

**Every session must read this before making changes. Update it before ending.**

## Mandatory: Keep docs/ updated

After making changes to any itinerary page, the Gmail import pipeline, or the shared Timeline component, **update `docs/itinerary-pages.md`** to reflect the change. This document is the design reference for anyone picking up the codebase — it must stay current. If a new page is added, add a new doc file for it.

## Known Bugs (as of 2026-05-25)

### Planning page after brief submit
- ~~PR #11 restored the old "+ Train" / "+ Flight" inline buttons~~ FIXED: replaced with single "+ Transport" button
- ~~Transport booking stops show as "(no place yet)"~~ FIXED: stops now use transit_departure/transit_changeover/transit_arrival types instead of "appointment"
- ~~"via undefined" on transitions~~ FIXED: mode now reads transport_mode from stop metadata instead of hardcoding "train"
- ~~Transport booking stops created as `type: "appointment"`~~ FIXED: migration 0022 adds transit_departure + transit_changeover to stop_type enum
- ~~Spine preview only connects adjacent anchors~~ FIXED: spine now renders transitions between ALL timeline entries (anchors + transport bookings)
- ~~No "leave home by" time~~ FIXED: home stop shows earliest booked departure time; solver propagates backward once Home→Station transition has a duration
- ~~Map missing transit stop markers~~ FIXED: page query joins transport_hubs for coordinates; map marker builder falls through to hub lat/lng
- ~~Planning page hides anchor↔transit transitions~~ FIXED: PlanningTransitionRow renders between anchors and transit stops with mode pickers
- ~~"auto" mode crashes transition inserts~~ FIXED: "auto" removed from UI + type; was never in DB enum, causing batch insert failures for ALL transitions
- ~~Planning page has 5 redundant transport-add mechanisms~~ FIXED: consolidated to single TransportBookingCard (same as brief); removed PlanningTransportBookingModal, TransitLegForm, InlineAddsRow, StopBookingMenu, TransitionMeta (~840 lines removed)
- ~~Brief transport modes lost on planning page~~ FIXED: createItineraryFromBrief defaults anchor↔transit transitions to "walk" instead of "auto"; buildPlanningTimeline uses GapModePicker (multi-badge walk/drive/taxi with times) for local connections
- ~~Planning page missing context from brief~~ FIXED: buildPlanningTimeline now computes maximize-info (time window), home-return (arrival estimate), context-gaps ("You're in Derby for 6h"), free-time hints ("1h 30m free before your 15:08 departure")
- ~~Map uses stock Google pins~~ FIXED: RouteMap component with styled HTML markers (bullseye home, outlined transit with station codes, solid gold site), serif italic headline, gold route line, branded card wrapper

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

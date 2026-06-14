# Khonsera — Entity Domain Catalogue

**Companion to `docs/edition-iii-build-plan.md` (phases) and
`docs/edition-iii-api-capability-map.md` (APIs).** This doc sets the *depth bar* for every entry
type Khonsera handles. It exists because we went deep on trains and left everything else as a thin
wrapper — accommodation was four free-text fields when an entire industry of apps does nothing but
manage a hotel stay.

## THE RULE (the test for every entity, every field)

> **Service the travel-day need so completely that the operator's own app becomes redundant.**
> The user must never have to open the **Virgin app** for their flight, the **Hilton app** for their
> stay, the **Trainline app** for their ticket, or the **NCP app** for their parking — for anything
> the travel day requires. As we add each field, the question is not "is this field nice to have" but
> **"does leaving this out send the user to someone else's app?"** If yes, it's in scope.

This is the membrane (A4) and "full depth, never an aside" (A3) made operational. Three boundaries
keep it honest:

1. **Operate in, purchase referred.** We own *operating* the entity end to end (its details, day-of
   behaviour, documents, contact, the admin aftermath). The **one carve-out is the transaction** —
   initial booking, paid upgrades, the room bill itself are *referred* (Edition III operating
   principle 4). We surface and connect; the supplier collects.
2. **Reproduce what's legitimately ours; be honest about what's locked.** Some operator-app powers
   are proprietary (a hotel digital key, an airline's live seat-map). Where the user legitimately
   holds the artefact, we **reproduce it exactly** (as with the rail Aztec barcode — never rebuilt
   from fields). Where it's locked behind the operator's wall, we surface the next best thing and
   **say so plainly** rather than fake it.
3. **Everything serves the day-object.** Every field either (a) shows the user something they'd
   otherwise open another app for, (b) feeds the timing/feasibility engine, or (c) feeds the
   readiness check. Fields that do none of those three are noise — leave them out.

## Process: every entity starts with a research pass

Before an entity is designed or built, **run a research agent** for it. The catalogue depth must be
grounded in what the category actually offers — not memory. The research pass produces, with cited
sources, two things that then drive the entity's section:

1. **Operator/category app feature discovery** — what do the apps that own this entity let a traveller
   do? (Hotels: Hilton, Marriott, IHG, Booking.com, Expedia, Airbnb. Flights: BA, Virgin, easyJet,
   Ryanair. Etc.) Every feature becomes a row in the **operator-app-replacement checklist** —
   matched to the best of our ability, marked operate / refer-purchase / honest-limit.
2. **Third-party servicing landscape** — what existing services/APIs already do this entity well, so
   we **integrate rather than reinvent** (and find the best-fit one for the membrane: in-app, no
   redirect). Cross-references and feeds `docs/edition-iii-api-capability-map.md`.

Findings land in `docs/research/<entity>.md` and are distilled into the entity's section here. **An
ED phase is not started until its research pass is done.**

## Per-entity template (what each section below must answer)

- **Identity & booking** — the structured record (no free-text dumping grounds).
- **Operator-app replacement checklist** — *what does their own app let you do, and how do we absorb
  each?* This is the heart of the rule.
- **Day-object behaviour** — constraint vs event; the feasibility checks + timing hooks it creates.
- **Readiness items** — what "have you got everything" pulls from it.
- **Connections / APIs (max scope)** — links to the capability map.
- **Schema** — the structured shape it needs (vs what exists today).
- **Membrane boundary** — what we operate vs refer vs honestly cannot reproduce.

---

## 1 · ACCOMMODATION (the worked template) — replace the Hilton/Booking app

**Current depth (the gap):** `provider, reference, price, room_details (free text)` + a check-in/out
window. No structured hotel concept in the data model. This is ~10% of the entity.

### Identity & booking
- **Property**: name, brand/chain, star rating, address, **true entrance + map point**, front-desk
  hours, time zone.
- **Booking**: confirmation ref, channel (direct / Booking.com / Expedia), **rate plan**, prepaid vs
  pay-at-property, the card it's held on, price **breakdown** (room + taxes + **city/tourist tax** +
  resort/amenity fees), currency, **cancellation policy + free-cancel-until datetime**.
- **Stay shape**: check-in-from, check-out-by, **nights**, **guests**, **rooms**.
- **Room**: type, bed config, **board basis** (room-only / B&B / half-board), **breakfast service
  window**, smoking, floor/accessibility, special requests.
- **Loyalty**: membership number + tier.

### Operator-app replacement checklist (grounded — see `docs/research/accommodation.md`)
The posture is **channel-aware**: for OTA-booked rooms (Booking.com/Expedia) we can operate the
membrane fully via their manage/message APIs; for chain-direct bookings the PMS-bound features are
genuine dead-ends we surface + deep-link.
| Their app lets you… | Khonsera posture | Powered by |
|---|---|---|
| View reservation details | **Operate fully** | email parse · or Demand/Rapid/Hotelbeds retrieve |
| Directions / parking / shuttle | **Operate fully (better — door-to-door)** | Google Places + own MapLibre/Valhalla nav |
| Amenities / breakfast hours / wifi info | **Operate fully** | Content API (Hotelbeds/Rapid) + Places · or parse |
| Cancellation policy + cancel-by | **Operate fully** (display + decision-clock + readiness) | API response or parsed text |
| Check-out / flight knock-on alerts | **Operate fully — native edge** | Khonsera's own timeline/solver |
| Add to Wallet / offline pass | **Operate fully** | Khonsera mints passes (already does for rail) |
| Receipts / invoices | **Operate (own bookings) / surface (others)** | API record · else parsed confirmation |
| Message the property | **Operate for OTA / refer for chain** | Booking.com Messaging API · Rapid Property Message Center |
| Request late check-out / amenity / service | **Operate via message (OTA) / refer (chain)** | OTA messaging · else deep-link |
| Modify / cancel | **Operate for rooms we sold / refer otherwise** | Demand/Rapid/Hotelbeds manage-booking |
| Wi-Fi auto-connect | **Honest limit → surface the credential** | parse/Content gives ssid+password; auto-join is app-proprietary |
| Mobile / online check-in | **Refer / honest limit** | chain PMS-bound |
| Choose / upgrade room | **Refer / honest limit** | live chain PMS inventory |
| View & pay folio (bill) | **Honest limit (chain dead-end)** | folio lives in chain PMS |
| **Digital room key** | **Honest limit at chains; later opt-in tier for indie/PMS** | chains locked (ASSA ABLOY Seos); indie via Mews/OPERA + FLEXIPASS/OpenKey, per-property |
| Loyalty points / tier / perks | **Surface only / deep-link** | proprietary per programme |

**The winnable edge:** the *arrival payload + content + timeline* — reservation, directions/parking,
check-in/wifi/access instructions, cancellation clarity, check-out reminders, Wallet passes — all of
which Khonsera does **better** than operator apps (door-to-door nav + offline snapshot, no partner
dependency). The dead-ends (chain key/folio/check-in) are surfaced + deep-linked, never faked.

### Day-object behaviour
Accommodation is a **constraint, not a fixed event** (check-in-from / check-out-by). It creates:
check-out-time vs first-meeting feasibility; **breakfast-end vs leave-by**; the walk to the first
commitment routes **from the true entrance**; the stay anchors evening arrival + morning departure;
a multi-night stay shapes the trip's pack-list and the per-day projection.

### Readiness items
Confirmation loaded; ID/passport for check-in; the card on file; **free-cancel-until not passed**;
parking sorted if driving; early-check-in needed (arriving before the window?); luggage plan if
check-in is after the first meeting.

### Connections / APIs (max scope → capability map)
**Booking.com Demand** for content (photos, facilities, policies, **cancellation policy**) + booking
stub; **Parkopedia/Arrive** for hotel parking; map/geocode for the true entrance; FX for foreign
city tax. Folio → expenses (L6).

### Schema (needed) — grouped structured fields, retiring `room_details: string`
A structured `accommodation_bookings` record, grouped so we can render, navigate-to, offline-cache,
and honestly deep-link a stay — and later hang messaging/keys on the channel/PMS fields **without
another migration**:
- **Property**: name, brand/chain, address, lat/lng (true entrance), phone, front-desk hours, tz.
- **Stay window** (constraints, not fixed points): check_in_from, check_out_by, nights, guests, rooms.
- **Room & rate**: room_type, bed_config, board_basis, breakfast_window, smoking, accessibility,
  special_requests, rate_plan.
- **Money**: total + breakdown (room/taxes/**city_tax**/fees), currency, prepaid?, card_last4.
- **Booking channel**: channel (direct/booking.com/expedia/hotelbeds/airbnb), confirmation_ref,
  channel_booking_id (the handle for manage/message/cancel APIs), pms (mews/opera/null), loyalty_no/tier.
- **Arrival payload (the edge)**: check_in_method, access_instructions, wifi_ssid, wifi_password,
  parking_info, cancellation_policy, free_cancel_until.

**Email-parse is the universal backbone** (the TripIt model = our existing Gmail import) — it surfaces
*any* stay (chain-direct, indie, Airbnb) even with no partner API; the channel fields light up extra
operation (message/modify/cancel) only for OTA-sold rooms. The current free-text card is a
**placeholder** — ED1 builds this. Don't extend the wrapper; model it.

### Membrane boundary
**Operate:** the arrival payload + content + timeline (reservation, directions/parking, check-in/wifi
instructions, cancellation clarity, check-out alerts, Wallet pass) — better than the operator apps;
plus message/modify/cancel for **OTA-sold** rooms. **Refer:** initial booking, paid upgrades, deep
loyalty management, and chain-direct manage actions (deep-link). **Honest limit (don't fake):** chain
**digital key, live folio, mobile check-in** are PMS-bound dead-ends — surface + deep-link. The indie
digital-key path (Mews/OPERA + FLEXIPASS/OpenKey) is a real but **per-property, later opt-in tier**,
never a day-one consumer feature.

---

## 2 · FLIGHT — replace the Virgin/BA/easyJet app  *(to be fully worked at the flight-depth phase)*

**Current depth:** airline email parse to basics; flights-as-anchors. Shallow.

**Operator-app replacement checklist (sketch):** full reservation + **PNR**; **online check-in**
(refer the submit) + the **boarding pass reproduced** (PDF417/IATA BCBP — same reproduce-exactly rule
as rail Aztec, an *open* format so fully parseable); **terminal + gate + bag-drop/boarding/gate-close
times** (AeroDataBox, max scope) feeding the decision-clock; **seat** + seat-map (refer changes);
**baggage allowance + bag tracking** where exposed; **fast-track + lounge** (DragonPass/Collinson —
the contextual flagship); **live status / delay / gate-change** → consequence + reroute the
in-terminal walk; **fare class / change-cancel rules** as decision-clock items. **Membrane:** operate
the day-of + documents; refer purchase/seat-paid/upgrade; reproduce the boarding pass.

## 3 · CAR HIRE — replace the Enterprise/Hertz app  *(stub)*
Pick-up/drop-off location + **times** (feed timing), confirmation, vehicle class, **fuel/charge
policy**, insurance/excess, driver docs (licence — readiness), the desk location + hours, return
instructions. Connections: Expedia Rapid Cars / Booking.com. Operate day-of; refer booking.

## 4 · PARKING — replace the NCP/RingGo app  *(stub)*
Car park + **true entrance**, reservation ref, **pay/extend in-app** (Arrive: RingGo/ParkMobile),
height/restrictions, predicted-full → alternative (contextual rule), cost → expenses. Operate +
pay-in-app (Arrive is the carve-out where we *can* transact via partner).

## 5 · DINING RESERVATION — replace the OpenTable app  *(stub)*
Venue + entrance/map, **time** (a commitment), party size, confirmation, dress code (readiness/notes),
contact to call, cancel-by. Connections: OpenTable/TheFork. Operate; refer booking.

## 6 · MEETING / APPOINTMENT (work + personal) — replace the calendar + the brief  *(stub)*
Title, **true-door place**, time window, attendees/**contact**, agenda + materials + dress
(prep notes, P3), outcome notes (org-reviewable for work), the back-calculated leave-by. Already the
best-served non-rail entity; deepen with notes (P3) + attendees.

## 7 · LOUNGE / FAST-TRACK, eSIM, COACH, FERRY  *(stubs — work at their phases)*
Each gets the same treatment: the operator-app-replacement checklist, day-object hooks, readiness,
max-scope API, schema, membrane boundary — written when its phase is reached.

---

## How this binds the build

- An entity is **not "captured/handled"** until it meets its catalogue depth — *capture flowing* is
  not the same as *the entity being serviced*. (Phase 2 marked capture "done" on flow; per this
  catalogue, accommodation/flight/etc. each still owe a depth phase.)
- The thin **accommodation** card shipped in P2 is an explicit **placeholder**; a "deepen
  accommodation" phase builds the structured model + the replacement checklist.
- Each entity-depth phase's Definition of Done = **its operator-app-replacement checklist is answered**
  (operate / refer / honest-limit marked for every row), with the max-scope APIs from the capability
  map wired (or mocked).

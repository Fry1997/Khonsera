# Accommodation (Hotel Stay) — Servicing Research

**Purpose:** ground how completely Khonsera must service an *already-booked* hotel stay so a
traveller never needs to open the Hilton / Marriott / Booking.com app for travel-day needs, and map
which third parties already do this so we integrate rather than reinvent.

**Web access:** available. Sources cited inline. Research date: 2026-06-14.

**Scope note:** This is about *managing a stay you already have*, not discovery/booking. Khonsera's
posture (CLAUDE.md, handover §17): build the decision/comparison layer fully behind a clean provider
interface and **fake the transaction** — so "refer the purchase" is an acceptable answer for the
booking step, but stay-servicing should aim to operate fully where the data layer allows.

---

## PART 1 — Operator / category app feature discovery

Every feature a traveller uses to **manage an already-booked stay**, per operator. For each feature:
**(a) proprietary/locked** (tied to the chain's PMS, loyalty programme, or door hardware — cannot be
reproduced by a third party) or **(b) replicable** (a third party with the booking reference / an
aggregator API can reproduce it).

### Chain loyalty apps — Hilton Honors, Marriott Bonvoy, IHG One Rewards

These three converge on the same feature set. The key insight: the *rich* stay-servicing features
(digital key, mobile check-in, mobile chat) are **gated on direct booking + loyalty membership** and
are wired into the chain's own PMS and door hardware.

| Feature | Hilton Honors | Marriott Bonvoy | IHG One Rewards | Locked or Replicable? |
|---|---|---|---|---|
| View reservation details | yes | yes | yes | **(b) replicable** — any source with the PNR/confirmation |
| Mobile / online check-in | yes (day before, choose room on hotel map) | yes (up to 2 days ahead, "room ready" push) | yes (at participating hotels) | **(a) locked** — writes to the chain PMS; only the brand app (or a PMS-integrated partner) can perform it |
| Digital / mobile room key | yes (share with up to 4 Honors members) | yes (Mobile Key, share with up to 3) | yes (select properties) | **(a) locked** — tied to chain PMS + door hardware (Seos/Visionline etc.) and brand-app credential; not issuable to a third-party app for chain properties |
| Choose / upgrade room | yes (hotel map at check-in) | yes | yes | **(a) locked** — live inventory in chain PMS |
| View & pay folio / bill | partial — see bill, check out online | online check-out | yes ("review your bill", request digital check-out) | **(a) locked** — folio lives in the chain PMS; surfaced only in brand app or at desk |
| Late check-out / service requests | via Mobile Chat | via Mobile Chat (amenities, requests) | via app / property | **(a) locked-ish** — routed to property via chain messaging; replicable only as free-text message if a messaging channel exists |
| Message the property | Mobile Chat (before/during/after) | Mobile Chat | app messaging | **(a) locked** for chains (proprietary chat tied to property ops); replicable only via an OTA messaging API for OTA bookings |
| Loyalty points / tier / perks | yes (track points, tier, Milestone-style perks) | yes | yes (points, Milestone Rewards) | **(a) locked** — proprietary to each programme; can only deep-link |
| Directions / parking / shuttle | yes | yes | yes (directions + parking) | **(b) replicable** — static property data + maps/Places |
| Amenities / breakfast & restaurant hours / wifi | yes (chat for amenities) | yes | yes (Wi-Fi auto-connect, local insider) | **(b) replicable** — content APIs carry facilities/amenities; wifi *auto-connect* is app-proprietary but the credential/info is replicable |
| Modify / cancel + cancellation policy | yes | yes | yes (view/modify/cancel) | **(b) replicable for the booking channel** — only the channel that sold the room can modify it (chain direct vs OTA) |
| Receipts / invoices | check-out emails receipt | yes | review bill / receipt | **(a) locked** to the selling channel |
| Add reservation to Apple/Google Wallet | — | — | yes | **(b) replicable** — Khonsera can mint its own passes |

Sources: Hilton Digital Key / Digital Check-in / app overview
([hilton.com app](https://www.hilton.com/en/p/hilton-honors-mobile-app/),
[Digital Key help](https://www.hilton.com/en/help-center/check-in-and-check-out/how-to-use-your-digital-key/),
[Digital Check-in help](https://www.hilton.com/en/help-center/check-in-and-check-out/digital-check-in/),
[Share Digital Key](https://www.hilton.com/en/help-center/check-in-and-check-out/share-your-digital-key/));
Marriott Mobile Key / Mobile Chat / mobile check-in
([Marriott mobile app](https://www.marriott.com/marriott-brands/mobile-app.mi),
[early check-in](https://help.marriott.com/s/article/mobile-app-early-check-in));
IHG One Rewards app
([IHG support/mobile](https://www.ihg.com/content/us/en/support/mobile),
[hospitalitynet](https://www.hospitalitynet.org/news/4111472.html)).

**Why the rich features are locked:** chains made deliberate proprietary investments. Hilton built
Digital Key in-house from 2015; Marriott built its own after the Starwood acquisition; the perk is
"typically… loyalty member and often book directly with the hotel brand"
([goworldtravel](https://www.goworldtravel.com/i-used-a-hotel-app-and-digital-key-for-a-touchless-stay/),
[Hospitality Tech – mobile key mainstream](https://hospitalitytech.com/how-mobile-key-went-avant-garde-mainstream)).
The digital key in particular binds three things a third party doesn't control: the chain PMS room
allocation, the door-hardware credential ecosystem (ASSA ABLOY Seos / Visionline, Salto, dormakaba),
and the brand-app identity. **For major-chain properties, the digital key is a genuine dead-end** for
any third-party app.

### OTAs — Booking.com, Expedia

These manage the stay through the channel that *sold* the room, plus a property-messaging layer.

| Feature | Booking.com | Expedia | Locked or Replicable for Khonsera? |
|---|---|---|---|
| View reservation | yes | yes (Trips, all bookings in one place) | **(b)** via Demand API / Rapid Retrieve |
| Message the property | yes — Booking Messages: chat UI, pre-translated templates for check-in/out times, parking, bed prefs; in-stay services (restaurant/spa) | yes — Property Message Center link in Rapid Retrieve | **(b) partially replicable** — both expose a messaging channel via API (see Part 2) |
| Arrange check-in/out time | yes (template message to property) | yes (message) | **(b)** via messaging API |
| Express / online check-in | yes (express check-in, check-in reviews) | varies by property | **(a) locked-ish** — depends on property PMS; OTA exposes only the message-based version |
| Modify / cancel + policy | yes | yes (online change *if* the rate allows; otherwise cancel & rebook); most show free-cancellation status | **(b)** Demand API "manage bookings"; Rapid Manage Booking / Change |
| Cancellation fees / policy display | yes | yes | **(b)** returned in availability + booking responses |
| Trip alerts (check-out time, flight delay) | — | yes (check-out reminders, gate/delay) | **(b)** Khonsera already owns the timeline; this is native |
| Receipts / invoices | yes | yes | **(b)** via API booking record |
| Digital room key | no (OTA doesn't control the door) | no | n/a — OTAs never had this |

Sources: Booking Messages
([news.booking.com](https://news.booking.com/bookingcoms-new-booking-messages-interface/),
[hotelmanagement.net](https://www.hotelmanagement.net/tech/booking-com-releases-new-booking-messages-interface));
Expedia Trips / change-cancel
([expedia trip planning](https://www.expedia.com/why/trip-planning),
[cancel your stay](https://www.expedia.com/helpcenter/?articleId=12326)),
Rapid Manage Booking
([developers.expediagroup.com](https://developers.expediagroup.com/rapid/lodging/manage-booking)).

### Airbnb (short-term rental)

Different shape: no front desk, no chain loyalty, no PMS folio. The stay is managed through the
**host relationship + the listing's Arrival Guide**.

| Feature | Airbnb | Locked or Replicable? |
|---|---|---|
| View reservation / trip details | yes (Trips) | **(b)** — but Airbnb has **no public partner API** for consumer bookings; ingest is via email/itinerary parse |
| Check-in instructions (Arrival Guide) | yes — door codes, lockbox location, parking, **Wi-Fi credentials**, building access; delivered ~3 days before; **downloadable for offline** | **(b) replicable as content** if Khonsera can ingest it (email parse) — this is high-value structured data |
| Self check-in method | smart lock / keypad / lockbox | **(a) locked** — the actual unlock is host-hardware specific; Khonsera can only surface the code/instructions |
| Message the host | yes (in-app messaging, scheduled host messages) | **(a) locked** — Airbnb messaging is closed; Khonsera can deep-link |
| House manual / rules / wifi | yes | **(b)** if ingested as content |
| Modify / cancel + policy | yes | **(a) locked** to Airbnb's channel; deep-link only |

Sources: Airbnb check-in / Arrival Guide
([news.airbnb.com](https://news.airbnb.com/introducing-a-new-way-to-check-in/),
[Hospitable](https://hospitable.com/airbnb-check-in-instructions),
[Hostfully](https://www.hostfully.com/blog/airbnb-check-in-process/)).

---

## PART 2 — Third-party servicing landscape (APIs / services)

What an app like Khonsera can integrate for hotel **content**, **booking**, and **stay management**.
For each: what it enables, the partner/cost model, and whether it supports **in-app / no-redirect**
use (the "membrane" — the user never leaves Khonsera).

### Content + booking + post-booking aggregators

**Booking.com Demand API** — Affiliate-partner API over Booking.com inventory (accommodation, cars,
flights). Endpoints: search, property details, availability, reviews, **manage bookings**, order
reports. RESTful JSON, auth by Affiliate ID + token. *Membrane:* yes — designed so partners "make
bookings and reservations right on the partner website"; includes the **Messaging API** for
guest↔property chat. *Model:* affiliate (commission); requires approved partnership.
([Demand API docs](https://developers.booking.com/demand/docs/open-api/demand-api),
[accommodations](https://developers.booking.com/demand/docs/open-api/demand-api/accommodations),
[Messaging API](https://developers.booking.com/demand/docs/messaging/about-messaging)).

**Expedia Rapid (Rapid Lodging API)** — 750k+ properties, modular (shop → book → pay →
**post-booking**). Post-booking: **Retrieve** returns the **Property Message Center link** for direct
property comms and lets you **change** room details (name, smoking, special request); **Manage
Booking / Change / Cancel** endpoints. *Membrane:* yes — build the whole shop-to-post-book flow
in-app; `affiliate_reference_id` required per booking for idempotency. *Model:* affiliate
(differentiated rates + commission); partner onboarding with B2C launch requirements.
([Rapid overview](https://developers.expediagroup.com/rapid/lodging),
[Manage Booking](https://developers.expediagroup.com/rapid/lodging/manage-booking),
[Rapid product](https://partner.expediagroup.com/en-us/solutions/build-your-travel-experience/rapid-api)).

**Hotelbeds APItude (HBX Group)** — bedbank: ~80k bookings + 14M searches/day. **Booking API** covers
the full lifecycle: list hotels, confirm bookings, list bookings, **manage cancellations &
modifications**, return cancellation fees in the availability step. **Content API** supplies photos,
descriptions, facilities, services. *Membrane:* yes — full in-API booking + management; REST and XML.
*Model:* B2B distributor/wholesaler contract (net rates), not a consumer affiliate scheme.
([APItude suite](https://www.hbxgroup.com/products-and-services/api-suite),
[Booking API](https://developer.hotelbeds.com/documentation/hotels/booking-api/),
[Content API](https://developer.hotelbeds.com/documentation/hotels/content-api/),
[AltexSoft overview](https://www.altexsoft.com/blog/hotelbeds-api-integration/)).

**Google Hotels / Places** — **no public Hotels search API.** The Google Hotel/Travel Partner API is
for hotels & OTAs to push rates onto Google Search/Maps/Hotel results and receive booking traffic —
it is *not* a content/booking API for an app like Khonsera. The usable piece for us is **Places API**
(property name, address, coordinates, hours, photos, phone, ratings) as a **content/enrichment**
layer — directions, parking context, restaurant hours — not booking or stay management. Live rates
require third-party scrapers/alternatives, which are fragile and ToS-risky.
([Google Hotel APIs](https://developers.google.com/hotels),
[oneclickitsolution guide](https://www.oneclickitsolution.com/blog/google-hotel-api)).

### Itinerary ingestion (the "membrane" without an API)

**TripIt** — the model Khonsera's own capture already mirrors. Ingests hotel reservations by
**forwarding confirmation emails to plans@tripit.com**, parsed into a structured itinerary in
minutes; or **Inbox Sync** auto-imports confirmations going forward. Builds a linear day-by-day
itinerary; supports independent hotels via an expanding vendor parser list. *Relevance:* validates
the email-parse path (Khonsera's Gmail import) as the universal fallback that works **even where no
partner API exists** (Airbnb, indie hotels, chain direct bookings). TripIt does the *organising*
layer, not stay-servicing — it surfaces the booking, it doesn't operate the folio or the key.
([how it works](https://www.tripit.com/en-uk/web/how-it-works),
[Going review 2026](https://www.going.com/guides/tripit-review)).

### Digital-key / mobile-key / PMS-integration platforms

This is the crux of the "never open the chain app" question. Two tiers:

**Tier 1 — Chain-proprietary keys (Hilton, Marriott, IHG, Hyatt): closed.** The credential is bound
to the chain PMS + brand-app identity + door hardware. **No third-party app can issue these keys** for
chain properties. Honest limit; deep-link to the brand app at most.

**Tier 2 — PMS-integrated / independent-hotel key platforms: open via SDK/API.** These *can* be
embedded in a third-party app for hotels running compatible PMS + locks:

- **ASSA ABLOY Hospitality Mobile Access (Vingcard / Vostio / Seos)** — the dominant lock ecosystem.
  PMS allocates the room → Visionline issues an encrypted key → ASSA ABLOY Mobile Services delivers
  it OTA. Ships as a **skinnable off-the-shelf app**; "using just an API, Vostio can integrate with
  your PMS." Integrations to all major PMS vendors. *Membrane:* possible **only via a hotel/PMS
  partnership**, not a self-serve consumer API. ([hospitalitynet](https://www.hospitalitynet.org/news/4070717.html),
  [Hotel Tech Report](https://hoteltechreport.com/guest-experience/mobile-key-hotel/assa-abloy-global-solutions)).
- **OpenKey** — vendor-neutral digital key with an **SDK to add keys into an existing app**; works
  across multiple chains/locks. ([OpenKey SDK](https://www.openkey.co/digital-key-sdk/)).
- **FLEXIPASS** — **Open API & SDK** explicitly to "plug digital keys into PMS, guest communication
  platforms, or **mobile apps**"; built for guest-comms tools and hospitality apps. Closest thing to
  a key seam a third-party app could actually consume. ([FLEXIPASS](https://flexipass.tech/),
  [digital keys](https://flexipass.tech/digitalkeys)).
- **Canary Mobile Key**, **Mews Digital Key**, **Goki** — PMS-side key issuance (Mews, Cloudbeds,
  Guesty, OPERA Cloud). PMS-bound, per-property. ([Canary](https://www.canarytechnologies.com/products/mobile-key),
  [Mews key](https://www.mews.com/en/products/digital-key),
  [Goki PMS guide](https://www.gokitech.com/blog-posts/how-goki-integrates-with-cloudbeds-mews-and-opera-the-complete-pms-integration-guide)).

**PMS platforms (the source of folio, check-in, room data):**

- **Oracle OPERA Cloud via OHIP** (Oracle Hospitality Integration Platform) — self-service portal of
  **REST APIs + streaming "Business Events"** (e.g. real-time guest check-in over WebSockets). This is
  where the folio, room status, and check-in live for OPERA hotels — but access is a
  **hotel/vendor-side integration**, certified, not a consumer membrane.
  ([AltexSoft OPERA](https://www.altexsoft.com/blog/opera-pms-integration/),
  [Oracle integration partners](https://www.oracle.com/hospitality/pms-pos-integration-partners/)).
- **Mews** — **open Connector API + 1000+ marketplace integrations**; scenarios for housekeeping,
  kiosk, guest tech; contactless check-in + digital guest tools; **self-service** marketplace. The
  most open of the modern PMSs. ([Mews API](https://www.mews.com/en/products/api)).
- **Salto, dormakaba** — lock vendors comparable to ASSA ABLOY; same PMS-bound model.

**Amadeus Self-Service API — decommissioning 17 July 2026.** New-user registration paused, API keys
disabled and the portal inaccessible on that date; enterprise APIs continue via the Enterprise portal
(migration to AQC). **Flag:** do **not** build any hotel content/booking dependency on the Amadeus
*self-service* tier — it is dead within weeks of this research. If Amadeus is ever wanted, it must be
the enterprise contract. ([PhocusWire](https://www.phocuswire.com/amadeus-shut-down-self-service-apis-portal-developers),
[OneClick migration](https://oneclicktraveltech.com/blogs/travel/amadeus-self-service-api-shutdown)).

**Membrane summary:** Demand API, Rapid, and Hotelbeds all support full no-redirect booking + basic
post-booking management **for rooms sold through them**. None give you the chain-proprietary digital
key or the chain folio. Key SDKs (FLEXIPASS/OpenKey) and PMS APIs (Mews/OHIP) open the door for
*independent/PMS-integrated* hotels but require **per-property/hotel-side partnerships**, not a
consumer self-serve key. For everything else (Airbnb, indie, chain-direct bookings the user already
holds), the **email-parse ingestion path (TripIt model = Khonsera's Gmail import)** is the universal
fallback that surfaces the stay even with zero API.

---

## PART 3 — Synthesis for Khonsera

### Feature → Khonsera posture → power source

| Operator-app feature | Khonsera posture | Powered by |
|---|---|---|
| View reservation details | **Operate fully** | Gmail/email parse (own); or Demand/Rapid/Hotelbeds Retrieve if booked via us |
| Directions / parking / shuttle | **Operate fully** | Google Places + own MapLibre/Valhalla nav (`/navigate`) |
| Amenities / breakfast & restaurant hours / wifi info | **Operate fully** | Content API (Hotelbeds/Rapid) + Places; or parsed from confirmation |
| Wi-Fi *auto-connect* | **Honest limit → surface credential** | Content/parse gives the credential; auto-join is app-proprietary |
| Cancellation policy display | **Operate fully** | API availability/booking response; or parsed policy text |
| Trip alerts (check-out reminder, flight knock-on) | **Operate fully — native advantage** | Khonsera's own timeline/solver |
| Receipts / invoices | **Operate (own bookings) / surface (others)** | API booking record; else parsed confirmation |
| Add to Wallet | **Operate fully** | Khonsera mints its own passes (already does for rail) |
| Message the property | **Operate fully *for OTA bookings*** | Booking.com Messaging API / Rapid Property Message Center |
| Late check-out / amenity / service request | **Operate (OTA, via message) / refer (chain)** | OTA messaging API; chain = deep-link to brand chat |
| Arrange check-in/out time | **Operate (OTA) / refer (chain)** | OTA messaging templates |
| Modify / cancel | **Operate *for rooms we sold* / refer otherwise** | Demand/Rapid/Hotelbeds manage-booking; else deep-link to selling channel |
| Mobile / online check-in | **Refer / honest limit** | Chain PMS-bound; possible only via Mews/OHIP per-property partnership |
| Choose / upgrade room | **Refer / honest limit** | Live chain PMS inventory |
| View & pay folio / bill | **Honest limit (dead-end for chains)** | Folio lives in chain PMS; OHIP/Mews only with hotel-side integration |
| **Digital / mobile room key** | **Honest limit for chains; achievable for indie/PMS hotels later** | Chain keys = locked. Indie/PMS keys = FLEXIPASS/OpenKey SDK + ASSA ABLOY/Mews, per-property |
| Loyalty points / tier / perks | **Surface only / deep-link** | Proprietary per programme |
| Airbnb check-in / Arrival Guide (codes, wifi, parking) | **Operate fully if ingested** | Email/itinerary parse (no Airbnb API) |

### Highest-value, most-achievable wins

1. **Structured reservation surface + directions + check-in/out reminders.** Pure content + own
   timeline; no partner dependency; this is where Khonsera's door-to-door nav and solver already beat
   every operator app. Build this completely.
2. **Check-in/out instructions & wifi as first-class data** (esp. Airbnb Arrival Guide and parsed
   hotel confirmations) — the thing travellers actually open the app *for* on arrival, offline-cached
   like the rail Aztec.
3. **Property messaging for OTA bookings** via Booking.com Messaging API / Expedia Rapid Property
   Message Center — covers "ask for late check-out / parking / early arrival" without leaving Khonsera.
4. **Modify/cancel + cancellation-policy clarity** for rooms booked through an integrated channel
   (Demand/Rapid/Hotelbeds) — and clear "managed elsewhere → here's the link" for the rest.
5. **Wallet passes + offline snapshot** of the stay (reusing the existing ticket-cache / `/offline`
   spine) so the booking, address, codes, and wifi survive no-signal.

### Genuine dead-ends (surface, don't reproduce)

- **Chain digital room key** (Hilton/Marriott/IHG/Hyatt) — bound to chain PMS + brand-app identity +
  door hardware. Not issuable to a third-party app. Deep-link to the brand app.
- **Chain folio / live bill** — lives in the chain PMS; no consumer API.
- **Chain mobile check-in & room selection** — writes to chain PMS inventory.
- **Loyalty points/tier/perks** — proprietary; deep-link only.
- **Airbnb/host messaging & cancel** — closed channel; deep-link.
- *Caveat:* the key/folio/check-in dead-ends **soften for independent & PMS-integrated hotels** via
  Mews Connector / OPERA OHIP + FLEXIPASS/OpenKey — but each requires a **per-property / hotel-side
  partnership**, so treat as a later, opt-in tier, never a day-one consumer feature.

### Structured data fields for a hotel booking (replace the free-text `room_details` string)

Today a hotel booking carries a single free-text `room_details`. To service a stay it should carry
structured fields (nullable; populated from parse or API):

**Property**
- `property_name`, `brand` (Hilton/Marriott/independent/Airbnb), `property_type` (hotel/aparthotel/STR)
- `address`, `latitude`, `longitude` (→ existing `pickPoint`/nav seam), `phone`, `property_url`
- `external_property_id` (Booking/Expedia/Hotelbeds id for API re-lookup)

**Stay window (constraints, per CLAUDE.md — NOT fixed timeline points)**
- `check_in_from` (date + time, default 15:00), `check_out_by` (date + time, default 11:00)
- `nights`

**Room / rate**
- `room_type`, `room_name`, `bed_config`, `occupancy_adults` / `occupancy_children`
- `rate_plan`, `board_basis` (room-only / breakfast / half-board), `smoking` (bool/null)
- `room_number` (post check-in only), `floor`

**Money**
- `total_price`, `currency`, `price_per_night`, `paid_status` (prepaid / pay-at-property / deposit)
- `taxes_fees`

**Booking & channel**
- `booking_ref` / `confirmation_number`, `booking_channel` (chain-direct / Booking / Expedia / Airbnb)
- `loyalty_program` + `loyalty_number` (deep-link only), `guest_name`
- `cancellation_policy_text`, `free_cancellation_until` (datetime), `is_refundable`
- `modify_url` / `manage_url` (deep-link to the selling channel), `messaging_channel_ref` (OTA message thread)

**Arrival / on-property (the travel-day payload)**
- `check_in_method` (front-desk / mobile / self-check-in / lockbox / keypad / smart-lock)
- `access_instructions` (door code / lockbox / Arrival Guide text), `wifi_ssid`, `wifi_password`
- `parking_info`, `shuttle_info`, `breakfast_hours`, `amenities[]` (facilities list)
- `special_requests`, `notes`

This lets Khonsera render the stay, drive door-to-door nav to it, show arrival/wifi/parking offline,
display the cancellation policy honestly, deep-link to whatever it can't operate, and (later) hang
messaging / key on the channel/PMS fields without another migration.

---

## Source list

- Hilton: [app overview](https://www.hilton.com/en/p/hilton-honors-mobile-app/) · [Digital Key](https://www.hilton.com/en/help-center/check-in-and-check-out/how-to-use-your-digital-key/) · [Digital Check-in](https://www.hilton.com/en/help-center/check-in-and-check-out/digital-check-in/) · [Share key](https://www.hilton.com/en/help-center/check-in-and-check-out/share-your-digital-key/)
- Marriott: [mobile app](https://www.marriott.com/marriott-brands/mobile-app.mi) · [early check-in](https://help.marriott.com/s/article/mobile-app-early-check-in)
- IHG: [support/mobile](https://www.ihg.com/content/us/en/support/mobile) · [hospitalitynet](https://www.hospitalitynet.org/news/4111472.html)
- Booking.com: [Booking Messages](https://news.booking.com/bookingcoms-new-booking-messages-interface/) · [Demand API](https://developers.booking.com/demand/docs/open-api/demand-api) · [accommodations](https://developers.booking.com/demand/docs/open-api/demand-api/accommodations) · [Messaging API](https://developers.booking.com/demand/docs/messaging/about-messaging)
- Expedia: [Trips/planning](https://www.expedia.com/why/trip-planning) · [cancel stay](https://www.expedia.com/helpcenter/?articleId=12326) · [Rapid overview](https://developers.expediagroup.com/rapid/lodging) · [Rapid Manage Booking](https://developers.expediagroup.com/rapid/lodging/manage-booking)
- Airbnb: [new check-in](https://news.airbnb.com/introducing-a-new-way-to-check-in/) · [Hospitable check-in](https://hospitable.com/airbnb-check-in-instructions) · [Hostfully](https://www.hostfully.com/blog/airbnb-check-in-process/)
- Hotelbeds/HBX: [API suite](https://www.hbxgroup.com/products-and-services/api-suite) · [Booking API](https://developer.hotelbeds.com/documentation/hotels/booking-api/) · [Content API](https://developer.hotelbeds.com/documentation/hotels/content-api/) · [AltexSoft](https://www.altexsoft.com/blog/hotelbeds-api-integration/)
- Google: [Hotel APIs](https://developers.google.com/hotels) · [guide](https://www.oneclickitsolution.com/blog/google-hotel-api)
- TripIt: [how it works](https://www.tripit.com/en-uk/web/how-it-works) · [Going review](https://www.going.com/guides/tripit-review)
- Digital key / PMS: [ASSA ABLOY Mobile Access](https://www.hospitalitynet.org/news/4070717.html) · [ASSA ABLOY Hotel Tech Report](https://hoteltechreport.com/guest-experience/mobile-key-hotel/assa-abloy-global-solutions) · [OpenKey SDK](https://www.openkey.co/digital-key-sdk/) · [FLEXIPASS](https://flexipass.tech/) · [Canary](https://www.canarytechnologies.com/products/mobile-key) · [Mews Digital Key](https://www.mews.com/en/products/digital-key) · [Mews API](https://www.mews.com/en/products/api) · [OPERA/OHIP](https://www.altexsoft.com/blog/opera-pms-integration/) · [Oracle partners](https://www.oracle.com/hospitality/pms-pos-integration-partners/) · [Goki](https://www.gokitech.com/blog-posts/how-goki-integrates-with-cloudbeds-mews-and-opera-the-complete-pms-integration-guide)
- Why keys are locked: [goworldtravel](https://www.goworldtravel.com/i-used-a-hotel-app-and-digital-key-for-a-touchless-stay/) · [Hospitality Tech](https://hospitalitytech.com/how-mobile-key-went-avant-garde-mainstream)
- Amadeus shutdown: [PhocusWire](https://www.phocuswire.com/amadeus-shut-down-self-service-apis-portal-developers) · [OneClick migration](https://oneclicktraveltech.com/blogs/travel/amadeus-self-service-api-shutdown)

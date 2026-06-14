# KHONSERA — MASTER PRODUCT & BUILD DOCUMENT

### Edition III · web-verified, corrected, and elevated

*The single canonical specification. This edition takes the prior master document and runs every load-bearing external claim down against current (June 2026) sources — correcting what was wrong, hardening what was right with verified specifics, resolving the open research items where the answer now exists, and adding a strategic layer the earlier draft couldn’t reach without live tools. Everything that changed from the prior edition is auditable in **Part K — Verification log**. Where this and `DECISIONS.md` disagree, this governs intent and `DECISIONS.md` governs the locked detail.*

**What changed at a glance (full detail in Part K):**

- **Darwin access model corrected** — still free and open, but it has migrated to the **Rail Data Marketplace (raildata.org.uk)**; the legacy National Rail Data Portal retires in early 2026 and old SOAP tokens no longer authenticate. The spine survives; the registration path changed.
- **Amadeus deadline corrected and made urgent** — the self-service portal is decommissioned **17 July 2026** (a hard date, ~5 weeks out), keys disabled that day. Nothing new is built on Amadeus self-service. Flights → **Duffel**, confirmed as the standard replacement.
- **Barcode pipeline hardened** — the UK standard is verified as **RSP-6 / RSPS3001**, an Aztec barcode with **PKI asymmetric signing** validated offline at the gate; the spec is deliberately non-public. This *confirms* the “reproduce exactly, never rebuild from fields” approach and reframes the open risk as contractual, not technical.
- **Parking consolidation corrected** — the EasyPark→**Arrive** rebrand was **June 2025, not 2026**; Arrive is now the parent of Parkopedia, RingGo, ParkMobile, YourParkingSpace and more across 90+ countries. One partner relationship can cover find-data + pay + reserve.
- **Flagship feature verified buildable** — **DragonPass** exposes a live developer API with documented lounge *and* fast-track prebooking endpoints, QR-code vouchers, and UK coverage. “Running late → fast-track” is real and integrable.
- **The UK security-queue research item is resolved** — no official national API exists, but third-party aggregators (Qsensor, FlightQueue) estimate live UK waits; buffer-baseline ships day one, live enrichment via these third parties, honestly caveated.
- **New Part J — Competitive position in the agentic era** — the strategic wedge the live-tools pass surfaced: the whole market is racing toward *agent-led booking*; almost nobody is building *agent-grade operation of the committed day*. That gap is the moat, and it is defensible.

-----

# PART A — THE PRODUCT

## A1. What Khonsera is

Khonsera is a premium travel concierge: an intelligent organising layer that sits over the bookings and commitments a person already holds and turns them into one calm, coherent, door-to-door plan that prepares itself, runs itself, and looks after the person in real time — the lived experience of having a private office, a chief of staff, and a guardian for your travel day.

It is deliberately not several things, and the boundaries matter. It does not sell tickets — it refers the purchase to suppliers and earns commission, never becoming the merchant of record. It is not a planner that invents trips from scratch. It is not a super-app trying to own your whole phone. It does exactly one thing, to total depth: it operates your travel day — from the first moment of preparation to the last leg home — so you never have to hold the day in your head.

The brand draws on Khonsu, the Egyptian moon-god and guardian of travellers, paired with the evening hour (the calm of dusk). The positioning is executive treatment for ordinary working people — the feeling of a private jet, not a budget airline; of being looked after, not processed. The premium reads through restraint — the app shows you the one thing you need now and withholds the rest. It is rooted in UK rail-focused business travel but built to work anywhere in the world, in any city and deep in the countryside, equally well by train, car, plane, or public transport. The launch market is the UK.

## A2. The two core promises

Everything Khonsera does serves two promises that sit above every feature:

1. **Anxiety lifted.** It removes the background hum every traveller carries — am I going to make it? which platform? what if it’s cancelled? is there time to park? have I left enough buffer? do I have everything I need? It answers all of that before you have to ask, and keeps answering as the day changes. *This is how the day feels.*
1. **Credibility protected.** It guards your professional reputation. You are never the person who’s late, who missed the connection, who turned up flustered and unprepared in front of a client or a board. Showing up reliable, on time and ready is professional currency — and the app exists to defend it. *This is what travel going wrong actually costs you.*

Anxiety-reduction is the feeling; credibility-protection is the stakes. Hold both at all times.

## A3. The doctrine

**The five north stars** (these outrank everything; when a decision is ambiguous, they break the tie):

1. **The concierge experience is the product.** Anxiety-reduction is the reason to exist. Completeness must land as calm, never as a dashboard. If a structurally “correct” build makes the day feel busier or more anxious, it is wrong, full stop.
1. **Employees beg for it.** Adoption is bottom-up. The individual traveller is the primary customer. B2B/organisational features enable the purchase but never create the desire, and must never make the traveller feel watched. (Also commercially load-bearing — see Part D, and now Part J.)
1. **The travel-day membrane.** All-in-one for the travel day and nothing else. The test for any feature, API, or line of code: does operating the travel day — including getting ready for it — require it? If a user must leave the app for any travel-day need, preparation or live, the membrane has failed.
1. **Operate vs purchase.** We own the informing and guiding end to end and never hand it off. Transactions are referred — but in-app, never leaving; the contract and service are user↔supplier, the supplier collects payment, we connect and commission. *(In the agentic era this line becomes a strategic wedge — Part J.)*
1. **Full depth, never an aside.** The membrane is narrow; within it, depth is total — mileage as complete as a dedicated tracker, navigation as complete as a sat-nav, preparation as complete as a great executive assistant. The only carve-out is that purchase is referred.

**The operating principles** (how the stars are enforced in code):

- **One live day-object spine.** Every capability reads and writes one coherent day-object. No parallel models.
- **No free-text parsing.** Capture is structured sources only — free-text “tell me your trip” was tested and fails (>70%), and a concierge that misreads your day is worse than none. A structured query layer (asking the structured day questions in plain words) is separate and kept.
- **Confirm-before-commit.** Nothing enters the day silently; the engine proposes, the user confirms.
- **Infer, never manufacture.** Inferences surface as confirmable proposals; nothing auto-inserts into the timeline.
- **No silent learning, anywhere.** The app never models you behind your back. Personalisation is explicit and user-set (recurring events, classification rules, prep templates), never observed-and-inferred. Defaults are sensible and fixed; you adjust in context.
- **Reliability over flash.** A misroute is brand-lethal — the same severity class as a failed barcode. Routing, live status, recovery and barcode reproduction carry the highest bar.
- **Blueprint-first.** Decisions lock in `DECISIONS.md` before code moves.

## A4. The membrane — and preparation is inside it

The membrane is the product’s hard boundary: Khonsera is everything for the travel day and nothing beyond it. Critically, the travel day is not just the hours in motion — it begins the moment you start getting ready. Assembling the day, sorting the bookings, checking you have everything, taking the notes you’ll need, knowing tomorrow’s plan: all of this is inside the membrane and is treated with the same care as the live day. The failure test is total — if you have to leave the app for any travel-day need, preparation or live, we have failed. (Preparation is built out in full in Part B3.)

## A5. The problems we solve (the full challenge set)

Khonsera exists to kill the following, comprehensively. Every feature in Part C maps to one or more:

- Re-typing what you’ve already booked; holding the whole day in your head.
- Getting ready and not being sure you have everything — the ticket, the document, the address, the notes, the charge, the parking.
- “When do I actually need to leave?” — no tool back-calculates it from your real first commitment.
- Which platform / gate / entrance / true door — fragmented across a dozen sources, never in one place.
- “Will I make the connection?” — nobody translates a delay into your consequence.
- “It’s delayed / cancelled — now what?” — no one computes the way out.
- “Is my plan one delay from collapse?” — fragility you can’t see until it breaks.
- Disruption panic — no “act-by”, no decision-clock telling you how much time you really have.
- Dense city movement — which line, which change, when’s the next train, the line’s suspended.
- Needing the Tube / Overground / metro map and point-to-point navigation with live arrivals.
- Getting lost on the last leg — dropped at a map centroid instead of the real entrance.
- Rural days — no station nearby, a long drive on country roads, where to park in an unfamiliar market town.
- Running late to the airport and the security queue; long layovers; tight connections; gate changes after you’ve settled.
- Parking — full when you arrive, where to put the car, paying without three separate apps.
- Weather wrecking the drive.
- Booking everything the day needs across a dozen disconnected apps.
- International — a foreign city’s transit you don’t know, foreign currency, timezones, no data on landing, European trains.
- Fares — what it costs, whether there’s a cheaper fare or a split-ticket saving.
- Taking and keeping the notes a visit needs — what it’s about, what to bring, the outcome afterwards.
- Keeping people informed (the “running late” message); travelling with companions; arriving somewhere unfamiliar, late, alone.
- The admin aftermath — mileage, expenses, claims, accounting — for the employee and the self-employed alike.
- For organisations: setting visits for staff, knowing the work got done, controlling spend, without surveilling people.
- The meta-problem under all of it: travel feeling stressful and reputationally risky instead of handled.

-----

# PART B — THE ANATOMY OF A TRAVEL DAY

## B1. The day-object model

One coherent object represents each travel day; every capability reads and writes it. Its entities:

- **Day** — the container. Single-day span by default; spans multiple days for multi-day trips. Automatically projected into Today when it arrives. Carries the day’s overall state and the readiness status (B3).
- **Commitment** — the anchor: a thing that must be honoured — a client meeting, a site visit, a flight departure, a hotel check-in, a personal dinner. It carries the hard time everything else back-calculates from, a location (Place), a work/personal tag, an origin (self-added or org-assigned), attached Notes, and attached Tasks. State: provisional → committed.
- **Leg** — a movement between two Places. Hard (a booked train at a fixed time) or soft (a walk, a drive, a Tube hop — elastic, continuously re-timed). Mode-agnostic: foot, cycle, e-scooter, Tube/metro, Overground/suburban rail, bus/tram, mainline & high-speed rail, cross-border rail, taxi/rideshare, private car, hire car, coach, ferry, flight. Holds mode, route geometry, live status, and timing.
- **AnchorCard** — the three-variable model at the heart of the planner: arrive-by, duration, leave-by; any two determine the third. State moves fuzzy → provisional → committed.
- **Place** — a resolved location with its true entrance and coordinates (station entrance, office door, car park), never a map centroid.
- **Ticket** — a held booking, which may carry a verbatim barcode payload (the e-ticket itself), fare details, and the link to its supplier.
- **Person** — a companion travelling with you, or a contact to keep informed; carries the sharing tier granted to them (D4).
- **Note** — free-form or structured notes bound to a Commitment or Day: prep notes and outcome notes (outcome notes reviewable by the org for work visits).
- **Task** — a to-do bound to the day or a commitment (part of the readiness check).
- **Readiness** — the per-day/per-trip checklist state (B3): what’s confirmed, what’s missing, what still needs sorting.

**Recurrence** (user-set): a Commitment can carry a user-defined RRULE-style repeat. Explicit and user-controlled — never inferred. No whole-day template; a recurring day emerges from recurring events landing on the same date. **Grouping:** Today / This Week / Later / Past.

## B2. The five phases of a travel day

The day-object passes through five phases, all on the one spine. The four rings (Plan → Accompany → Connect → Administer) plus the phase that precedes them all — **Prepare**:

1. **Prepare** — get ready: capture everything, confirm it, check you have all you need, pre-book what’s missing, write the notes, review the plan. (B3.)
1. **Plan** — turn the confirmed commitments into a back-calculated, door-to-door plan. (C2.)
1. **Accompany** — ride alongside the day in real time: watch it, recalculate it, reassure you, guide you, recover it when it breaks. (C6–C8.)
1. **Connect** — connect you to suppliers, in-app, for anything the day needs. (C12.)
1. **Administer** — handle the day’s administrative aftermath: notes filed, expenses, mileage, accounting. (C15.)

## B3. PREPARATION — built out in full

Preparation is a first-class phase, as considered as the day itself. It is the difference between a day you survive and a day you walk into ready. It runs across these stages:

**1. Assemble the day.** Pull every commitment and booking into the day-object via the four capture methods (C1): forward the booking confirmations (they parse and slot in), let the calendar’s structured fields populate the work meetings, add anything manually with closed-set autocomplete, and load the e-tickets so the barcodes are in the app and reproduced ready to scan. Confirmation/e-ticket pairs are de-duplicated and linked. Nothing is typed twice; nothing is guessed.

**2. Confirm and firm up.** The app surfaces anything ambiguous as a confirmable proposal — a messy calendar location to resolve to a real Place, a transition pattern between two legs to confirm (Direct / Drop-and-go / Hub-to-hub), a fuzzy AnchorCard to firm toward committed. You confirm; nothing commits silently. By the end of this stage the day is structurally sound.

**3. The readiness check — “have you got everything?”** This is the heart of preparation, tailored to the specific day. The app assembles a readiness checklist from what the day actually requires and tells you, calmly, what’s sorted and what’s missing:

- **Tickets** — are the e-tickets loaded and reproduced (barcodes verified, ready to scan)? Any leg still without a ticket is flagged.
- **Documents** — does this day need them? Photo ID for some domestic flights; passport (and its expiry checked against the date) for international; any visa; a driving licence for a hire car; the work documents the visit needs. *(Note: the UK’s ETA scheme is now live for inbound visitors — relevant for international companions/clients; see Part K.)*
- **Bookings** — is everything the day needs actually booked? Parking at the station or airport, the hotel for an overnight, the onward ride, a table for the client dinner.
- **Devices & power** — a reminder to charge, and (where relevant) that you’ll be relying on the phone for tickets and navigation.
- **International** — passport + visa checked, currency (and the home-currency view set up), an eSIM sorted so you have data the moment you land, the destination timezone noted.
- **Rural drive** — fuel or charge for the distance, parking sorted at an unfamiliar destination, the route checked for a day with no rail fallback.
- **Multi-day** — hotel check-in/out times, what to pack at a glance (the trip’s shape — nights, weather, occasions), the full multi-day itinerary assembled.
- The notes and materials the day needs (next stage).

Anything missing is not just flagged — it’s actionable: book the parking here, sort the eSIM here, set the reminder here. You finish this stage knowing you have everything.

**4. Pre-book what’s missing.** Where the readiness check finds a gap the day needs filled — parking, a hotel, a lounge for a long layover, a ride — you book it in-app then and there (C12), and it flows back into the day-object as a Ticket/Commitment. Preparation is where most connections happen, calmly, in advance — not scrambled in the moment.

**5. Notes & materials.** Attach the prep notes the day’s commitments need: what the meeting is about, the agenda, who you’re seeing and their details, what to bring, the context, the documents to have on hand. These live on the Commitment, so when you arrive you open the day and everything you need to walk in prepared is right there. (For work visits, notes are also where the outcome will be recorded afterward, reviewable by the org — C13.)

**6. Review the plan.** With the day assembled, confirmed, ready and noted, the app shows you tomorrow before it arrives: the back-calculated leave-by, the route and its legs, the buffers on each commitment, anything fragile. The night before, you get a calm, complete review — “here’s your day, here’s when you leave, here’s everything you need, you’re ready” — and you sleep on a handled day rather than an anxious one. This is preparation’s payoff: the anxiety is discharged the evening before, not white-knuckled in the morning.

**7. Set up who’s informed.** Decide, in advance, who to keep in the loop — the office (status/ETA for the work visit), a spouse (live position if you choose to give it). All individual-controlled (D4).

-----

# PART C — THE COMPLETE FEATURE SET

## C1. Capture & ingestion **[Build: L0]**

The principle: Khonsera never asks you to re-type what you’ve already booked, and never guesses. It captures the facts where they already live, structured. No free-text parsing (tested: >70% failure). Four methods:

1. **Email-forward-to-import (the primary path).** You forward — or set up auto-forwarding of — booking confirmations. The hard problem is signal isolation, not parsing: booking emails are a tiny transactional fraction buried in a mailbox of marketing, and the reliable discriminator is the sender address (Trainline’s transactional `auto-confirm@info.thetrainline.com`, never its marketing domain; Booking.com’s `customer.service@booking.com`). Parsing runs per-provider modules keyed to a sender allowlist, preferring the most structured sub-source available in order: the attached `.ics` → embedded ISO datetime attributes → the plain-text part → finally HTML scraping. Confirmation and e-ticket emails are de-duplicated and linked by transaction ID so a two-email booking becomes one object. Every import is shown and confirmed before it commits.
1. **Manual structured add.** Add by hand from closed-set autocomplete — known stations, known places — never a free-text box the app must interpret.
1. **Calendar structured-field pull.** Read the structured fields of a calendar event (time, title); confirm a messy location with you rather than parsing it.
1. **Barcode read-and-recreate.** The e-ticket becomes a first-class object. **[VERIFIED — see Part K.]** UK rail e-tickets are **Aztec barcodes built to the RSP-6 / RSPS3001 standard** (authored for the Rail Settlement Plan), digitally signed with **asymmetric public/private-key (PKI) cryptography** so gates validate them **offline** without a database call. The signed payload **cannot be reconstructed from parsed fields** — without the private key a rebuild fails the barrier. The spec is deliberately **not public** (the RDG has refused FOI requests for RSP-6). Therefore the only viable pipeline is **exact reproduction**: symbology-agnostic detection (Aztec / PDF417 / QR / Code128) → rasterise the source PDF at high DPI → decode the precise binary payload → store it **verbatim** → re-encode **bit-identical** (same symbology and error-correction level) → **mandatory round-trip verification** (decode our own recreation and assert byte-identity; on any mismatch, fall back to the original PDF). One Aztec decoder covers every UK operator. Air boarding passes are **PDF417 / IATA BCBP** — an open, parseable format — handled by the same detection pipeline as a later module. *The barrier is no longer technical (the pipeline is sound and confirmed); the remaining question is contractual comfort — see Part I and Part K.*

**The structured query layer.** Once the day is structured, ask it questions in plain words — “when do I leave?”, “what platform?”, “how long’s the gap at lunch?”. Read-only; wholly separate from parsing-to-build. **Not built:** free-text trip creation, arbitrary scraping.

## C2. Planning & back-calculation **[L1]**

A day stops being a list of booking times and becomes a back-calculated, door-to-door plan.

- **Back-calculation** — working backwards from the hard commitment through the leg chain to the leave-by and wake moment: “to be at your 10:00 in the City, you leave the house at 06:42.” You are told the one time that matters.
- **The buffer model** — arrive-by − projected-arrival = buffer, classified comfortable / tight / insufficient. The buffer is the engine’s core safety quantity and the basis of nearly every reassurance and contextual nudge.
- **Soft vs hard legs** — hard legs (a booked train) are fixed points; soft legs (walking, driving, Tube) are elastic and continuously re-timed against live conditions.
- **The three transition patterns** — Direct, Drop-and-go, Hub-to-hub — inferred from geometry and timing, surfaced as a confirmable proposal (never silently assumed).
- **Ranking** — where multiple routings exist, speed alone; exclusions are the only filter; no preference-weighting (explicitly rejected).
- **Arrival precision** — resolve the true door (entrance, platform), so the final leg is honest.

## C3. Navigation — owned, commitment-aware **[L1]**

Navigation is owned end to end, including street-level turn-by-turn. One capability, three faces: routing-for-timing (feeding the planner), arrival precision, and turn-by-turn guidance. The differentiator is that the guidance is **commitment-aware** — it carries consequence: “turn left — still fine, no rush” when you have time in hand, versus an urgent tone when a hard return is genuinely at risk. Live position feeds the whole-day cascade. A misroute is brand-lethal.

## C4. City mobility — the tube-hopping reality **[L1 + L2]**

The day spent moving around a city is a dense chain of short legs across modes, operated at full granularity:

- **Multimodal point-to-point** between every commitment — which line, which change, the walking segments, the taxi option — as a continuous plan.
- **The network maps people navigate by** — the Tube map, the Overground map, and the destination city’s metro map — with your route highlighted (line geometry + schematic render + highlight; a distinct data-and-design feature).
- **Live arrivals at every step** — “next Victoria line in 2 minutes,” “your Jubilee train, platform 3.”
- **Line-status-aware rerouting** — a suspended line re-plans the city day exactly as a cancelled train re-plans an intercity one, fed into the cascade and recovery.
- **Owned street navigation** for the walking legs.
- **The decision-clock and buffers inside the city** — “to make your 14:00, leave by 13:31; if the line stays down, 13:20 via the alternative.”
- **Contextual actions in-city** — “your line’s suspended → a £12 taxi unlocks the meeting.”

**[VERIFIED]** TfL’s Unified API is the launch-market gold standard (Tube/DLR/Overground/Elizabeth line/buses/cycle hire/line status/live arrivals — free, app_id/app_key registration). The same capability generalises to any city via GTFS-RT + OpenTripPlanner + the local agency’s API.

## C5. Rural & driving — the other end of the spectrum **[L1 + L2]**

Just as good on a country lane as in central London, and never assumes dense transit:

- **Driving as a first-class mode** — full road routing (Valhalla/OSRM over OSM), commitment-aware turn-by-turn, traffic-aware soft-leg timing, honest drive times back-calculated to the leave-by.
- **No-rail days handled natively** — the plan is built on car (and any coach/local options), with no assumption of a station fallback.
- **Rural parking** — finding and (where possible) pre-booking/paying parking in an unfamiliar market town or at the destination, via the parking layer.
- **Fuel/charge awareness** in the readiness check for the distance involved.
- **Weather on the actual corridor** — country roads and weather matter more; the weather-leave-earlier rule applies.
- **Long-drive reassurance** — buffers and the decision-clock work identically; the day is watched whether it’s a Tube line or the A1.

The city-mobility and rural-driving capabilities are two ends of one spectrum; the engine spans both because legs are mode-agnostic and routing covers driving as completely as transit.

## C6. Live orchestration **[L2]**

The plan comes alive — it watches the day in real time, says what’s changed, what it means, and by when to act.

- **The Today-state machine** — Today morphs automatically through calm → imminent → live → disruption, adopting the character of whatever’s most live.
- **The decision-clock** — “act by 09:12”: the latest moment a decision can still be made before an option is lost. The single most reassuring number the app produces.
- **Consequence translation** — “delayed 12 minutes” becomes “you’ll miss the 09:40 connection — act by 09:12.” The app does the arithmetic.
- **The whole-day cascade** — a change in one leg recomputes every downstream leg and commitment; every buffer re-derives; the day re-stabilises or flags a break.
- **Fragile-plan detection** — flags a plan with no slack before it breaks, so you can add a buffer while you still can.
- **In-the-moment guidance** — “this is your stop”; live position; the small, well-timed prompts that mean you don’t have to watch the board.

## C7. Recovery / disruption **[L3]**

When the day breaks, Khonsera computes the way out — it does not merely report the problem. **[VERIFIED]** Re-planning fires only on a genuine break (Darwin is the always-on spine; **RTJP** — the Real Time Journey Planner, an Online Journey Planner feed derived from SilverRail’s IPTIS engine — is a paid scalpel used only at the disruption moment; most journeys generate zero RTJP calls). It generates viable alternatives (exclusions filtered). The consequence band shows the outbound-and-return booking pair as a single unit, with the live impact of each alternative as you step through them. It shows the trade-off until the protect-target decision is settled; ranks by it after.

## C8. The contextual-action engine — the concierge moments **[L4] ⭐**

The differentiated heart. Each is a rule binding a live signal → a condition → a proposed action → an in-app booking, confirmable, never auto-inserted, with thresholds as sensible fixed defaults, adjustable per-plan, never learned:

- **Running late → expedite security.** The rule triggers on **buffer thinness as the baseline** — projected arrival below a safe margin against the airport’s check-in/security guidance offers fast-track — and **enriches with live queue data wherever a feed exists**. It works in the UK from day one on the buffer signal and sharpens as queue data is added. **[VERIFIED]** Booked via **DragonPass**, which exposes a live developer API with resource-specific **fast-track and lounge prebooking** endpoints (`/v2/orders/...prebooking`), availability queries, cancellable orders, and a **QR-code voucher** presented at the lane — with UK airport coverage confirmed. You pay DragonPass; we commission. The flagship.
- **Long layover / early arrival → a lounge** sized to the exact window (DragonPass / Collinson).
- **Tight connection → meet-and-assist** (Collinson / Priority Pass network).
- **Gate changed → reroute the in-terminal walk** from your current position to the new gate; restate the time in hand (“new gate, still 14 minutes”).
- **Car park likely full → an alternative, pre-booked/paid in-app** (Parkopedia live + provider-supplied predicted occupancy — provider data, never anything we learn about you).
- **Weather degrading the drive → leave earlier.**

## C9. International travel — the membrane travels with you **[spans L0–L5]**

International is the engine operating across borders — the day-object, planning, live watching and contextual care are identical anywhere; what changes is which data sources light up:

- **Destination-city transit** — Paris (RATP / Île-de-France Mobilités), Berlin (BVG / VBB), Madrid, Rome, Amsterdam (NS / GVB), via their GTFS/local APIs.
- **The destination airport’s data and airport-experience layer.**
- **Currency** — spend shown in your home currency throughout (FX), so a Paris taxi reads in pounds.
- **Timezones** — every time correct across the trip, the body-clock respected.
- **Connectivity** — **[VERIFIED]** an eSIM sorted before you land via **Airalo’s Partner API** (full REST API + SDKs, net-pricing model so we keep the margin, sandbox/production, low-data webhooks, iOS Universal Link direct install, 200+ destinations), killing the “no data in a foreign airport” anxiety spike — flagged and sortable in the readiness check.

A London→Paris day is one back-calculated plan: Eurostar (St Pancras → Gare du Nord), the onward Métro/RER, the meeting — prepared, watched live, euros shown in pounds, Paris time handled, data live on arrival.

## C10. European & cross-border rail **[L2 / L5]**

Eurostar (London–Paris/Brussels/Amsterdam) then the national operators — SNCF/TGV (France), Deutsche Bahn/ICE (Germany), Trenitalia/Italo (Italy), ÖBB (Austria), SNCB (Belgium), NS (Netherlands), RENFE (Spain), SBB (Switzerland). Live running via national feeds/HAFAS where exposed (SNCF’s open Navitia-based API and DB’s OpenData are the most accessible); booking referred via **Rail Europe** (API/affiliation) or, preferably for the no-leave membrane, a **no-redirect aggregator (Lyko / Omio)** that lets the user book in-app on commission without being sent to the operator’s site. Captured via email + barcode, the symbology-agnostic detector handling varied formats (UIC 918.3 Aztec on the Continent), holding the PDF where a ticket can’t be reproduced. **Honest caveat:** European live-data and ticketing is operator-by-operator, more fragmented than the UK.

## C11. Fares & ticketing **[L1 informing / L5 purchase]**

The product surfaces fare options as part of planning (owned, informing) — “the 09:40 is £45 anytime, the 10:10 is £28 off-peak” — and refers the purchase (affiliate); it is not a fare retailer. **[VERIFIED context]** UK fares and routeing data come from the RDG / National Rail fares feed, now provisioned through the **Rail Data Marketplace**; this is the data that powers fare-type display and the split-ticketing opportunity. International fares from booking partners (Rail Europe; Duffel for flights). Cost-intelligence uses this.

## C12. Connections & bookings **[L5]**

Anything the day needs, you transact in-app, without leaving — hotel, parking, ride, flight, lounge, car hire, coach, ferry, dining, eSIM. A reusable supplier pattern (search → availability → book → confirm) behind an embedded transaction surface; the supplier collects payment through its own integration (Khonsera is not the merchant of record); we commission; the booking flows back into the day-object as a Ticket/Commitment. Most connections happen calmly in preparation (B3), not scrambled in the moment.

## C13. Notes — prep, visit, reviewable **[L0 + D2]**

Notes are a first-class capability. Prep notes attach to a Commitment — the agenda, who you’re seeing, what to bring, the context — so you walk in ready (assembled during preparation, B3). Outcome / visit notes are recorded during or after — what happened, the result, follow-ups. For work visits, outcome notes are reviewable by the organisation (it set the visit; it has a right to the outcome — Part D), while personal notes stay private. Notes are searchable via the structured query layer.

## C14. People, comms & safety — the two-tier sharing **[spans L0/L2/L5]**

- **People.** Person companions get a shared plan view; contacts can be kept informed.
- **Two-tier sharing (the privacy line, D4):** the employer tier sees only **status + ETA** for work commitments — never live location, even on work time. The personal tier can receive live location, but only as a **gift the individual gives** — opt-in, named recipient (a spouse, a parent, a friend), per-journey, time-bounded, revocable. Same technology, opposite governance; the difference is consent, relationship and motive.
- **Comms.** The app composes the right message at the right moment — “running 15 late, start without me” — and the OS send-sheet sends it (we own compose, the OS owns send; not a messaging app).
- **Safety.** For a lone or after-dark arrival, surface reassurance and the relevant actions — a vetted ride, a lit route, an ETA shared with someone — calmly. (Backed by the same personal-tier live-sharing capability.)

## C15. Expenses, mileage, costs, accounting & approvals **[L6, parallel from L1]**

The admin aftermath, to specialist standard, for employee and self-employed:

- **A full mileage tracker** — automatic drive detection; stores the actual GPS route (not a derived estimate); auto-logs distance/route/times; swipe business/personal classification; user-set classification rules (“drives on this route are always business” — explicit, never silently learned); a complete claim-ready ledger and HMRC-rate report; full manual edit and history. **Privacy seam:** automatic capture is opt-in, and the ledger is the user’s own private record — distinct from the journey-sharing boundary (visibility to others); the “never ambient” rule governs sharing with others, not a user logging their own drives.
- **Expenses** — receipt capture bound to the relevant leg/day; cost-intelligence proposes when a costlier option meaningfully de-risks the day (“a taxi here unlocks the whole day”) — a proposal, never automatic; and (in a workspace) shows spend against the pre-approved cap.
- **Accounting** — export and partner sync (Xero/QuickBooks), with the override package.
- **Approvals** — a workplace approval flow on the actor model for trips and over-cap spend; self-employed mode runs without it.

## C16. The reassurance & experience layer **[cross-cutting]**

The soul of the product, and an obligation, not a screen. Every feature’s output must land as calm, not a dashboard. When a structural or administrative decision pressures the reassurance layer, **reassurance wins**. The concierge tone is the product. Restraint — surface the one thing you need now, withhold the rest; a quiet Today when the day is quiet; the decision-clock as calm, not pressure; the readiness review the night before so anxiety is discharged early. Built for the traveller first.

-----

# PART D — THE ORGANISATION (B2B) & PRIVACY

## D1. The one-day model

The individual lives in the frame of one day, not a work day and a personal day. There is no mode to toggle — one unified live view blends every commitment: the 9am client meeting, the 1pm dentist, the 4pm site visit, the 6pm dinner. Each commitment is tagged (work/personal; self-added/org-assigned), and that tag draws a visibility boundary: the organisation only ever sees the work-tagged slice. Personal items are wholly invisible upward. The partition is a **privacy boundary** between the individual (sees everything, one view) and the org (sees the work slice only) — not a UI mode the individual operates.

## D2. The organisational layer

Khonsera is also the system an organisation runs its people’s travel through — without ever seeing their personal lives. An org, coordinator or manager can:

- **Set visits for staff** — assign visits and travel to employees; they appear in the employee’s one-day view as work commitments.
- **Track work commitments** — see the work slice of staff days, where the relationship permits (never the personal slice).
- **Add and review notes** — employees attach outcome notes to visits; the organisation reviews them.
- **Book** — arrange travel and accommodation within policy.
- **Approve** — manager approval flows for trips and for spend.
- **Set expense gates (caps)** — pre-approved spend thresholds; above the cap requires approval.
- **See spend versus the pre-approved cap** — live visibility of spend against the cap, used versus remaining.
- **Submit over-cap expenses for approval** — spend exceeding the cap is routed for sign-off.

All bound by the doctrine: it enables the workflow and the purchase but never makes the traveller feel watched. Adoption stays bottom-up; the individual’s experience is primary and never degraded.

## D3. The rights line — work + spend + duty of care, never the person

We show the business the work, never the worker. The organisation’s legitimate rights run to three things and stop at the person:

1. **The work it assigned** — that the visit happened, the outcome/notes, the work-relevant facts including status and ETA to the work commitment.
1. **The money it spends** — caps, approvals, spend-against-cap, over-cap sign-off, policy compliance, audit-ready expense and mileage records.
1. **Its duty of care** — served through employee-controlled tools (the individual choosing to share live location, a check-in, an SOS that summons help), not employer always-on tracking. The obligation is met; the person stays in control.

**The hard limits — never the person:** never live, moment-to-moment location; never the personal life; never behavioural telemetry beyond the work outcome (route, dwell, “why six minutes longer”); never a 24/7 window. The business sees the trip, not the person.

## D4. The two-tier sharing model

- **Employer tier** — status + ETA for work commitments only; never live location, even on work time. The permanent cap.
- **Personal tier** — live location, but only as a gift the individual gives to a named recipient (spouse/parent/friend); opt-in, per-journey, time-bounded, revocable. The spouse can’t demand it; the employer can’t grant it to themselves.

## D5. Privacy architecture

- **Protection is architectural, not policy** — personal items are tagged and never exposed to the org; there is no admin toggle that could reveal them, because the capability doesn’t exist.
- **The individual owns their data; the company licenses a capped view of the work slice** — the person keeps their Khonsera life if they leave the company.
- **Transparency, no secret view** — the individual always sees exactly what their employer can see, and the answer is fixed and small.
- **Consent-gated escalation** — nothing beyond the baseline without the individual’s explicit, revocable consent; duty of care via employee-initiated sharing/SOS.
- **Aggregate, not per-person, analytics.**
- **Default-private on ambiguity.**

**Why this isn’t a trade-off:** protecting the individual is the precondition for delivering to the business. A tool employees trust is a tool they use — and only a used tool yields the reliability, controlled spend and audit-ready admin the company is paying for. It also de-risks the buyer (employment law, GDPR, employer-brand). The “employees beg for it” and “never watched” north stars are the same constraint, and that constraint is what makes the enterprise sale deliver. *(This posture is also a competitive moat in the agentic era — Part J — because the dominant corporate-travel-AI direction is exactly the policy-enforcing, auto-rebooking, surveillance-adjacent model Khonsera refuses.)*

-----

# PART E — HOW IT SERVICES EVERY CLIENT

Each walkthrough runs end to end — preparation and day-of — and names the features and data sources that serve them.

## E1. The pure individual (personal use, no workspace)

A professional or private traveller using Khonsera for their own life, with no employer connected. **Preparation:** they forward their train and hotel confirmations (Trainline, Booking.com), the e-tickets load and reproduce, the calendar’s personal events pull in, and the readiness check confirms tickets-loaded, hotel-booked, and (for a trip away) what to pack and any documents. They write any notes they want. The night before, they review the plan — leave-by, route, buffers — and sleep on a handled day. **Day-of:** the back-calculated leave-by, owned navigation door to door, the live state machine watching every leg, the decision-clock and consequence translation, recovery if a train’s cancelled, and the contextual moments (a lounge on a long layover, fast-track if they’re running late). They can give live location to an anxious partner. Everything is personal; nothing is shared upward. **Data:** geocoding/routing, Darwin/RTT, TfL or local transit, the connection partners, FX/tz/eSIM if abroad.

## E2. The individual within a conceptual workspace (employed, org-connected)

Same individual, now connected to an employer. **Preparation:** their org-assigned visits appear in the same one-day view alongside their personal commitments; they prep notes for the visits, the readiness check confirms the work day’s needs, and they pre-book within policy (spend shown against the cap). **Day-of:** identical rich personal experience — plus the employer sees only status + ETA to the work visits and, afterward, the outcome notes; spend tracks against the cap with over-cap items routed for approval; mileage logs claim-ready. The personal slice — the dentist, the dinner, the partner they share live location with — is invisible to the employer. They get executive treatment; the company gets reliability, documented visits, controlled spend, and audit-ready admin; nobody is surveilled. **Data:** as E1, plus the org/tenancy + approvals + accounting layer.

## E3. The individual who works just within a city

A city-bound worker — meetings across London, never leaving. **Preparation:** the day’s meetings assemble (calendar + manual), each with prep notes and a resolved Place (true entrances); the readiness check is light (no tickets/passport — just “you’re set, here’s the shape of your day”). **Day-of:** city-mobility in full — multimodal point-to-point between meetings, the Tube and Overground maps with the route highlighted, live arrivals at every step, line-status-aware rerouting (“Jubilee suspended → here’s the alternative, or a taxi unlocks your 2pm”), owned street nav for the walks, and the decision-clock/buffers applied within the city. Contextual cost-intelligence (“a £12 taxi saves the meeting”). **Data:** TfL Unified API (gold standard — Tube/Overground/Elizabeth/buses/line status/live arrivals), geocoding/routing, rideshare for the taxi option.

## E4. The individual who works within cities and travels away

Multi-city plus intercity travel — a London morning, an intercity train to Manchester, an afternoon of meetings there. **Preparation:** the rail booking forwards and loads (barcode reproduced), the Manchester meetings assemble, the readiness check confirms ticket-loaded + the onward city legs + any overnight; notes per meeting; the plan reviewed the night before. **Day-of:** the day fluidly switches register — city mobility in London (Tube to Euston), the intercity hard leg watched live on Darwin/RTT with platform and the decision-clock, recovery if it’s disrupted, then city mobility again in Manchester. Transition patterns (Hub-to-hub at the station) confirmed in prep. Contextual moments throughout. **Data:** TfL + Manchester local transit (GTFS/OTP), Darwin/RTT/RTJP, geocoding/routing, the connection partners.

## E5. The person who does single-day visits (out and back)

A field professional doing a day visit — out to a client site and back the same day, often by car or a mix. **Preparation:** the visit is org-assigned (or self-added), with prep notes (the site, the contact, what to bring, the agenda) and the address resolved to a true entrance/car park; the readiness check confirms the route, parking at the destination, fuel/charge for the distance, and the documents the visit needs; the back-calculated leave-by is set. **Day-of:** door-to-door drive (or mixed) with commitment-aware nav, the day watched live, buffers and the decision-clock, the car-park-full contingency, weather-leave-earlier on the corridor. Afterward, the outcome note is recorded (reviewable by the org), mileage auto-logs the actual GPS route, the expense captures, spend tracks against cap. **Data:** routing/geocoding (driving), Parkopedia (Arrive), Open-Meteo, mileage/GPS, the org/notes/expense layer; rail/Darwin only if part of the mix.

## E6. The person who does multi-day visits (overnight, multi-day)

A multi-day trip — travel out, two nights away, several meetings, travel back. **Preparation:** the multi-day Day span assembles — outbound travel, hotel (check-in/out times), each day’s meetings, return travel — all captured; the readiness check covers what to pack for the trip’s shape (nights, weather, occasions), documents, the hotel and any onward bookings, devices; prep notes per meeting; the full multi-day itinerary reviewed in advance. **Day-of (each day):** the relevant day projects into Today and is operated in full — travel legs watched, city mobility or driving as needed, contextual moments, the hotel as an anchor (check-in aligned to arrival, early-checkout-vs-first-meeting flagged). Across the trip: spend accumulates against cap, notes filed per visit, mileage/expenses captured. **Data:** the full stack — rail/flights/Darwin, hotels (Booking.com Demand), local transit per city, routing, FX/tz/eSIM if international, the org/expense layer.

## E7. The rural, drive-only worker (no rail in their network)

Everything rural, car only — trains are simply not part of how this person travels. **Preparation:** visits (often org-assigned) assemble with prep notes and addresses resolved to true entrances/car parks in unfamiliar market towns; the readiness check is driving-shaped — the route checked for a day with no rail fallback, fuel/charge for the distance, parking sorted at the destination, documents and materials for the visit, the leave-by back-calculated from drive time. **Day-of:** driving is the first-class mode — full road routing, commitment-aware turn-by-turn, traffic-aware timing, the day watched and buffered exactly as a rail day would be, the decision-clock on the drive, weather-leave-earlier (country roads, weather matters), rural parking contingencies. Afterward: mileage auto-logs the actual GPS route (the heart of this persona’s admin value), outcome notes filed, expenses and HMRC-rate claims ready, spend against cap. The product is just as complete for them as for the city worker. **Data:** routing/geocoding (driving, OSM), Parkopedia (Arrive), Open-Meteo, mileage/GPS, the org/notes/expense layer — no rail dependency at all.

-----

# PART F — THE STACK

- **F1. Frontend & maps.** React (with SVG components) for the app UI. MapLibre GL JS as the map renderer, over self-hosted Protomaps vector tiles (effectively free at any scale). The schematic network maps (Tube/Overground/metro) rendered from line geometry with route highlight.
- **F2. Routing.** Valhalla / OSRM self-hosted for driving/walking/cycling routing and turn-by-turn, over OSM / Geofabrik data; OpenTopography for elevation. Rail geometry correctness via **OSM route relations / Network Rail ELR data** where needed — avoiding the raw-OSM-ways error class (the Leicester–Derby misroute).
- **F3. Backend, data & auth.** Supabase — Postgres with **Row-Level Security** enforcing the privacy boundaries (personal-private-from-org, the two-tier sharing, the private mileage ledger), auth, and migrations. The day-object model lives here; RLS is the structural guarantee behind Part D.
- **F4. Transit & rail engines.** OpenTripPlanner (OTP2) self-hosted for multimodal transit routing (GTFS + OSM); GTFS / GTFS-RT feeds via the Mobility Database/Transitland; TfL Unified API for London; **Darwin (LDBWS), Realtime Trains, and RTJP — all now provisioned via the Rail Data Marketplace (raildata.org.uk); Darwin REST, not legacy SOAP**; National Rail Knowledgebase and the RDG fares feed (also via RDM).
- **F5. Barcode, payments, integrations, hosting.** Aztec/PDF417/QR decode + bit-identical re-encode libraries with round-trip verification for the ticket pipeline. **Stripe/Adyen for Khonsera’s own subscription billing only** (suppliers collect for connections); Apple/Google Pay at checkout. The connection/affiliate partners per Part G. Frontend hosting/deploy via Vercel. Live data consumed via **webhooks/push wherever available** (cost + battery) over polling.

-----

# PART G — THE API DIRECTORY (verified · as required)

**Cost legend:** 🟢 free to us · 🟡 low cost · 🔴 paid by us · 🤝 revenue (supplier collects, we commission — or we buy at net and keep the margin). **Role legend:** 🔧 engine-shaping dependency (scope with the engine) · ➕ pluggable (add anytime the surface exists). *Verification status as of June 2026 in Part K; verify free tiers at integration as the landscape drifts.*

- **Foundation (cost-to-us, ~free):** 🟢🔧 MapLibre GL JS · 🟢🔧 Protomaps/OpenFreeMap (tiles) · 🟢🔧 Nominatim/Photon (geocoding/autocomplete) · 🟢🔧 Valhalla/OSRM/GraphHopper (routing) · 🟢 OpenTopography (elevation).
- **Transit:** 🟢🔧 GTFS/GTFS-RT · 🟢 Transitland/Mobility Database · 🟢🔧 OpenTripPlanner/MOTIS · 🟡 Navitia (hosted) · **UK** 🟢🔧 **TfL Unified API** *(verified live, free, app_id/app_key)*, BODS, Traveline/NaPTAN.
- **Rail:** 🟢🔧 **Darwin / LDBWS** *(verified: free & open, but now via Rail Data Marketplace — raildata.org.uk, REST; legacy portal retiring early 2026)* · 🟢/🟡 Realtime Trains · 🔴🔧 **RTJP** *(verified: paid OJP feed, via RDM; the scalpel; gated by the RDG no-retailing licence question)* · 🟢 National Rail Knowledgebase · **UK fares:** RDG fares feed (via RDM) · **intl** *(verified)* — *live data:* 🟢 SNCF (open API, Navitia-based), 🟡 Deutsche Bahn (OpenData, GitHub) / HAFAS; *booking:* 🤝 **Rail Europe** (API / affiliation, 200+ operators incl. SNCF, Eurostar, Trenitalia, Italo, DB, Renfe) — **or, better-fit for the no-leave membrane,** 🤝 **Lyko / Omio** multi-operator aggregators offering **commission-share with deep-link-free, no-redirect in-app booking** (the user transacts without leaving for the operator’s site).
- **Flights:** *data* 🟢 AeroDataBox (status + gates/terminals — *verified: 600 free units/mo, unit-based tiering; no SLA yet*) · 🟢 OpenSky · 🟡 AviationStack · 🔴 FlightAware/Cirium/OAG (production, webhooks) · 🟢 OurAirports; *booking* 🤝➕ **Duffel** *(verified: the standard replacement now that **Amadeus self-service is decommissioned 17 July 2026** — NDC + disruption)* · 🤝➕ Travelpayouts/Kiwi/Skyscanner. **⚠️ Do not build new on Amadeus self-service — keys die 17 July 2026.**
- **Airport experience (🤝):** 🤝🔧 **DragonPass** *(verified: live developer API — lounge **and** fast-track-security/immigration prebooking endpoints, availability queries, QR vouchers, UK coverage; the L4 flagship’s mechanism)* · 🤝 **Collinson** *(verified: B2B partnership — Priority Pass / LoungeKey / Lounge Pass, 1,800+ lounges across 841 airports / 140+ countries, plus **meet-and-assist, pre-booking and transfers**; note **SmartDelay** — lounge access **triggered by a flight delay**, a direct disruption-moment fit. Partner route is sales-led, not self-serve like DragonPass)* · 🟢/🟡🔧 **security wait-times** *(verified: **no official UK national or per-airport public API**; the data exists only inside vendor apps — Collinson/LocusLabs, **Qsensor** (140+ airports), **FlightQueue** — as estimates of variable accuracy; buffer-baseline is the day-one signal)*.
- **Parking:** 🟡/🤝🔧 **Parkopedia** (data + live & predicted occupancy) · 🤝 RingGo/ParkMobile (on-street pay) · 🤝 SpotHero/ParkWhiz (US reserve), JustPark (UK private), YourParkingSpace. **[Corrected] Parkopedia, RingGo, ParkMobile and YourParkingSpace are all now under one parent — Arrive (the June 2025 EasyPark Group rebrand), 90+ countries — so a single commercial relationship can cover find-data + pay + reserve. (ParkWhiz/BestParking are Flash-owned, separate.)**
- **Hotels (🤝➕):** **Booking.com Demand** *(verified: affiliate-partner route; **formal approval takes weeks** — start early)* · Expedia Rapid (+ cars/activities) · Hotelbeds APItude (dedup via GiataID). **[Corrected] Drop Amadeus Self-Service for hotels — it’s decommissioning 17 July 2026.**
- **Ground transport (🤝➕):** Uber/FREE NOW/Bolt/Lyft (rideshare) · car hire (Expedia Rapid Cars / Booking.com — *not Amadeus self-service*) · 🟢 GBFS + CityBikes (micromobility data) · FlixBus/National Express (coach) · Direct Ferries.
- **Context:** 🟢 Open-Meteo (weather) · 🟢 tz database (timezones) · 🟢 Frankfurter/exchangerate.host (FX) · 🟡 Places/Foursquare/Yelp + 🤝 OpenTable/TheFork (dining) · 🤝 **Airalo** (eSIM) *(verified: Partner API + SDKs, net-pricing margin, sandbox, iOS Universal Link, 200+ destinations)*.
- **Payments:** 🔴 Stripe/Adyen (Khonsera’s own subscription only) · 🟢 Apple/Google Pay.

-----

# PART H — THE BUILD ORDERING

## H1. The two lenses

**Engine-shaping vs pluggable:** 🔧 a decision rule’s design is derived from the API’s output → must be early, designed with the engine; ➕ only adds a transact/display surface → add anytime. **Commercial:** 🔴/🟢/🟡/🤝 per Part G — the only real spend is 🔴/🟡 data/infra; everything 🤝 is upside.

## H2. The layers of necessity

- **L0 — Spine.** Day-object model, capture (incl. the barcode pipeline), recurrence, the preparation/readiness framework, notes, actor/RLS/one-day-privacy model, the query layer. 🔧 dep: geocoding + station list. **Done when:** any structured source becomes a confirmed day; barcodes round-trip byte-identical; the readiness check assembles for a day; RLS enforces the personal/work boundary.
- **L1 — Timing base.** The timing engine, buffers, transition patterns, owned navigation, city-mobility and driving routing. 🔧 dep: the routing engine (the single most foundational dependency). **Done when:** a day renders door-to-door with a correct leave-by, true-door arrival, classified buffers; turn-by-turn guides walks and drives.
- **L2 — Live spine.** Today-state machine, decision-clock, consequence translation, cascade, fragility, live arrivals + line status. 🔧 deps: Darwin + Realtime Trains + GTFS-RT/OTP + TfL *(all via RDM/raildata.org.uk for the rail feeds)*. **Done when:** a delay auto-shifts state, states consequence, shows act-by, recomputes the day, warns on fragility.
- **L3 — Recovery.** Re-planning, alternatives, the consequence band. 🔧 deps: Darwin + RTJP; **gated by protect-target + RTJP licence.**
- **L4 — Contextual engine ⭐.** Each concierge rule; the API is the rule. 🔧 deps: security-wait (buffer-baseline + Qsensor/FlightQueue enrichment), DragonPass, AeroDataBox, Parkopedia, Open-Meteo. Sits on L1+L2.
- **L5 — Connections.** The supplier framework + confirmation loop + international/European rail + fares purchase; most connections invoked in preparation. Mostly ➕ revenue; fast-track/lounge coupled to L4.
- **L6 — Admin.** Mileage tracker, expenses, cost-intelligence, accounting, approvals, the org/B2B layer (visits, tracking, notes-review, caps, spend-vs-cap, over-cap approval). Parallelisable from L1.

*(No learning layer. Personalisation is explicit/user-set. The moat is execution — the membrane to specialist depth, the barcode recreate, the concierge feel, the supplier relationships, and the agentic-era position in Part J.)*

## H3. The saleable cut (UK launch MVP)

Build relentlessly to this line, then fast-follow:

- L0 capture (email + barcode + manual + calendar) + day-object + recurrence + the readiness/preparation framework + notes.
- L1 plan (back-calculation, buffers, true-door arrival) + owned navigation (city + driving).
- L2 live (state machine, decision-clock, consequence, cascade, fragility) + city mobility on TfL (maps, live arrivals, line-status reroute).
- L3 rail recovery (Darwin-driven; trade-off display).
- L4 the flagship running-late → fast-track (buffer-baseline, DragonPass) + at least lounge.
- The one-day-privacy model and RLS from day one; basic org-assigned visits + notes + mileage/expenses for the workspace personas.
- §C16 reassurance throughout.

That is a saleable product: it prepares your day, plans it door-to-door, watches it live, gets you around the city and down the country lane, handles disruption, delivers the flagship concierge moment, and serves both the individual and the workspace — in the UK. **Fast-follow:** broader L5 connections, full international/European rail, fares depth, the full org/approvals/cap layer, richer per-airport queue enrichment.

## H4. Critical path & parallelisation

**Critical path:** L0 → L1 → L2 → L3. **L4** sits on L1+L2 (start the flagship fast-track first). **L5** plugs onto L4 and the preparation surface. **L6** runs **in parallel** from L1 — it needs the day-object and routing, not the live engine, so admin/mileage/org work does not block the critical path. **L7 does not exist** (learning removed). Webhooks over polling throughout.

## H5. Founder procurement readiness (verified lead times)

Standing instruction to Code: at the start of each phase, before any API-dependent code, issue the founder a **Procurement Brief** (Provider · Action · URL · Cost · Lead-time · Env var) and don’t start the API-dependent work until keys are in hand or a mock is stood up.

**Start now — slower than the code:**

- **Rail Data Marketplace account (raildata.org.uk)** — subscribe to LDBWS/Darwin (free, ~instant), Realtime Trains, **RTJP (paid, licence — and the no-retailing clarification with RDG)**, and the fares feed. *This single account now front-doors most of the UK rail stack; the old portal is retiring.* (L0/L2/L3.)
- **DragonPass** partner/developer API — lounge + fast-track (L4 flagship + L5 revenue). Apply early.
- **Collinson / Priority Pass** B2B partnership (L5).
- **Booking.com Demand** — *formal approval takes weeks* (L5). Expedia Rapid / Hotelbeds likewise.
- **Duffel** — flight booking + disruption (L5). **And migrate any Amadeus self-service usage off before 17 July 2026.**

**Quick self-serve keys, each ahead of its layer:** National Rail Knowledgebase (L0); TfL (L2); AeroDataBox + Qsensor/FlightQueue evaluation (L4); Uber (L5); Airalo (L5, sandbox→prod single env); Xero/QuickBooks (L6).

**Needs nothing from the founder** (🟢/keyless): routing, geocoding, GTFS/OTP, Open-Meteo, FX, tz, GBFS, Protomaps/OpenFreeMap.

## H6. The Code ↔ Design hand-off / hand-back contract

**Actors:** **Code** (repo, engine, migrations, APIs), **Design** (brand, screens, CSS, Edition II skin, design tokens, concierge components — owns how each layer surfaces), **Orchestrator** (the founder — single decision-maker; ferries packs, makes the calls, course-corrects rather than being interrogated).

**The four-beat loop, per phase/layer:** **Ship** (a zip handoff pack + an honest completion signal stating what’s done and what isn’t, backed by tests/review not vibes) → **Ferry out** (a minimal carrier note) → **Hand back** (the other half + signal) → **Lock** (in `DECISIONS.md`, then the next phase).

**Pack contents:** Code→Design ships the component contract (`docs/component-contract.md`) — components, states, data shape, live examples; *Design builds against the new concierge components, not the legacy atom classes* (Edition II currently targets legacy atoms — the contract exists to stop that drift). Design→Code ships the export pack (skinned components, `docs/design-tokens.md`, CSS, override package) mapped to the contract.

**Challenge / rebuttal:** either agent may challenge the other’s slice, but only with an **ordered rationale** (the mechanism it improves or failure it prevents · the concrete alternative · the cost · why the cost is worth paying). The receiver **adopts or rebuts** with the same four points — silence is not a response. Design’s standing remit: demand a change whenever output can’t land as calm (reassurance outranks structural convenience). Code’s standing remit: demand a change whenever a skin implies certainty the engine can’t honestly produce. One exchange, then it escalates to the founder with both cases in a paragraph each — decide, lock, move.

**Rule:** no layer is done until both halves close the loop and the reassurance criterion (§C16) is met.

-----

# PART I — OPEN DECISIONS & RESEARCH

Resolve in `DECISIONS.md`:

- **Protect-target** → gates L3 recovery ranking. The first to close (it contradicts the locked speed-only model; until resolved, recovery shows the trade-off rather than ranking). *Entirely the founder’s call; highest-leverage unblock in the plan.*
- **RTJP licence (RDG no-retailing clause)** → gates RTJP use in L3: confirm **in writing** that computing options + affiliate referral doesn’t breach it. **[Now sharper — Part K confirms RTJP is a licensed paid OJP feed on the Rail Data Marketplace; the clause question is real and should be raised through the RDM licence process.]**
- **Barcode reproduction comfort (retailer T&Cs / National Rail Conditions of Travel)** → gates shipping the recreate. **[Re-framed by verification — Part K: the pipeline is technically sound and the standard is confirmed RSP-6/PKI. The decode/store/verify build can proceed now. The residual risk is (a) contractual — a retailer’s T&Cs forbidding extraction/redisplay, and (b) operational — gate duplicate-detection deny-lists a barcode if the *same* ticket is presented twice. Neither is a forgery question (you’re re-rendering a ticket the user legitimately holds), but both warrant a clear policy decision and, ideally, a quiet conversation with RSP/RDG.]**
- **~UK security-queue sourcing~ → RESOLVED (Part K).** No official UK national feed exists. Buffer-baseline ships day one; live enrichment via **Qsensor / FlightQueue** (third-party estimates), evaluated for accuracy and partner terms during L4. No longer a blocker — a vendor-selection task.
- **UK rail fares feed** — RDG fares data via RDM; the split-ticket opportunity to scope. (Data dependency, not a blocker.)
- **Workspace nav definition; legacy brief field-parity inventory before stripping it; wordmark typeface licence** (brand, non-blocking).
- **[New] Agent-facing interface** (Part J) — decide whether/when to expose Khonsera as an operating layer that booking-agents can hand off to. Not near-term, but the architecture choice (clean day-object API, MCP-style surface) is cheap to preserve now and expensive to retrofit later.
- **[New] eSIM commercial model** — Airalo offers *net pricing* (buy-at-net, keep-margin) as well as affiliate. Decide which (net pricing is likely better margin but carries light merchant responsibility — check it doesn’t breach the “never merchant of record” principle; eSIM may be the one justified carve-out, or kept as pure affiliate to stay clean).

-----

# PART J — COMPETITIVE POSITION IN THE AGENTIC ERA *(new — the strategic elevation)*

The live-tools pass surfaced the single most important strategic fact the earlier draft couldn’t see: **the entire travel-tech industry is, right now, racing in a different direction from Khonsera — and that divergence is the moat.**

## J1. What everyone else is building

The 2026 consensus is **“agent-led execution”** — autonomous AI that doesn’t present options but *completes bookings* under user parameters. The signals are unambiguous: Google launched agentic booking inside Search/Travel Mode (late 2025), keeping users in its own ecosystem; Skyscanner is embedding across every AI assistant (OpenAI Operator, Microsoft Copilot, a dedicated ChatGPT app) so that wherever someone asks about flights, its data answers; Sabre/PayPal/MindTrip and others are wiring booking into agents; corporate-travel tools like Navan lean into policy-enforcement and automatic rebooking; the OTAs (Booking, Expedia) are racing to stay in the funnel as agents threaten to disintermediate them. Industry forecasters put up to ~30% of bookings through AI agents by 2030. The whole gravity of the market is toward **discover → decide → transact**, faster and more autonomously.

## J2. Why that leaves Khonsera’s ground open — and defended

Almost none of that touches what Khonsera does. The agentic wave optimises **the purchase**; Khonsera optimises **the lived day after the purchase**. Stated plainly:

- **They invent and book trips. Khonsera operates the day you’ve already committed to.** Back-calculated leave-by, true-door arrival, the live state machine, disruption recovery, the contextual concierge moments — none of that is “which flight is cheapest.” It is the part the booking-agents *don’t* do and mostly *can’t*, because it requires deep, calm, real-time operation of one specific person’s actual day, end to end, across every mode including the country lane.
- **They are tied to their own inventory. Khonsera is tied to the user’s real day, whatever they booked and wherever.** Because capture is retailer-agnostic (the confirmation email + the e-ticket, from any source), Khonsera sits *downstream of every booking channel at once* — including the agents. An agent that books a Eurostar still leaves the traveller with a day to survive; Khonsera is what survives it.
- **The agentic corporate-travel direction is surveillance-adjacent. Khonsera’s is the opposite, by doctrine.** The dominant B2B-AI model enforces policy and auto-rebooks — it watches and acts on the employee. Khonsera’s “employees beg for it / never watched / shows the business the work, not the worker” posture (Part D) is not just ethics; in an era where the alternative is more watching, it is a *differentiated, trust-based wedge* that de-risks the buyer and wins bottom-up adoption the surveillance tools can’t.
- **The agents reduce mental effort in planning; they do nothing for travel-day anxiety and credibility.** The two core promises (A2) are precisely the dread the booking-agents leave untouched — *will I make it, which platform, what if it breaks, will I turn up ready.* That is Khonsera’s whole reason to exist, and it is orthogonal to “book it for me.”

## J3. The real threat to name (so it’s managed, not ignored)

The honest risk is **orchestration creep**: IDC and others explicitly describe super-apps + agents becoming “orchestration layers” that extend “into in-trip engagement.” Google’s Travel Mode and the OTA super-apps could, in principle, push from booking into operating the day — Khonsera’s exact ground. The defences are real but must be actively held: (1) **depth** — operating the door-to-door day to specialist standard across every mode is genuinely hard and is not a side-feature a booking giant ships casually; (2) **the anxiety/credibility framing and the calm/restraint experience** — a posture the transaction-optimised giants are structurally bad at; (3) **the privacy/trust wedge** in B2B; (4) **retailer-agnostic capture** — Khonsera’s value doesn’t depend on owning the booking, so being cut out of the booking doesn’t cut it out of the day. The strategic instruction: **never drift toward competing on booking/discovery** (that fight is lost and crowded); **deepen relentlessly on operation, reassurance, and trust** — the ground no one else is seriously contesting.

## J4. The forward opportunity (for the “extend later” horizon)

The same shift that is a threat is also a gift. The industry is being told that suppliers must expose **real-time, structured, agent-readable data** or lose relevance. Khonsera is already API-first and structured. That makes a future move cheap to preserve and potentially powerful: **position Khonsera as the operating layer that booking-agents hand off to.** When a user’s ChatGPT/Google/Copilot agent books a trip, it could hand the confirmed itinerary to Khonsera to *operate* — Khonsera becoming the “now make this day actually work, calmly” layer downstream of any agent, via a clean day-object API / MCP-style surface. That is not a near-term build, but the architecture decision to keep the day-object cleanly addressable (Part I) costs little now and is expensive to retrofit. It turns the agentic wave from a competitor into a top-of-funnel.

-----

# PART K — VERIFICATION LOG & SOURCE REGISTER

*Every external claim checked in the June 2026 web pass, with the verdict and the source. Confidence is the founder’s audit trail: what’s grounded, what’s corrected, what remains a judgement call. (The earlier edition was written without web access and could verify none of this.)*

### Corrected (the prior edition was wrong or stale)

1. **Amadeus self-service deprecation — corrected & made urgent.** Prior: “deprecating ~mid-2026.” Verified: the Amadeus for Developers **self-service portal is decommissioned on 17 July 2026** — registration paused the prior month, keys disabled on the date, portal inaccessible; Enterprise APIs unaffected. This is a hard, imminent deadline (~5 weeks from now). **Action:** build nothing new on Amadeus self-service; flights/hotels/cars route to Duffel / Booking.com Demand / Expedia Rapid. *Sources: developers.amadeus.com; PhocusWire (9 Feb 2026).*
1. **Parking consolidation date — corrected.** Prior: “Arrive (formerly EasyPark Group, rebranded June 2026).” Verified: the rebrand was announced **12 June 2025**. Arrive is the parent of EasyPark, Flowbird, ParkMobile, Parkopedia, RingGo, Yellowbrick, YourParkingSpace; 90+ countries, 20,000+ cities. (ParkWhiz/BestParking are Flash-owned, *not* Arrive.) **Implication (new):** one commercial relationship — Arrive — can cover find-data + on-street pay + reserve across most of the surface. *Sources: Arrive/EasyPark press release (PRNewswire, 12 Jun 2025); Fleet World; Parking Today.*
1. **Darwin access model — corrected (the spine survives, the door moved).** Prior: “Darwin (LDBWS)” with no access detail. Verified: Darwin remains **open and free**, but access has **migrated to the Rail Data Marketplace (raildata.org.uk)**; the legacy National Rail Data Portal **retires in early 2026**; legacy SOAP/OpenLDBWS tokens **no longer authenticate** — you register on RDM and use a consumer key against the **LDBWS REST** product. **Action:** the RDM account is now the front door for Darwin, RTT, RTJP and fares; reflect in F4 and H5. *Sources: nationalrail.co.uk/developers; Open Rail Data Wiki; raildata.org.uk product catalogue.*

### Confirmed & hardened (the prior edition was right; now grounded with specifics)

1. **UK rail e-ticket barcode — confirmed, and the pipeline validated.** Verified: the standard is **RSP-6 / RSPS3001** (authored for the Rail Settlement Plan by Masabi), an **Aztec** barcode chosen for error-correction, secured with **asymmetric PKI** so gates validate **offline**; the spec is **non-public** (RDG has refused FOI requests). This confirms the payload **cannot be rebuilt from fields** and that **exact byte-identical reproduction with round-trip verification** is the only viable pipeline — exactly as specified. **Residual risk re-framed:** not technical and not forgery (you re-render a ticket the user legitimately holds), but (a) contractual — a retailer’s T&Cs, and (b) operational — gate duplicate deny-listing if the same ticket is shown twice. *Sources: Masabi (RSPS3001 announcement); eta.st technical teardown; ERA TAP-TSI B.12; RailUK Forums; WhatDoTheyKnow FOI thread.*
1. **DragonPass — confirmed; the L4 flagship is buildable.** Verified: a live **DragonPass API Developer Platform** with resource-specific **lounge and fast-track (security + immigration) prebooking** endpoints (`/v2/orders/lounges/ePasses/prebooking`), availability queries, cancellable orders, **QR-code vouchers**, and worked UK examples (Manchester). “For partners” confirms API / white-label / ready-to-deploy delivery and explicit fast-track-provider relationships. **“Running late → fast-track” is real and integrable.** *Sources: apifox.dragonpass.com (API docs); dragonpass.com/for-partners; HeadForPoints (Nov 2025).*
1. **TfL Unified API — confirmed.** Live and free; register for app_id/app_key; live Tube/DLR/Overground/Elizabeth/bus arrivals, line status, journey planner. *Sources: api.tfl.gov.uk; tfl.gov.uk open-data docs.*
1. **Booking.com Demand API — confirmed, with a lead-time flag.** Affiliate-partner route exists; **formal approval takes weeks** — start procurement early. *Sources: developers.booking.com/demand; APIHiver guide (Apr 2026).*
1. **Airalo eSIM — confirmed, with a better commercial model than captured.** Partner API + SDKs, **net-pricing (keep the margin)** as well as affiliate, single sandbox/production env, low-data webhooks, **iOS Universal Link** direct install, 200+ destinations, 5,000+ partners. *Sources: developers.partners.airalo.com; partners.airalo.com; Airalo PHP SDK (GitHub).*
1. **RTJP — confirmed.** A licensed **paid** Online Journey Planner feed (point-to-point/multi-leg planning, derived from SilverRail’s IPTIS + the National Reservation Service), now on RDM. The no-retailing licence question is genuine and should run through the RDM licence process. *Sources: nationalrail.co.uk OJP feeds; Open Rail Data Wiki.*
1. **AeroDataBox free tier — confirmed.** The free plan is **600 API units/month** (after email validation), on a unit-based system where endpoints consume different “tier” amounts; provided via RapidAPI / API.Market. No SLA at present (premium SLAs planned for 2026); existing subscribers may need to re-subscribe for the new credit-based flight-alert system. **Action:** fine for build/early scale; budget a paid tier as flight-status polling grows, and prefer webhook-capable production providers (Cirium/FlightAware) if volume demands. *Sources: api.market travel-API guide (Jun 2026); aerodatabox.com pricing & FAQ.*
1. **European rail — confirmed, and improved.** **Rail Europe** offers API, trade-website and **affiliation** partner models across 200+ operators (SNCF, SBB, Eurostar, Trenitalia, Italo, DB, Renfe, OUIGO, National Rail), with real-time availability, booking, ticketing and aftersales. **Better-fit alternative surfaced:** multi-operator aggregators **Lyko** and **Omio** offer **commission-share with deep-link-free, no-redirect in-app booking** — the user transacts without leaving for the operator’s site, which matches the membrane principle better than redirect-based affiliation. For live data, **SNCF** exposes an open (Navitia-based) API and **Deutsche Bahn** an OpenData API (GitHub). **Action:** evaluate Lyko/Omio against Rail Europe for L5 European booking specifically on the no-redirect requirement. *Sources: agent.raileurope.com; lyko.tech; altexsoft rail-integration guide (Mar 2026).*
1. **Collinson — confirmed.** A B2B partnership (not self-serve like DragonPass): operates **Priority Pass / LoungeKey / Lounge Pass**, 1,800+ lounges across 841 airports in 140+ countries, with **meet-and-assist, pre-booking, rentals and transfers**. Notable: **SmartDelay** provides **lounge access triggered by a flight delay** — a direct fit for the disruption-moment concierge rules (L3/L4). **Action:** engage via Collinson’s partner/sales route (lead time is relationship-led); SmartDelay is worth scoping as a disruption-revenue line. *Sources: collinsongroup.com (Collinson International, Priority Pass, LoungeKey, SmartDelay); LinkedIn (Priority Pass).*

### Resolved (a prior open research item now has an answer)

1. **UK airport security-queue data — resolved and re-confirmed.** **No official UK national or per-airport public API** (no MyTSA equivalent); UK airports don’t publish consistent official live security feeds, and even the lounge networks surface queue times only inside their own apps (Collinson via LocusLabs, for LHR/LGW/MAN and others). Independent aggregators estimate live waits — **Qsensor** (140+ airports) and **FlightQueue** — via boarding-pass-scan-to-exit timing, passenger audits and crowd-sourced data; accuracy varies. **Resolution:** buffer-baseline is the day-one signal (projected arrival vs. the airport’s published guidance); live enrichment is a **vendor-selection task** (evaluate Qsensor/FlightQueue for accuracy + terms during L4), not a blocker. *Sources: qsensor.co; flightqueue.com; Collinson/LocusLabs (Priority Pass wayfinding).*

### Context noted (adjacent facts worth carrying)

1. **UK ETA scheme is live** — the Electronic Travel Authorisation now applies to inbound visitors (airside-transit exemptions in flux). Relevant to the readiness check for international companions/clients, not for outbound UK travellers. *Source: qsensor.co LHR notes; gov.uk (to confirm specifics at build).*
1. **Stable/low-risk, not separately re-verified this pass** (well-established, free/open, no signal of breaking change): MapLibre, Protomaps/OpenFreeMap, Valhalla/OSRM, OpenTripPlanner, Open-Meteo, Frankfurter/exchangerate.host FX, GTFS/GTFS-RT, GBFS. Re-confirm free tiers at integration per the standing discipline (this is the normal pre-integration check every API gets, not an outstanding gap).

-----

*Doctrine in one line, unchanged and now reinforced by the landscape: build the spine before the rings, design each engine layer together with the API that shapes it, refer the purchase but own the day to total depth — and while the whole industry races to book the trip, win the ground no one else is contesting: operating the committed day, calmly, end to end, in a way the traveller trusts.*
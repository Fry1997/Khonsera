# Khonsera — Edition III · Connections/booking redlines (P14 · ED-Flight · ED-Stay · Manage)

**Design → Code.** Companion to `khonsera-edition-iii-connections.css` — this **supersedes the Round-9
file** (same filename → replace it; the Flights|Stays toggle is gone, two independent flows now). Skins
by contract name; no markup/JS/class changes; tokens only; globals.css untouched. Views:
`screens/Flight-finder.html`, `screens/Stay-finder.html` (the latter also carries Manage).

## Tone (whole surface)
A **considered travel desk, not a metasearch wall.** Comparison glanceable; price always **mono + the
dominant figure**; ONE primary (gold) action per row; **fare honesty (baggage/refundable) prominent**
because it's the edge; the airline/hotel handoff stated **plainly, not apologetically**. Severity
discipline holds: **sage = relief** (direct, refundable, free seat, confirmed), **gold = the one
action / not-live-yet**, **rust = a genuine error or the cancel commit only**.

## Shell (`.cc-conn`, `-head/-title/-sample/-close`, `-triptype`)
A calm panel in the action row, not a modal. Each flow (flight, stay) is its own `.cc-conn`; no tab
bar. Flight adds `.cc-conn-triptype` (Return | One-way pill). Keep the **"· sample"** cue while mocked.

## Airport / location autocomplete (`.cc-conn-field--airport` / `.cc-conn-near` + `.cc-conn-suggest`)
The headline UX win — **type a name, never an IATA code.** The dropdown (`.cc-conn-suggest-item`) leads
with the **city/all-airports** option (`data-type="city"`, IATA in gold-2 — e.g. "LON · all airports"),
then airports (`data-type="airport"`, "LHR · Heathrow"). Mono IATA + ink name with a dim city suffix.

## Compare list (`.cc-conn-list-head` + `.cc-conn-controls`, `.cc-conn-offer*`, `.cc-conn-chip`)
- **Controls** in the head: a "Direct only" `.cc-conn-control` checkbox + a cheapest/fastest select
  (+ airline select for flights). Quiet mono.
- **Offer row**: title (Satoshi) + `-op` badge (mono); the mono `-summary` spine (times · stops · dur,
  or rating · area · walk). **Direct = sage** (`.stops[data-direct="true"]`); stops/layover neutral.
- **Depth chips** (`.cc-conn-offer-chips` / `.cc-conn-chip[data-tone]`) — the fare-honesty edge: fare
  brand (neutral), baggage ("1 cabin + 1 checked", `good` when generous), Refundable/Changeable
  (`good` = sage), carbon ("412kg CO2", `dim`). Glanceable, never noisy.
- Price the dominant mono figure (+ `.per` "/ night" + `-total` for stays). One gold `Select`/`Book`
  per row (`data-variant="quiet"` for a pricier alt).

## Seat picker (`.cc-conn-seats`, `-seatgrid`, `.cc-conn-seat[data-state]`)
Best-effort grid at booking; honest "assigned at check-in" note when a carrier returns none. States:
`free` (sage hairline) · `paid` (gold-tint, extra legroom) · `taken` (dashed, recessive, not-allowed) ·
`selected` (solid gold). A legend reads the four. Calm — legible without shouting.

## Passenger step (`.cc-conn-pax*`)
Unhurried; a clean 2-col form (email spans 2), a Spectral-italic reassurance ("just what the airline
needs"), the gold **Confirm — £price**, a quiet Back, a faint "Secured by Duffel" cue.

## Stay flow (`.cc-stay-*`)
- **Result card** (`.cc-stay-card`, a `.cc-conn-offer`): rating ★ + guest score + area + walk in the
  summary; **per-night dominant** with **total · N nights** beneath; free-cancellation chip.
- **Property** (`.cc-stay-detail`): a `.cc-stay-gallery` (2:1 hero + grid; placeholders until photos),
  `-detail-meta` (name / ★ / score with sage `.n` / address), amenity chips, then `.cc-stay-rate` rows
  — room name + **board × cancellation chips** + per-night price + gold Book. A `.cc-stay-limit` line:
  digital key / mobile check-in / loyalty live in the chain's own app — matter-of-fact.

## Confirmed + the honest handoff (`.cc-conn-confirmed*`, `.cc-conn-checkin`)
Sage ✓, Satoshi title, mono `.ref`, a quiet tail ("Added to your day · run/anchor on the spine"). The
`.cc-conn-checkin` line states the **airline check-in deep-link** (or hotel free-cancel window) plainly
— "your boarding pass is issued there, then add it to Wallet". Not an apology; we run everything except
the carrier's own credential.

## Manage bookings (`.cc-manage*`)
"Booked connections" list (kind · label · ref) each with **Manage → the refund quote BEFORE committing**
(`.cc-manage-refund`, calm sand panel, amount mono) → **Confirm cancel** (rust) / **Keep it** (quiet).
Settled outcome → `.cc-manage-done` (sage ✓, e.g. "£0 refund — non-refundable fare; the day's freed").
`.cc-manage-error` rust only on a genuine failure. Reversible-feeling throughout.

## States
- **Error** — rust-2 wash, rust `<strong>` cause, the reassurance in ink. Never a klaxon.
- **Pending** — gold-tint ("Stays not activated — representative results · sample"). Honest not-live,
  not an error.
- **Empty** — a single calm Spectral-italic line + a mono hint.

## Restraint check
One gold action per row. Price always mono. Direct/refundable/free = sage relief; rust only on a real
error or the cancel commit. Depth chips prominent but quiet. "· sample" legible-secondary, gone when the
real key flows. No emoji. The transaction feels as calm as the plan it sits on.

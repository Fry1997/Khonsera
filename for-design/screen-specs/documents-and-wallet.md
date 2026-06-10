# Spec — Booked-document family + the Wallet

The travel-document layer of the planner (master brief §6–§7). When a leg or anchor is booked it
resolves into one or more **documents** — a rail e-ticket, a boarding pass, a stay. These are the
cards the user actually presents at the barrier, and the Wallet is where they all live.

**This is a new family — there is nothing to "redo" here.** The planner spine cards (`AnchorCard`,
`LegCard`, `GapCard`, `IntentionCard`, `ComparisonMatrix`) were designed in Round 1 and are
untouched by this round. What's new and undesigned is the four-member document family + the Wallet
surface that reuses them.

Code has built these as **live, token-styled placeholders** (a functional floor — legible, calm,
correct structure). Your job is to **elevate the finish** — except `ScanView`, which is the one
deliberate function-over-finish surface (see §ScanView). globals.css untouched; tokens only.

> **See them live:** `/wallet?demo=1` (staff) renders the whole family from fixtures —
> compact `TicketCard`s grouped by day, the `StatusStrip`s, and `ScanView` opens from a card.
> Screenshot at 390 / 744 / 1280. The view-models + fixtures are in `reference/`.

---

## The family (register names — already in `reference/component-contract.md`)

### 1 · TicketCard — the booked document
`data-kind` = `rail | air | stay | ground` · `data-variant` = `compact | full` · `data-source`.

**Rail (priority).** Operator(s) · 8-char reference · the **place+time pair** (origin → destination,
each with platform) · **changes** (each connection: station, transfer minutes, platform, a
**tight-connection flag** `data-tight` that ties to the leg's at-risk state) · coach+seat · class ·
ticket type (Advance/Off-Peak/Anytime) + restrictions · price · inline `StatusStrip` · the
**Aztec** via `BarcodePresenter`.
- **Booking-pair:** a return is two legs — **Outbound ↔ Return** stepped by a chevron
  (`.cc-ticket-pair`), with a live **consequence band** (`.cc-ticket-consequence`: "this return →
  leave the museum by 16:10"). This band is the emotional core of the rail card — design it as the
  quiet voice that explains *why this booking matters to the rest of the day*.

**Air.** Airline + flight no. · airports + terminals · **gate** · boarding time + zone · seat ·
baggage · barcode (PDF417/QR) · `StatusStrip` (a gate change is a warm, not alarming, state).

**Stay.** Property + address (map-pin opportunity) · check-in/out · room · nights · contact · no
barcode. Check-in is its "time-needed".

**Ground** (taxi/hire/coach): the shared pattern, minimal.

**Compact vs full.** Compact = the Wallet/Today list row: operator, the time pair, `StatusStrip`
inline, collapsed. Full = opened: changes, seat/class/type, actions (show ticket → `ScanView`,
price). Same card, two densities.

### 2 · StatusStrip — the live line
`data-status` = `on_time · delayed · platform_change · gate_change · boarding · cancelled · stale` ·
`data-offline`. A dot + label + optional detail ("+18 min", "Platform 4 → 1"). **Calm discipline:**
only `delayed`/`cancelled` earn warmth; never alarm-red bleeding through the card. `stale`/offline =
last-known shown at the barrier with no signal — a quiet, honest "offline" marker, not an error.

### 3 · BarcodePresenter — the scannable code (frame only)
`data-format` = `aztec` (rail) · `pdf417`/`qr` (air) · `qr` (transit) · `data-size` = `inline | scan`.
**The code IS the ticket.** You own the **frame**; Code injects the real symbology pixels at wire-up.
Non-negotiable: **a preserved quiet zone, maximum contrast, and nothing overlaid on the code.** No
gold tint, no texture, no rounded mask biting into the matrix. A beautiful card that won't scan is a
failure.

### 4 · ScanView — fullscreen, at the barrier · **FUNCTION OVER FINISH**
The one surface where the calm aesthetic yields to pure function (§6.3). Fullscreen, **white ground,
maximum contrast, brightness maxed**, code large + centred, minimal chrome, a **one-line journey
summary** above it for the guard, and a **swipeable stack** (pager) for multiple passengers. **Do
not elevate this into something that won't scan** — no dark mode, no low-contrast linen, no overlay.
Restraint here means *getting out of the scanner's way*. The only finish that matters is "the gate
reader reads it first time, in sunlight, at 6am."

---

## The Wallet (§7) — a surface, not a new component

Document-centric: every booking across all trips. **Reuses the family — adds no new components.**

- **Grouped by date; within a date, ordered by time-needed** (rail = departure · air = boarding ·
  stay = check-in) — the *next thing you need* sits on top. Headers read **Today · Tomorrow ·**
  then dated. Past collapses to an archive.
- Each row is a **compact `TicketCard`** with its `StatusStrip` inline; tap to expand or open
  straight into `ScanView`.
- **States:** empty (a calm invitation — built, see `/wallet`) · populated (`?demo=1`) · archive.
- **Offline is a hard requirement:** the list + barcodes render from cache with no signal.
- Secondary surface — **not** in the 4-item nav; reached from Today's document area / a menu.

---

## What to return (`for-code.zip`)

- **TicketCard** (rail full + rail compact + the booking-pair/consequence band + air + stay), the
  **four StatusStrip** statuses + offline, **BarcodePresenter** per format, **ScanView** (single +
  multi-passenger), and the **Wallet** grouped list (empty + populated) — each at **390 / 744 /
  1280**.
- An **additive override CSS** styling everything **by the existing classes + `data-*`** (full map
  in `handoff/class-data-map.md`), imported after the current layers. **Never globals.css. Tokens
  only** — request a token if you need a value.
- A **class + `data-*` map** for any new hooks you introduce.
- **Redlines** — the rail card hierarchy, the consequence band, the change/tight-connection
  treatment, the StatusStrip palette discipline, the barcode frame rules, and the ScanView
  function-first layout.

Mobile (390) is the source of truth — these are used one-handed, on a platform, in a hurry. Calm by
default; one accent; no emoji; copy voiced as "Khonsera". **The barcode frame + ScanView are
correctness, not taste — hold the line there.**

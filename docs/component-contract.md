# Khonsera — Component Contract (the 13 concierge components)

**Re-ground artifact (with `docs/design-tokens.md`).** These are the named, token-styled building
blocks the screens compose. **Names are the contract** — Design restyles the look, Code keeps the
names + data shape. They live in `src/components/concierge/`; view-models in `concierge/types.ts`.

Each entry: **Data** (what it shows) · **States** (what Design must draw). Mobile-first throughout.

---

### ActiveTile — the day-of focal point (Today's hero)
**Data:** a status word + dot (urgency), the headline of what matters now, the next `AnchorCard`
target (+ time), the next `LegCard` summary, and (pre-departure) a leave-by figure.
**States:** `dormant` (calm/near-empty), `readiness` (leave-by countdown), `in-transit` (live leg),
`arrived` (current anchor + what's next). Urgency overlay: `comfortable` · `urgent` · `breach`
(breach dot pulses). Layout is fixed across states — only the dot + words change. *(See `today.md`.)*

### AnchorCard — a fixed point on the spine
**Data:** type (`appointment | reservation | accommodation_check_in | accommodation_check_out |
transport_arrival | flight | custom`), title, place, and the **three-variable model**:
**arrive-by · duration · leave-by** — set any two, the third is **derived**.
**States (per variable, visually distinct):** `precise` · `approximate` ("2ish") · `ranged` ("2–3")
· `by-a-time` ("by 3 latest") · `maximise` (elastic, bounded by a standing constraint) · `derived`
(computed, effortless, not directly editable). Fuzzy values **harden** as legs are chosen.

### LegCard — the travel between two anchors
**Data:** mode / mode-mix with optional **first-mile/last-mile** sub-legs (walk→train→taxi); the
**door-to-door total time** (the headline + the only rank key); cost; departure/arrival; structural
pattern (`Direct | Drop-and-go | Hub-to-hub`); booking status.
**States:** `unresolved` (needed, no option chosen) · `proposed` (engine's best, uncommitted) ·
`chosen/booked` · `at-risk` (tight connection / downstream conflict).

### GapCard — unallocated time between anchors
**Data:** type (`transport_gap | accommodation_gap | unplanned_time | care_gap`), the two endpoints,
a binary-reveal prompt, and (for free time) a **bounded** "you have until 16:10 here".
**States:** `open` (needs input) · `watching` · `resolved` · `dismissed`.

### IntentionCard — a soft goal, beside the spine (proposal, never auto-inserted)
**Data:** description ("see the museum"), optional target, buffer, back-calculated leave-by.
**States:** `soft` vs `promoted_to_hard`; `active` vs `toggled_off` (dimmed); reads **provisional/
dismissable**, clearly different from committed anchors.

### ComparisonMatrix — the transport decision layer (opens on tapping a leg)
**Data:** the **top 4 fastest viable** options ranked by **door-to-door total** (+ "show all"); each
shows door-to-door time (rank key), mode-mix/sub-legs, cost, departure+arrival. **Speed ranks;
exclusions filter** (an exclusion removes options, never down-ranks). **Train booking-pair:** outbound
+ return as one unit, chevron between halves, a live **consequence band** ("this return → leave the
museum by 16:10").
**States:** `open` (a focused **sheet/overlay** on mobile, not a wide table) · one `selected`
(hardens fuzzy values) · `empty` (no viable options).

### JourneyListCard — one journey in a list
**Data:** title, mode, date range, anchor count, open-gap count, status. **States:** list · empty.
**Distinct from `TicketCard`:** JourneyListCard summarises a *whole plan* in the trips list; a
TicketCard is *one booked document* within a plan. They are not interchangeable.

---

## Booked-document family (planner master brief §6) — `src/components/concierge/document-cards.tsx`

A chosen leg/anchor resolves into one or more booked documents. These four are the new contract
members the Wallet (§7) and Today (§8) reuse — **no further new components for either surface.**

### TicketCard — a booked travel document
**Data:** `kind` (`rail | air | stay | ground`); operator(s); reference; price; `source` (synced ·
manual · forwarded · inbox · affiliate · wallet · ocr — governs trust + pre-fill + live refresh);
per journey **place+time pair(s)** with platform/gate/terminal; **changes** (each connection's
station, transfer time, platform, **tight-connection flag**); coach/seat, class, ticket type +
restrictions (rail); flight no., terminal, boarding time + zone, baggage (air); property + address,
check-in/out, room, nights, contact (stay); an inline `StatusStrip`; a scannable code via
`BarcodePresenter` where applicable. **Booking-pair:** a return = two legs, **outbound ↔ return**
stepped by a chevron with a live **consequence band** ("this return → leave the museum by 16:10").
**States:** `data-variant` = **compact** (Wallet/Today list, collapsed, StatusStrip inline) ·
**full** (open). `data-kind` per mode. Plus the leg `StatusStrip` states below.

### StatusStrip — the live status line
**Data:** `status` (`on_time · delayed · platform_change · gate_change · boarding · cancelled ·
stale`), optional detail ("+18 min" · "Platform 4 → 1"), `offline` (stale marker — last-known shown
at the barrier without signal). **States:** the seven statuses (each visually distinct; only
`cancelled`/`delayed` earn warmth, never alarm-red throughout) · `offline`/stale.

### BarcodePresenter — the scannable code
**Data:** `format` (`aztec` rail · `pdf417`/`qr` air · `qr` transit), payload value, optional
passenger label. **The code *is* the ticket** — Design owns the **frame** (quiet zone preserved,
high contrast, **nothing overlaid on the code**), Code injects the symbology pixels at wire-up.
**States:** `data-size` = inline (in a TicketCard) · scan (fullscreen). Per-format framing.

### ScanView — fullscreen presentation at the barrier
**Data:** a one-line journey summary (for the guard), the barcode(s), a swipeable **stack for
multiple passengers**. **THE function-over-finish exception (§6.3):** code large + centred,
**brightness maxed**, minimal chrome — Design must **not** elevate it into something that won't
scan. **States:** single · multi-passenger (pager) · per-format.

> **Offline (hard requirement, §7.3):** TicketCard + BarcodePresenter/ScanView render from cache
> with no signal; StatusStrip shows last-known + the stale marker. A wallet that needs a connection
> at the barrier has failed.

### ModeSwitch — Work/Personal
**Data:** `work | personal`. A **toggle, not a tab**; persisted; reachable from the shell.

### ContactChip — a person
**Data:** name, channel (`phone | email | whatsapp`). **States:** bound (real contact) · unbound.

### TaskRow — a to-do
**Data:** title, optional due, done. **States:** open · done (struck-through). Date-bearing tasks
surface on that day.

### ExpenseRow — a spend line
**Data:** amount + currency, category, date.

### NudgeCard — a proactive intervention (the raised voice)
**Data:** an **intervention** message ("leave 10 minutes earlier"), optional action. Never a raw data
widget. **States:** dismissible. **Earns prominence by being rare** — gold/accent reserved for it.

### ReadinessPrompt — pre-departure prep / back-calculation
**Data:** leave-by, derived wake/prepare time, the routine steps. One orchestrated prompt, not
scattered sums.

---

## Cross-cutting rules
- **Tokens only** (`design-tokens.md`); no raw hex/px in components.
- **Calm by default;** gold/accent is punctuation — the single live "now" pulse or the one action.
- **No emojis.** Copy is voiced as **Khonsera** (never a human name).
- **Proposals are provisional** (intentions, inferred accommodation/luggage) — confirmable, never
  silently inserted.

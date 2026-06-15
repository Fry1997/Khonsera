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

### JourneyListCard — one Event in the Plan index `.cc-journey-card`
**Data:** title, mode, **span** (single date, or range + "N days"), stop count, open-gap count,
status. **States:** list · archive (dimmed) · empty. Now `.cc-*`-styled (the one list component that
hadn't had an Edition II pass) and links into the **Event detail** (`/plan/[id]`), not legacy.
**Distinct from `TicketCard`:** JourneyListCard summarises a *whole Event*; a TicketCard is *one
booked document* within it. **DESIGN-PENDING** — queued for a round with the rest of §Plan surfaces.

### Plan surfaces — Code floor, DESIGN-PENDING (proposal "events-by-day")
New compositions styled by `.cc-*` + tokens as a functional floor, **awaiting a Design round**:
`.cc-plan-group`/`.cc-plan-list` (index day-groups, Wallet-mirrored) · `.cc-plan-new` + the new-Event
`.cc-sheet` (start date + optional name) · `.cc-plan-empty` · `.cc-event-head`/`.cc-event-back` (the
Event detail header) · the variable-editor / comparison / constraints / manual-add `.cc-sheet`s and
`.cc-kind-*`/`.cc-compare-*`/`.cc-constraints-*` already in use. Day dividers land in a later chunk.

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

### Pass — the first-class wallet rendering (Round 5b) — `concierge/pass.tsx`
**Not a new contract member — a richer presentation of a booked document** (same `TicketVM`; reuses
`StatusStrip` + `BarcodePresenter`). The materially-real issued ticket: operator band + kind seam,
the big time-pair, a drawn connector, perforation + barcode stub. `Pass` (full, next-needed) +
`PassPeek` (collapsed, in the day's `.cc-pass-stack`). **Docks on the Planner spine** when a leg is
booked (`.cc-pass--docked`: tighter, barcode → a quiet "Ticket ready" line; a return is a second
docked pass downstream, not a stack — the timeline carries order). The Wallet uses `Pass`; the
compact `TicketCard` remains for non-stacked list contexts (e.g. Today's single promoted document).

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

## Deviation & care layer (Edition III P9–P13) — live on `/plan/[id]` + `/today`

*The components that appear when the day deviates from plan or needs looking after. Round 7 brand-passed
the live-spine set (✓ skinned); the recovery + nudge set is the **Round 8** request (🟡 to skin). Full
brief, contract classes, states and preview steps live in `docs/design-handoff-edition-iii.md`.*

### Live-spine set (P9–P10) — ✓ Round 7 skinned
**Decision-clock** (`.cc-decision-clock` · `.label/.figure/.for`) — the day's single "set off by HH:MM".
**Live-alert** (per-leg, rail + TfL) — live status + the engine **consequence** ("you'll miss the 09:40,
act by 09:27"); minor=gold, severe=rust. **Fragility** (`.cc-fragility`) — "tight plan, one delay and it
breaks". **Day-ripple** (`.cc-day-ripple`) — the whole-day knock-on. **Today disruption takeover**
(`.cc-today-disruption`, `cc-screen[data-disrupted]`) — the day's character shifting to disruption.

### RecoveryCard — the way out (P11) · 🟡 Round 8
`plan/recovery-card.tsx`, `.cc-recovery` (+ `-head/-eyebrow/-note/-list/-opt/-label/-conseq/-return/-via`).
**Data:** beneath a cancelled/severely-delayed booked train — each viable alternative + its consequence
("makes your 2pm, 12 min spare" / "reaches it 18 min late"); the booked-return impact (`-return`, rust);
an OTP detour note (`-via`, "via Coventry · 1 change"). **States:** per-option `data-makes=true|false`
(true reassures/sage, false stays quiet — never red); `data-return=at-risk`; the `· sample` honesty cue.

### PlanNudges / NudgeCard — contextual care (P12–P13) · 🟡 Round 8
`plan/plan-nudges.tsx` wrapping the `NudgeCard` (above). Six rules render through **two states**:
**open** (`NudgeCard`, gold-tint) — one calm proposal + action + "Not now" (weather→leave-earlier,
running-late→fast-track, layover→lounge, parking→pre-book, gate-change→reroute); **accepted**
(`.cc-nudge-done` + `-mark`, `data-rule`) — a quiet "Done" confirmation that doesn't vanish. **Tone:**
foresight (ahead-of-time, unhurried) vs reaction (moment-of, a touch more weight); once acted, it settles.

### Connections surface (ED-Flight / ED-Stay) — search / compare / book / manage · 🟡 Rounds 11–12
*The "buy + service without leaving Khonsera" surface on `/plan/[id]`. Three SEPARATE flows (the old
Flights|Stays toggle was retired) sharing the `.cc-conn*` shell from Round 9. Full briefs + contract
classes in `docs/design-handoff-edition-iii.md` (Rounds 11, 12, + manage-booking).*

- **FlightFinder** 🟡 R11 — `plan/flight-finder.tsx`. Trip-type (`.cc-conn-triptype`) → search
  (`.cc-conn-field--airport` autocomplete incl. city/all-airports, return/pax/cabin) → compare
  (`.cc-conn-offer` + `.cc-conn-chip[data-tone]` fare-brand/baggage/refundable/carbon + `.cc-conn-controls`
  filter/sort) → **seat picker** (`.cc-conn-seats` / `.cc-conn-seat[data-state]`) → passenger → confirm
  (with the airline check-in deep-link). Flights LIVE vs Duffel test mode.
- **StayFinder** 🟡 R12 — `plan/stay-finder.tsx`. Location autocomplete → result cards (`.cc-stay-card`:
  star/score/per-night+total) → property detail (`.cc-stay-detail` amenities/check-in) → rooms/rates
  (`.cc-stay-rate`: board/free-cancel/pay-at-property) → book. Honest chain-app-only limit line.
- **ManageBookings** 🟡 — `plan/manage-bookings.tsx`, `.cc-manage` (+ `-row/-done/-error`). The "Booked
  connections" list: each Duffel-booked flight/stay with **Manage → See refund → Confirm cancel / Keep
  it** (refund shown before committing). Belongs in the same skin pass — booking and managing are one
  surface.
- **Tone (all three):** a considered travel desk — comparison glanceable, fare/stay honesty prominent
  (it's our edge), the airline/hotel handoffs stated plainly, cancellation reversible-feeling with the
  refund up front, the "· sample" cue honest. Reuses `.cc-btn`/`.cc-field`.

---

### Ledger & teams (P15 mileage · P16 budget · P17 approvals) · 🟡 Ledger pack
- **Mileage** (`/mileage`) — `DriveRecorder` (`.cc-mileage-rec`) + `MileageLedger` (`.cc-mileage*`):
  claimable-£ summary + CSV, trips with a Business|Personal toggle (`-trip[data-class]`), purpose-needed
  flag, manual add.
- **Budget** (`/plan/[id]`) — `BudgetPanel` (`.cc-budget*`): spend-vs-cap bar (`-bar[data-over]`), cap,
  expense lines + receipt attach/view, quick-add, submit-for-approval.
- **Approvals** (`/workspace`, managers) — `ApprovalsQueue` (`.cc-approvals*`): submitted work-trip spend,
  approve/reject. Personal spend never appears (RLS + in-app work filter).
- **Tone:** numbers-led, the headline figure confident, over-cap/needs-purpose a calm rust nudge, sage
  for done/approved.

---

## Cross-cutting rules
- **Tokens only** (`design-tokens.md`); no raw hex/px in components.
- **Calm by default;** gold/accent is punctuation — the single live "now" pulse or the one action.
- **No emojis.** Copy is voiced as **Khonsera** (never a human name).
- **Proposals are provisional** (intentions, inferred accommodation/luggage) — confirmable, never
  silently inserted.

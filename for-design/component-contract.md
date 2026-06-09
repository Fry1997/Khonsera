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

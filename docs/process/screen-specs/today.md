# SCREEN SPEC — TODAY / LIVE

*For Design. Destination: `screen-specs/today.md` inside `for-design.zip`.*
*Output target: 4 states × 3 sizes = 12 artboards.*

## Purpose

The live, in-the-moment view. **Not a dashboard you configure** — it morphs automatically
through states driven by time and live data (weather, delays, gate/platform changes,
calendar). It answers one question: *what do I need to know or do right now?*

## Mental model

A single focal surface that changes character through the day. There is always one
**`ActiveTile`** (the thing that matters most right now) plus a small set of supporting
elements. It is calm by default and only raises its voice when live conditions demand. The
state is chosen by the **engine** (time + data) — never picked by the user.

## The four states (design each, at all three sizes)

### State 1 — Dormant (“nothing in motion”)

No active travel today. Calm, near-empty. `ActiveTile` shows a settled, restful state — the
next thing far off, or simply a quiet horizon. At most a single `NudgeCard` if something
genuinely needs prep; otherwise paper and quiet. **The most withholding state** — it should
feel like a calm moon, not an empty dashboard waiting to be filled.

### State 2 — Readiness (“getting ready”)

A trip is today but hasn’t started.

- `ActiveTile` = leave-by guidance / countdown.
- `ReadinessPrompt`(s): what to handle before you go (luggage, documents, “leave by X to
  make the 14:05”).
- A `LegCard` preview of the first leg.
- A `NudgeCard` if a live condition has shifted the plan (“train delayed 12 min — still
  fine” / “leave 10 minutes earlier”).

### State 3 — In transit (“on the move”)

Mid-journey.

- `ActiveTile` = current leg live status: where you are in the Direct / Drop-and-go /
  Hub-to-hub sequence, the next sub-leg, platform/gate.
- Live changes surface as `NudgeCard` **interventions**, not raw feeds: “gate changed to
  B12”, “connection is tight — here’s the faster route”.
- The immediate next action is foregrounded; everything else recedes.

### State 4 — Arrived (“you’re there”)

At an anchor (the appointment, the hotel).

- `ActiveTile` reflects the current anchor and what’s next.
- Bounded free time if relevant — a `GapCard`-style “you have until 16:10 here” (this is the
  **maximise** value made visible, bounded by the next constraint).
- `TaskRow`s for anything to handle while here; `ExpenseRow` if capturing spend;
  `ContactChip` for the relevant person.
- A quiet wind-down toward the next transition.

## The morph (the most important behaviour)

Today is **one surface that transitions automatically**, not four screens the user navigates
between. Design the **transitions**, not only the static frames: what fades, what slides,
how the `ActiveTile` transforms from countdown → live leg → arrived. In keeping with Khonsu
(the moon, time, dusk), the morph should feel like the surface is *turning* through the day;
a quiet time-of-day / horizon through-line is welcome.

## Live data → interventions, not widgets

Inputs that drive state and content: current time vs plan, weather, transport delays,
gate/platform changes, calendar. These do **not** appear as data readouts. They surface as
**interventions** — a `NudgeCard` saying “leave 10 minutes earlier” rather than a weather
widget. The product’s value is orchestration continuity, not a feed.

## Component vocabulary

`ActiveTile` (always, the focal point) · `NudgeCard` (proactive interventions — the raised
voice) · `ReadinessPrompt` (pre-departure prep) · `LegCard` (next/current leg) · `TaskRow` ·
`ExpenseRow` · `ContactChip` · `GapCard` (bounded free time).

## Layout (mobile-first)

Single focal column. `ActiveTile` is the hero — large, top. Supporting cards stack below in
priority order. At larger sizes, **resist** spreading into a multi-column dashboard: Today
stays a single calm spine even with room, and the extra space becomes breathing room, not
more widgets. This protects the “morphing surface, not dashboard” principle.

## Restraint notes (brand-critical)

Today is the most-seen screen, so it sets the brand temperature. Default is quiet. Gold /
accent is reserved for the single live “now” pulse or the one action that matters. A
`NudgeCard` earns its prominence by being **rare** — if everything nudges, nothing does. The
dormant state especially must resist the urge to fill space.
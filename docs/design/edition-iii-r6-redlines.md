# Khonsera — Edition III redlines (P0–P6)

**Design → Code.** Companion to `khonsera-edition-iii.css` (additive; import **last**, after the
Edition II layers). Skins the P0–P6 components by contract name — no markup/JS/class-name changes,
tokens only, globals.css untouched. View: `screens/Edition-III.html`.

## P0 · Coherence
- **PlanMap** — a quiet inset band (8px radius, hairline, `--shadow-sm`), **200px** mobile / **280px**
  ≥680px. It frames the day's geography; it is **not** the hero — the spine is. Map themes already wired.
- **Home base node** (`.cc-base-node`) — the day's bookend, deliberately quieter than an AnchorCard:
  no card chrome, just `eyebrow + title + time`, title in `--ink-2` (recessive). Spine dot is a small
  **ink-dim** filled home, never gold. Start variant = "Home · start"; end = "Home" + optional "by HH:MM".

## P1 · One unified day + privacy
- **ModeTag** (`.cc-mode-tag[data-mode]`) — a *tag, never a button*: tiny mono caps, a leading dot,
  pill. `work` = gold-2 on gold-tint; `personal` = ink-faint on ink-soft (genuinely faint).
- **PlanModeFlip** (`.cc-mode-flip`) — the segmented control: pill track, active segment lifts to
  `--card` with `--shadow-sm`. `[data-pending]` dims + disables.

## P2 · Capture
- **PlanCalendarImport** (`.cc-pick-row`) — checkbox + title + mono meta. Checked box fills gold.
  Loading/empty states use the Spectral-italic quiet line.
- **Stay fields** — the "Arrival details" expander: a mono-caps toggle with a rotating chevron
  (`[aria-expanded]`), revealing a 2-col dense detail grid (`.cc-stay-detail`, full-width via `.cc-stay-wide`).

## ED1 · AccommodationCard — HERO
The stay-document that replaces the hotel app on the day. **Gold seam** down the head = "booked & held".
Name in Satoshi 22px; eyebrow + board beneath; the channel (Call) as an ink button top-right. Body =
hairline-separated label/value rows, **mono values**, 132px label column. Cancellation value goes sage
when free; price row is mono 16px. Every field renders only when present — never show an empty row.

## P3 · NotesPanel
Collapsed toggle (title + count + chevron) → list + add form. `[data-open]` rotates the chevron.
Each note: a `kind` badge — `prep` = gold-tint, `outcome` = sage-2 — and an optional "Shared with work"
mono tag pushed right. Add form = the focus-ringed textarea. Reads as a quiet prep surface, not a feed.

## P4 · ReadinessPanel — reassurance, not a to-do app
Panel on `/plan/[id]`. Per-item **severity dot**: `info` = sage, `advise` = gold, `warn` = amber (never
rust — this surface never alarms). Category eyebrows in mono. Actions are quiet mono underlines.
**Cleared state** (`[data-clear="true"]`): the whole panel goes calm **sage-2**, the title gains
"· You're set" — the payoff of the phase.

## P5 · DayReviewCard — HERO / emotional payoff
The "Tomorrow" card on `/today`. **Lead with leave-by as the hero figure** — mono **40px**, gold-2,
between two hairlines. Then the day-shape list (mono time gutter + who). Fragile day shows
`.cc-review-flag` (amber, a calm caution — "the 7-minute change is tight", never red). Foot verdict in
Spectral italic; `[data-clear="true"]` makes it sage with a ✓. It must feel like being looked after.

## P6 · Leg buffer badge (`.cc-leg-buffer[data-buffer]`)
A calm classification on **every** leg, in `.cc-leg-head-right`. `ok` = "Comfortable", gold-2,
**barely-there** (75% opacity, no fill — the resting state recedes). `tight` = "Tight · Xm", amber on
amber-2. `late` = "Insufficient", rust on rust-2 — catches the eye **without alarm** (no pulse, no red).
The dot + label carry it; weight escalates only as the buffer shrinks.

## Restraint check
One accent per surface. Gold stays punctuation (the leave-by figure, the stay seam, the work tag). No
emoji. No rust except the genuine "insufficient" buffer. Calm by default; prominence only where earned.

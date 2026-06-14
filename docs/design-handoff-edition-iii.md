# Design Handoff — Edition III build programme

**Design is the front-end team.** Per the Code↔Design protocol (`docs/design-code-handoff-protocol.md`,
master doc H6): **Code** ships components that are *functional, wired to real data, on tokens, and
contract-shaped* — never final brand. **Design** owns how each one surfaces: brand, type, colour,
motion, spacing, the Edition II skin. This doc is the running carrier note — every UI a phase adds is
logged here with its **component · where · states · data · what Design owns**, so Design can skin
against real, live examples on `/plan/[id]` and `/today`.

**Standing note for Design:** all of the below is Code-authored against tokens (no raw hex/px), with
placeholder layout. Treat the class names as the seam; restyle freely. None of it has had a brand
pass yet. Names follow the contract — don't rename. No emojis anywhere (hard rule).

Status legend: 🟡 awaiting first Design pass.

---

## P0 · Coherence

- **`PlanMap`** 🟡 — `src/components/plan/plan-map.tsx`, on `/plan/[id]`. The door-to-door JourneyMap
  (MapLibre) now on the canonical plan, built from stops+transitions. *Design owns:* it already uses
  the dusk/midnight/sahara map themes; check the plan-page framing/height.
- **Home base node** 🟡 — `.cc-base-node` (+ `.cc-base-eyebrow/-title/-time`) in `plan-spine.tsx`.
  The day's origin/return renders as a fixed home card, not an editable anchor. *States:* start (has a
  leg after → "Home · start") vs end ("Home", optional "by HH:MM"). *Design owns:* the whole look —
  currently a plain eyebrow+title row.

## P1 · One unified day + privacy tag

- **`ModeTag`** 🟡 — `src/components/concierge/mode-tag.tsx`, `.cc-mode-tag[data-mode]`. A quiet
  work/personal pill on Plan list cards. *States:* `work` (gold) · `personal` (faint). *Design owns:*
  pill treatment; should read as a tag, never a button.
- **`PlanModeFlip`** 🟡 — `src/components/plan/plan-mode-flip.tsx`, `.cc-mode-flip`. A two-segment
  control on `/plan/[id]` to re-tag a whole day. *States:* active segment, `data-pending`. *Design
  owns:* the segmented-control styling.

## P2 · Capture

- **`PlanCalendarImport`** 🟡 — `src/components/plan/plan-calendar-import.tsx`. A `.cc-sheet` panel
  (reuses the existing sheet pattern) listing calendar events with checkboxes. *States:* loading,
  empty, list, error, pending. *Design owns:* the pick-row (`.cc-pick-row`) styling.
- **Stay (accommodation) fields** 🟡 — in `plan-add.tsx`, the "Stay" kind: hotel picker + check-in/out
  + an expandable "Arrival details" block. Uses existing `.cc-time-field/.cc-dur-row/.cc-kind-chip`.
  *Design owns:* the expand affordance + the dense detail layout.

## ED1 · Accommodation depth

- **`AccommodationCard`** 🟡 — `src/components/plan/accommodation-card.tsx`, `.cc-acc-card` (+
  `-head/-eyebrow/-channel/-row/-label/-value/-link/-mono`). The stay's **arrival payload** beneath
  the anchor: room/board, confirmation, one-tap call, check-in/access, wifi, parking, breakfast,
  cancellation + cancel-by, price. *States:* fields render only when present. *Design owns:* this is a
  hero surface (it replaces the Hilton app on the day) — currently a plain label/value list; give it
  the concierge treatment.

## P3 · Notes

- **`NotesPanel`** 🟡 — `src/components/plan/notes-panel.tsx`, `.cc-notes` (+ `-toggle/-body`,
  `.cc-note*`). Per-commitment prep + outcome notes: collapsed toggle → list + add form. *States:*
  collapsed/open, adding, prep vs outcome (`.cc-note-kind[data-kind]`), `org_reviewable` ("Shared with
  work"), pending. *Design owns:* the note card + the kind/shared badges + the add form.

## P4 · Readiness

- **`ReadinessPanel`** 🟡 — `src/components/plan/readiness-panel.tsx`, `.cc-readiness` (+
  `-head/-body/-cat/-item/-dot/-text/-label/-detail/-actions/-tick/-x`). The "have you got everything?"
  surface on `/plan/[id]`. *States:* `data-clear="true"` (all sorted → "You're set"), per-item
  severity (`data-sev=info|advise|warn` drives the dot colour), action variants (link / remind / book),
  collapsed/open. *Design owns:* the calm vs warn tone — must read as reassurance, not a to-do app.

## P5 · Night-before review

- **`DayReviewCard`** 🟡 — `src/components/plan/day-review.tsx`, `.cc-review` (+ `-eyebrow/-title/`
  `-leaveby/-shape/-list/-row/-flag/-foot/-verdict`). The "Tomorrow" card on `/today`. *States:* fragile
  (`.cc-review-flag` shows), verdict `data-clear`. *Design owns:* this is the emotional payoff of the
  whole Preparation phase — lead with leave-by as the hero figure; it must feel like being looked
  after, not a summary table.

## P6 · Timing made visible

- **Leg buffer badge** 🟡 — `.cc-leg-buffer[data-buffer]` (+ `.cc-leg-head-right`) in
  `concierge/timeline-cards.tsx` `LegCard`. A calm classification on **every** leg. *States:* `ok`
  ("Comfortable", gold) · `tight` ("Tight · Xm", ochre) · `late` ("Insufficient", rust). *Design owns:*
  the badge weight — comfortable should be barely-there; insufficient should catch the eye without
  alarm. (Note for Code+Design: `.cc-leg-pattern` still renders a hardcoded "Direct" — real
  Direct/Drop-and-go/Hub-to-hub inference is a deferred Phase 6 item.)

---

## How to use this handoff
Open `/plan/[id]` (a built day) and `/today` (with a plan starting tomorrow) — every component above is
live there with real data. Skin against the tokens in `docs/design-tokens.md`; if a value is missing,
it's a **token request** (add to `globals.css` + the tokens doc), never a one-off hardcode. Hand back
via the export pack mapped to these names.

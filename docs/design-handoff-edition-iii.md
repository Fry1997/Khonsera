# Design Handoff — Edition III build programme

**Design is the front-end team.** Per the Code↔Design protocol (`docs/design-code-handoff-protocol.md`,
master doc H6): **Code** ships components that are *functional, wired to real data, on tokens, and
contract-shaped* — never final brand. **Design** owns how each one surfaces: brand, type, colour,
motion, spacing, the Edition II skin. This doc is the running carrier note — every UI a phase adds is
logged here with its **component · where · states · data · what Design owns**, so Design can skin
against real, live examples on `/plan/[id]` and `/today`.

**Standing note for Design:** all of the below is Code-authored against tokens (no raw hex/px), with
placeholder layout. Treat the class names as the seam; restyle freely. Names follow the contract —
don't rename. No emojis anywhere (hard rule).

> **Round 6 applied (2026-06-14).** Design's first brand pass (`for-code-r6`) is **integrated**:
> `src/app/khonsera-edition-iii.css` (additive, imported last in `layout.tsx`), plus the markup hooks
> its selectors need — `.cc-plan-map` band, the AccommodationCard stay-document (gold seam, `Call`
> button, `data-kind` rows), the DayReview leave-by hero (`.l/.v`, `.t/.who`, root `data-clear`),
> `.cc-readiness[data-panel]` + amber-not-rust severity, NotesPanel `data-open`+chevron, the
> calendar `.cc-pick-row[data-checked]` boxes, the Stay `.cc-stay-expand`/`.cc-stay-detail` grid, and
> the per-leg `.cc-leg-buffer`. **Code's placeholder CSS for these was removed** so Design owns the
> look outright. Reference: `docs/design/edition-iii-r6-redlines.md` + `-class-data-map.md`. Build
> green · 276 tests pass. Status below flips 🟡→✅ for round 6; future phases append new 🟡 entries.

> **Round 7 applied (2026-06-14).** Design's live-spine pass (`for-code-r7`) is **integrated**:
> `src/app/khonsera-edition-iii-live.css` (additive, imported last). The **P8/P9/P10 surfaces below are
> now skinned** — markup reworked to the live contract (TfL `-head/-eyebrow` + `.cc-tfl-line[data-state]`
> dot ramp; TflLegPlan route `.sep`/`.min` + `.cc-tflleg[data-disrupted=state]` + `-alert-status/-conseq`;
> decision-clock `.label/.figure/.for`; rail `.cc-live-alert -title/-conseq`; fragility `<strong>`; day
> ripple `.text`; Today `-eyebrow/-title/-item.what` + the `.cc-screen[data-disrupted]` recede). **All my
> inline placeholder styles on these surfaces were removed** (inline would override the skin). Governing
> rule held: calm caution that carries consequence, never alarm. Saved redlines + class-map to
> `docs/design/`. Build green · 283 tests pass.

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

## P8 · City mobility / TfL (first live-data API)

- **`TflLineStatus`** 🟡 — `src/components/today/tfl-line-status.tsx`, `.cc-tfl` (+ `-line/-dot/-name/`
  `-status/-reason/-allgood/-rest`). Live London line status on `/today`, shown only on **London
  days**. *Concierge restraint already in the markup:* it leads with **disrupted** lines (name +
  status + reason) and withholds the rest ("Everything else running well"); when all-clear it's a
  single calm line. *States:* `.cc-tfl-line[data-state="good|minor|severe|suspended|info"]` (the dot
  colour maps to sage/gold/amber/rust). The eyebrow shows **"· sample"** when the data is the mock
  (no `TFL_APP_KEY` yet) — keep that honesty cue when skinning. *Built with placeholder inline token
  styles* (flex + the dot colour) so it's legible now; **Design owns the `.cc-tfl` skin** — give the
  disrupted lines weight, the all-clear state calm, and treat it as a quiet board, not an alarm panel.
- **`TflLegPlan`** 🟡 — `src/components/plan/tfl-leg-plan.tsx`, `.cc-tflleg` (+ `-route/-step/`
  `-arrivals/-arr`). Beneath each **London transit leg** on `/plan/[id]`: the multimodal route
  (walk → line → walk, per-step minutes) + **next-train arrivals** at the boarding stop. Eyebrow
  carries the total + "· sample" when mock. *Placeholder inline token styles; Design owns `.cc-tflleg`*
  — make the steps read as a route, the arrivals as a quiet live ticker.
  - **Disruption + consequence (P9)** — when a line on the route is delayed, `.cc-tflleg[data-disrupted]`
    + `.cc-tflleg-alert[data-state]` show the line status and the engine's **consequence** ("Jubilee
    line · Minor Delays · you'll be 6 min late for X"). *Design owns it* — calm caution, never alarm;
    weight tracks `data-state` (minor → gold, severe/suspended → rust).

## P9 · Live spine (decision-clock + consequence)

- **Decision-clock** 🟡 — `.cc-decision-clock` on `/plan/[id]` (page-level). One quiet line: "Set off
  by HH:MM for X" — the day's single reassuring number. *Design owns it* — it should read as calm
  reassurance (mono gold figure), the opposite of an alarm.
- **Rail live-alert** 🟡 — `.cc-live-alert[data-state="minor|severe"]` under a booked train leg on
  `/plan/[id]`: the live status title + the engine **consequence** ("Delayed 13 min — you'll miss the
  10:40, act by 10:27"). *Design owns it* — minor = gold, severe = rust; a calm caution that carries
  consequence without panic. (Only appears with `DARWIN_LDBWS_KEY` + a real delay.)
- **TfL reroute prompt** 🟡 — `.cc-tflleg-reroute` inside `.cc-tflleg-alert` for a severe/suspended
  line: the one-line "consider an alternative, or a taxi". *Design owns it* — an offered way out,
  understated.
- **Fragility line** 🟡 (P10) — `.cc-fragility` on `/plan/[id]` (near the decision-clock): "Tight plan
  — only N min into X. One delay and the day breaks; add a buffer while you can." *Design owns it* —
  a calm caution (rust text), the foresight that lets you fix it *before* it breaks, never alarm.
- **Day ripple** 🟡 (P10) — `.cc-day-ripple` on `/plan/[id]`, when a live delay is on the day: "The
  day's running ~N min behind — you'll be N late for X." The whole-day cascade at a glance. *Design
  owns it* — present (rust, a touch of weight) but still calm; it sits above the per-leg alerts.
- **Today disruption banner** 🟡 (P10) — `src/components/today/today-disruption.tsx`,
  `.cc-today-disruption[data-severe]` + `-item`, with `cc-screen[data-disrupted]` on the page. Leads
  `/today` when a live rail break is on the plan ("Euston 09:40 · Delayed 13 min — you'll miss…").
  *Design owns it* — this is the day's whole character shifting to disruption: it should command the
  screen (the rest recedes) yet stay the calm chief-of-staff, never panic. severe = rust, late = gold.

---

## How to use this handoff
Open `/plan/[id]` (a built day) and `/today` (with a plan starting tomorrow) — every component above is
live there with real data. Skin against the tokens in `docs/design-tokens.md`; if a value is missing,
it's a **token request** (add to `globals.css` + the tokens doc), never a one-off hardcode. Hand back
via the export pack mapped to these names.

## P11 · Recovery (the way out)

- **`RecoveryCard`** 🟡 — `src/components/plan/recovery-card.tsx`, `.cc-recovery` (+ `-head/-eyebrow/`
  `-note/-list/-opt/-label/-conseq`). Beneath a **cancelled / severely-delayed booked train** on
  `/plan/[id]`: the consequence band — each viable alternative (`.cc-recovery-opt[data-makes]`) with its
  label (mono) + impact ("makes your 2pm, 12 min spare" / "reaches it 18 min late"). The "· sample"
  cue on mock; "the trade-off — choose your priority" until protect-target is set. *Placeholder inline
  token styles; Design owns `.cc-recovery`* — this is the calm "here's the way out" moment when the day
  breaks: options legible at a glance, `data-makes="true"` reassuring (sage), the misses quiet not red.

### P11 follow-ons (same `RecoveryCard`)
- **Return-pairing line** 🟡 — `.cc-recovery-return` (inside `.cc-recovery-opt`, when the way-out
  threatens a booked return). Rust text: "Lands after your 17:42 return — the trip's lost" / "Only N
  min to turn around for your 17:42 return". *Design owns it* — the heaviest consequence in the band;
  it should read as the real cost (the wasted trip), still in ink, never a klaxon.
- **Detour route note** 🟡 — `.cc-recovery-via` (block under the option label) for an OTP cross-network
  alternative: "via Coventry · 1 change". Faint/secondary — the *how* beneath the *when*. Only present
  once an OTP instance is live (`OTP_URL`); same band, just more options.

## P12 · Contextual care (nudges)

- **`PlanNudges` / `NudgeCard`** 🟡 — `src/components/plan/plan-nudges.tsx` wrapping the existing
  `NudgeCard` (concierge). On `/plan/[id]`, beneath the fragility line: the live contextual prompts.
  - **Open state** — `NudgeCard` (gold-tint, existing): a calm proposal + one action + "Not now".
    Two rules fire today: *weather → leave earlier* ("Heavy rain forecast on your drive to Gatwick
    around 07:00 … leaving 20 minutes earlier keeps your arrival comfortable" · "Leave 20 min earlier")
    and *running late → fast-track* ("Your buffer at Gatwick is thin — about 60 min … A fast-track slot
    protects it" · "Get fast-track").
  - **Accepted state** 🟡 — `.cc-nudge-done` (+ `.cc-nudge-done-mark`, `data-rule`): a quiet "Done"
    line once acted ("Noted — leaving 20 minutes earlier. It's on your prep." / "Fast-track sorted for
    Gatwick. The voucher's on your prep notes."). It does **not** vanish — the day remembers the call.
  - *Design owns `.cc-nudges` / `.cc-nudge-done`* (the open card already has a brand class). This is the
    chief-of-staff quietly looking ahead: helpful, never nagging, dismissible, and once you act it
    settles into a calm confirmation, not a trophy. The fast-track "· sample" cue shows while mocked.

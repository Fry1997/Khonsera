# Edition III · Round 13 — Handback (coherence + correctness)

**Drop-in:** `khonsera-edition-iii-round13.css` → `src/app/`, imported **last** (after
`khonsera-edition-iii-connections.css`). Additive, no markup/class changes, **no new tokens**.
Governing rule unchanged: *calm caution that carries consequence, never alarm.*

---

## ★ The two that needed design judgement

### 1 · Seat map → a real cabin (`.cc-plane`)
The flat `repeat(7,1fr)` grid is replaced by a **fuselage**:
- `.cc-plane-nose` — a curved top (border-radius ellipse) with a cockpit-window hint, so the unit
  reads front-of-aircraft at a glance.
- `.cc-plane-cabin` — ribbed walls (inset gradient stripes) + rounded tail.
- `.cc-plane-row` — a 3-col grid: `rownum · seats · rownum`. The seats themselves are
  `.cc-plane-seats` = `repeat(3,26px) 18px repeat(3,26px)` so there's a **true aisle gap** with a
  dotted centreline (`.cc-plane-aisle`).
- `.cc-plane-row[data-exit]` — sage rownum + small "EXIT" flanks (absolutely positioned, so they
  never disturb seat-column alignment).
- `.cc-plane-facility` — a dashed galley/lavatory divider band.
- Seats keep `.cc-conn-seat[data-state=free|paid|taken|selected]` **unchanged** — the colour
  language (sage free / gold-tint paid / gold selected / faint taken) carries over verbatim.
- **Responsive:** the cabin is `width:max-content; max-width:100%` and centres; on phone widths it
  fits a 6-abreast single-aisle without horizontal scroll at 26px seats.

### 2 · Plan-page hierarchy (`.cc-plan-tools`)
The day's spine reads first; the operational tools collapse into **one quiet region**:
- `.cc-plan-tools` is a `<details>` with secondary weight — paper-tinted ground, hairline border,
  mono uppercase `.cc-plan-tools-title` ("Trip tools") + an italic `.cc-plan-tools-hint` listing
  what's inside, and a rotating chevron (`::after`, 45°→225° on `[open]`).
- `.cc-plan-tools-body` holds budget / sharing / recurring / mileage — **below** the spine, never
  competing with it. The visual weighting is the point: it's a drawer, not a second hero.

---

## Coherence pass (D63)
- **`.cc-rail-nav` / `.cc-rail-group` / `.cc-rail-group-label`** — grouped sidebar (Day / Money &
  travel / Account); group labels are tiny mono uppercase in faint ink.
- **`.cc-plan-title` (+ `-edit`, `-input`, `[data-unnamed]`)** — tap-to-rename; pen fades in on
  hover/focus; an unnamed day is a Spectral-italic invitation.
- **`.cc-anchor-title-edit` (+ `-pen`, `[data-untitled]`)** — same pattern per stop.
- **`.cc-share-scope` (+ `-note`)** — pill group (Until I arrive / For today / For the trip / Set
  hours); active pill golds; the note reassures it ends on its own.

## Plan elevations (D69) + per-event mode (D70) + reminders (D71)
- **`.cc-plan-frame` / `.cc-plan-base` (+ `-pin/-text/-edit`, `[data-unset]`) / `.cc-plan-intention`
  (+ `-eyebrow/-text/-add/-input`, `[data-set]`)** — where the day starts + what it's for, under the
  title. Unset states are italic invitations.
- **`.cc-mode-tag-btn`** — a tappable variant of `.cc-mode-tag[data-mode]` (hover border only; the
  fill stays the work=gold / personal=faint language).
- **`.cc-readiness-add` / `.cc-readiness-clear`** — gold-text add affordance + a quiet remove.

## Transport parity (D67) + car continuity (D73)
- **`.cc-co-row` / `-head` / `-remove` / `-add`** — dashed sub-cards for multi-leg trains/flights
  inside the booking add.
- **Car node** reuses `.cc-base-node` with a `baseEyebrow` override — no new CSS; reads like home.

## Recurring (D72/D75)
- **`.cc-recurring` `<details>`** (+ `-summary/-title/-hint/-body/-list/-row/-row-main/-del/-add`) —
  same drawer grammar as Trip tools; rows carry a `.what` + mono `.when` + a mode tag.
- **`.cc-rec-offers` / `.cc-rec-offer` (+ `-text/-actions`)** — gold-tint strip: "X falls on a day
  that already has Y — add it?" with Add (gold) / Skip (quiet).

## Today weather (D76)
- **`.cc-today-head` / `.cc-weather` (+ `-temp/-meta/-headline/-place`, `[data-day]`)** — current
  chip: big display temp, headline (nowrap), mono place. `[data-day="night"]` shifts the ground cool.
- **`.cc-weather-hours` / `.cc-weather-hour` (+ `-time/-cond/-temp`)** — a horizontal hourly strip,
  scrollbar hidden, mono times/temps.

## Smaller cues
- **`.cc-pass-collapse`** (mono open/close affordance) + **`.cc-pass-del`** (now always-visible,
  faint→rust on hover).
- **`.cc-nudge-sample`** — Spectral-italic "· sample" honesty cue, secondary.
- **`.cc-save-notice`** — sage pill confirmation.

---

## States covered
Default + the domain states per surface: `[data-unnamed]`/`[data-untitled]`/`[data-unset]`/`[data-set]`
(empty invitations), `[data-active]` (scope pills), `[data-mode]` (work/personal), `[data-exit]`
(cabin), `[data-state]` (seats), `[data-day]` (weather), `[open]` (the two drawers). No loading/error
shapes were added (these are display/skin surfaces; their async states live in the components Code owns).

## Motion
Chevron rotate + pen/edit fade use `--dur-base` / `--ease-standard` (calm). No new keyframes.

## Accessibility
Drawers are native `<details>`/`<summary>` (keyboard + SR free). Edit affordances are real buttons.
Pills/segments are buttons with `data-active` reflecting `aria-pressed` (Code wires the ARIA).

## New tokens / components
**None.** All values are existing theme tokens or `color-mix()` over them. No contract changes —
every class above already exists in the markup per the Round 13 carrier note.

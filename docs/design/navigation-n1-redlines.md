# N1 — the guidance surface · handback

**Drop-in:** `khonsera-edition-iii-nav.css` → `src/app/`, imported **last**. Additive `.cc-nav*`,
tokens only, no new tokens introduced. **Proof:** `Khonsera N1 - Guidance Surface.html` renders the
hero chip (3 states), all six surface states, and the decision shapes.

Governing rule held throughout: **operational trust (Google/Apple-grade) + the differentiator always
on screen, in a calm voice. Calm carries consequence, never alarm. No emoji.**

---

## Two chromes
`.cc-nav` is light (walk/day). `.cc-nav[data-chrome="dark"]` is the Live / dark-train chrome —
aubergine-ink `#2a2233` (brand after-dark, **not** black), light text, deeper scrim. Every component
below inherits the chrome via `--nav-*` custom props, so one attribute reskins the whole surface.

---

## A · EventETAChip — the hero  (bind to `EventETA`)
`.cc-nav-eta-chip[data-state]` + `.cc-nav-eta` wrapper + `.cc-nav-eta-for` (the "for the 14:00
meeting" eyebrow).
- **Reads:** `place` (mono, tracked) — `projectedArrivalIso`→`HH:MM` — and the **spare** as the number
  you read first: `spareMin` ≥ 0 → "N MIN EARLY", `slackMin` small → "N MIN SPARE", `spareMin` < 0 →
  "N MIN LATE". `.cc-nav-eta-sub` carries an italic plain-fact gloss (state of the world, never of you).
- **State → colour** (left border + dot + spare): `on_track`=`--success`, `thinning`=`--amber`,
  `will_miss`=`--rust`. All three stay calm; `will_miss` is stated levelly ("3 MIN LATE · just past the
  hour"), never alarm.
- **Multiple commitments:** lead one prominent; add `[data-secondary]` chips beneath for the rest.
- **Field request:** none — the contract carries everything. (Optional: a `displayName` already-cased
  for the eyebrow; I derive it from `name` for now.)

## B · ManeuverBanner — the next move  (bind to the maneuver stream)
`.cc-nav-maneuver` — top, the loudest thing while moving. `.cc-nav-maneuver-glyph` (drop the existing
`ManeuverGlyph` in here, 46px), `.cc-nav-maneuver-dist` (big tabular distance, `<u>` for the unit),
`.cc-nav-maneuver-step` (road/step name, ellipsis), `.cc-nav-maneuver-next` (the turn-after pre-cue).
Distance figure is `--display` 30px for arm's-length legibility.

## C · DecisionCard — the concierge moment  (bind to `NavDecision`)
`.cc-nav-decision[data-severity]`, raised over guiding.
- **`calm`** — slate flank, `.cc-nav-decision-eyebrow` "Heads up", headline + italic consequence, a
  single quiet **Got it** (`.cc-nav-decision-dismiss`, full-width). Informing only; dismissible.
- **`act`** — rust flank, eyebrow "A decision", headline + consequence, then **one**
  `.cc-nav-decision-option`: a mode pill (`recommendation.option.mode` → `.cc-nav-decision-mode` with
  the mode glyph), the option `label`, `.cc-nav-decision-times` (`departIso → arriveIso`) with a
  sage **"makes the 14:00"** when `makesIt`, and `.cc-nav-decision-tradeoff` (the `tradeoff` string).
  Actions: **Accept** (gold, weighted) + **Let me think** (quiet).
- **Return-threatened:** add `[data-return-threat]` to the tradeoff → it renders in `--rust` ("Protects
  the 16:10 home — miss it and the next is 17:40"). This is the honest-cost surface.
- **One recommendation, never a wall.** Dismiss is final — Code's `key`/never-renag logic governs;
  the surface just animates out (`cc-nav-rise`, reversed).

## D · Map frame
`.cc-nav-map` is the full-bleed plate (MapLibre in app; the proof draws a faithful basemap + cased
route). Route/casing/label come from the **map theme slots** (maps round) — unchanged here. Top+bottom
scrims (`.cc-nav::before/::after`) keep chrome legible over any map content. The **puck** primitives
(`.cc-nav-puck`, `.cc-nav-puck-halo`) are the dot glued to the route — the trust primitive.

## E · Controls
`.cc-nav-controls` right rail: `.cc-nav-ctl` re-centre / overview / end (`[data-end]` = rust). 46px
hit targets, thumb-reachable above the chip.

---

## The six states (spec §4) — `.cc-nav[data-state]`
| State | Mechanism |
|---|---|
| **acquiring** | `.cc-nav-acquiring` calm locating field — pulsing gold ring + "Finding you…". Map tinted, never dead grey. |
| **guiding** | maneuver + controls + eta. The everyday surface. A thin `.cc-nav-consequence` line appears above the chip when the day's at risk but no decision is raised yet. |
| **decision** | `.cc-nav-decision` over guiding (calm or act). |
| **rerouting** | `.cc-nav-status[data-pulse]` "Re-routing… FROM HERE" — pill, pulsing dot, no jarring flash. |
| **offsignal** | `.cc-nav[data-state="offsignal"]` desaturates the map slightly; `.cc-nav-status[data-tone="offline"]` "Offline — showing your saved route". Honest live-vs-cached. |
| **arrived** | `.cc-nav-arrived` closes the loop — sage wash, check, "You made it — 11 minutes before.", **Back to the day**. |

---

## Motion
- Decision enters with `cc-nav-rise` (420ms, standard ease) — a measured rise, curtain-draw not a pop.
- Acquiring ring + re-routing dot pulse on `--ease-standard`; all motion gated behind
  `prefers-reduced-motion: no-preference`.

## Honest live-vs-estimated
The chip sub-line and consequence copy state world-facts only (delays, traffic, gaps) — never the
user's body/energy/mood (the §rule). A projection should read "estimated"; offline says it (the
off-signal status). Code supplies the live/estimated flag in copy; the surface styles both identically
so honesty is in the words, not a scary colour.

## New tokens / fields
**None.** All values are existing tokens. No `NavDecision`/`EventETA` field gaps — the contracts as
specced carry everything the surface needs. If the Underground fold (N3) needs a network-mode chrome,
it can host inside this same `.cc-nav` shell via a new `[data-modality]` — flagged for later, not now.

# Deep Review — Coherence Debt (2026-06-15)

Connor's read: *"We've made a lot of progress… however it's not all very polished. The side
menu has repeating icons and a confused navigation flow. The plan page has a share-location
element that isn't event-tied — it's a duration of visibility, not visibility for a leg/day/event.
You still can't rename an event or day — if they come in untitled they get stuck untitled. The
flight seat booking looks primitive — no shape of a plane, no clear walkway and seats. These are
the things I can pick up with a quick glance, and they indicate a greater pattern of incoherentness."*

He is right, and the diagnosis is precise. This document is the honest assessment, the root cause,
and the remediation — separated into what's been fixed this pass and what needs a Design coherence
round.

## Root cause — velocity bought capability at the cost of integration

Across Edition III P8–P18 + ED-Flight/Stay, each phase delivered a real capability and **appended a
panel** to `/plan/[id]` and (sometimes) **a row** to the sidebar. No phase ever stepped back to ask
"where does this belong in the whole?" The result is additive sprawl:

- **Sidebar** grew to ~10 flat items with no grouping, and reused the same glyph twice
  (`navigate` for both Navigate and Mileage; `clients` for both Clients and Workspace) because new
  rows were added without minting new icons. The flat list reads as a pile, not a hierarchy.
- **Plan page** renders **16 stacked sections** in raw source order — IntentionCard, decision-clock,
  day-ripple, fragility, nudges, manage-bookings, budget, share, map, readiness, constraints, spine,
  then five add-actions. Every one is individually sound; together they have no information
  hierarchy, so the eye can't tell the day's *spine* (the point) from the *trip tools* (the admin).
- **Rename** was never surfaced because the brief/import path always *supplied* a title, so the
  "untitled" case was invisible during the build. The server actions (`updateItinerary`,
  `updateStop`) have always supported it — it was purely a missing affordance.
- **Share** was built as a personal-safety primitive (a revocable, time-bounded gift) and shipped
  with a raw duration picker. It's *already* scoped to the itinerary in the data layer — but the UI
  asks "for how many hours?" instead of "for which part of this journey?", so it reads as a
  detached timer rather than something tied to the day.
- **Seat map** got correct *data* (`rows: SeatCell[][]` with aisle cells) but a placeholder
  *render*: one flat `repeat(7, 1fr)` grid with no row numbers, no fuselage, no per-row structure —
  so it looks like a spreadsheet, not a plane.

The common thread: **Code optimised for "the capability works end-to-end" and deferred "the
capability sits coherently in the product."** That deferral compounded into the pattern Connor felt.

## Severity + fix class

| # | Symptom | Root cause | Fix class | Status |
|---|---------|-----------|-----------|--------|
| 1 | Repeating sidebar icons | new rows reused glyphs | Code (icons) | **Fixed this pass** |
| 1b| Flat, confused nav flow | no grouping | Code (IA) | **Fixed this pass** — grouped Day / Money & travel / Account |
| 2 | Can't rename event/day → untitled sticks | affordance never surfaced | Code (UI; actions exist) | **Fixed this pass** — inline rename on the plan title + per-stop rename |
| 3 | Share is a timer, not event-tied | UI asks hours, not scope | Code (UI; data already itinerary-scoped) | **Fixed this pass** — scope options (Until I arrive / For today / For the trip / custom) |
| 4 | Seat map primitive | placeholder render | Code markup + Design skin | **Markup rebuilt this pass** (row-by-row plane shape, row numbers, fuselage) — Design to refine the visual |
| 5 | 16-panel plan page, no hierarchy | additive sprawl | Code IA skeleton + Design round | **Skeleton this pass** — primary spine vs. a collapsed "Trip tools" region; full visual hierarchy is a Design round |

## What changed in code this pass

1. **Sidebar (`app-sidebar.tsx`)** — Mileage gets its own odometer glyph; Workspace gets a building
   glyph (no more duplicates). Items are grouped under quiet section labels: **Day** (Today, Plan,
   Tasks, People/Clients, Wallet), **Money & travel** (Navigate, Expenses, Mileage), **Account**
   (Workspace, Settings). One flat pile → three legible groups.
2. **Rename (`plan/[id]` header + `PlanSpine`)** — the plan title is an inline-editable field
   (`PlanTitleEditor` → `updateItinerary`); an untitled day shows a clear "Name this day" prompt
   instead of a frozen fallback. Each anchor's title is tappable to rename
   (`RenameSheet` → `updateStop`), so an untitled event is never stuck.
3. **Share (`share-control.tsx`)** — the duration buttons become journey-scoped choices:
   *Until I arrive* (auto-computed to the day's last stop), *For today*, *For the trip*, and a
   *custom hours* fallback. The copy now frames the share as tied to **this journey**, not a clock.
4. **Seat map (`flight-finder.tsx` + connections CSS)** — rebuilt to a real cabin: rows render
   row-by-row with row numbers down the side, the aisle as an actual gap, seats lettered, wrapped in
   a fuselage frame with a nose cue. Data was already correct; only the render changed.
5. **Plan page IA (`plan/[id]/page.tsx`)** — the day's *spine* (intentions, decision-clock, live
   ripple/fragility, nudges, map, the threaded spine) stays primary and up top; the *operational
   tools* (manage bookings, budget, share, constraints, readiness) move into a single labelled,
   collapsible **Trip tools** region so the page reads as "the day, then the tools," not a pile.

## What still needs Design (the coherence round)

Code has provided the correct structure and on-token, contract-classed markup. The *visual*
coherence pass is Design's:

- **Seat map** — the plane shape now has the right bones (rows, aisle, row numbers, fuselage). Design
  should give it the finished cabin treatment (curved fuselage, wing/exit-row cues, the brand seat
  states) so it reads unmistakably as an aircraft.
- **Plan-page hierarchy** — Code grouped the panels; Design owns the visual weighting (what's a hero,
  what's a quiet utility, spacing rhythm, the collapsed-region affordance) so the grouping *feels*
  like a hierarchy and not just boxes in a different order.
- **Sidebar** — the grouping is structural; Design should set the section-label treatment and the
  rail's vertical rhythm.

A Design handoff pack (the standing three artifacts + this review's "needs Design" list) should go
out for this round.

## The lesson, encoded going forward

**An entity/phase is not "done" when the capability works — it's done when the capability sits
coherently in the product surface.** From here, each phase's definition-of-done includes: *does this
add a panel/row, and if so where does it belong in the existing hierarchy?* This is added to the
standing orders so velocity stops accruing coherence debt.

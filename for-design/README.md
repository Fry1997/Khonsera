# for-design.zip — Round 1 pack (Code → Design)

Everything Design needs to design the two P1 screens — **Planner/Timeline** and **Today** — on the
real Edition II skin and real data shapes. (The brand book is Design's own artifact; not included.)

## Contents
- `screen-specs/planner.md`, `screen-specs/today.md` — per-screen: purpose, every data element,
  every state, morph behaviour (the three-variable AnchorCard model, the train booking-pair, gap/
  leg/ComparisonMatrix logic; Today's four states + the morph).
- `component-contract.md` — the 13 named concierge components: data + states. **Keep the names.**
- `design-tokens.md` — the Edition II token manifest (the values + the iron rule).
- `khonsera-edition-ii.css` — the **live** skin. Extend it; don't reinvent. (It currently re-skins
  legacy atom classes; the concierge components consume the same tokens.)
- `example-data/` — real JSON, no lorem: `fact-list.json` (a full day, anchors+legs+sub-legs+gap+
  intention), `multi-day-trip.json` (flight + inferred accommodation/luggage proposals),
  `today-{dormant,readiness,intransit,arrived}.json` (a payload per Today state).
- `breakpoints.md` — the three mobile-first sizes.

## What to return (`for-code.zip`)
Screen designs for Planner + Today (all states × 3 sizes), an **additive override CSS** (never edits
to globals.css), and redlines. Code implements on live data, reaches parity, strips legacy, then
ships `live-screenshots.zip` for you to react to.

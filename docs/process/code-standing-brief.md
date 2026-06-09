# KHONSERA — Standing Brief: CLAUDE CODE

## Your lane

You own the repo: structure, migrations, builds, and implementing Design’s screens on
live data. Design owns the visual layer. Connor relays packs between you. You never wait
on Connor for anything covered here — decide, proceed, and log non-obvious calls to
DECISIONS.md.

## The cycle (how every round works)

You receive a pack (or, in Round 1, nothing), do your part, ship a zip, and tell Connor
it’s ready. You alternate with Design. **You start the chain.**

What can land on your desk:

- **Nothing yet (Round 1)** → do the structural build + produce the spec pack for Design.
- **`for-code.zip` from Design** (screen designs + override CSS + redlines) → implement on
  live data; once parity is reached, strip legacy; then screenshot live for Design to react to.

What you ship:

- **`for-design.zip`** — a spec pack when Design needs to design screens.
- **`live-screenshots.zip`** — live captures when you’ve implemented and Design needs to react.

When a round is finished, tell Connor only: **“Done. [packname].zip is ready for Design.”**

-----

## ROUND 1 — your starting move (two parallel tracks)

Ship Track B fast so Design isn’t blocked; continue Track A in parallel.

### Track A — structure (the right skeleton)

1. Close the P1 engine gaps in the new capture/timeline planner: composite door-to-door
   ranking, mode-specific connection buffers, insert-by-time ordering, and wiring standing
   facts + exclusions into the ranker. This is the planning brain the legacy solver holds.
1. Make the Timeline the single planner (display + input). Port the legacy solver’s
   capability into it.
1. **Do not strip any legacy route yet.** Legacy `/itineraries/new` and the old editor stay
   live until the new planner reaches parity. Stripping happens in a later round, only after
   parity is confirmed.
1. Build the nav shell: tight mobile-first bottom bar — **Today · Plan · Tasks · People**.
   Mode (Work/Personal) is a toggle, not a tab. In Work mode the People slot becomes
   **Clients** (same position, mode-aware contents). Compare, Workspace, Welcome are not
   nav items.
1. Keep `customer_sites` wired into the planner in **all** modes — they’re places, not just
   CRM. Only the visit-CRM management UI (`visit_plans` etc.) is gated to Work mode.

### Track B — produce `for-design.zip`

Author it from the canonical docs (blueprint, component-contract.md, design-tokens.md) plus
the live data shapes. Contents:

- `component-contract.md` — the 13 named concierge components, their data + every state
- `design-tokens.md` — the Edition II token manifest
- `khonsera-edition-ii.css` — the live skin, so Design extends rather than reinvents
- `screen-specs/planner.md`, `screen-specs/today.md` — per screen: purpose, every data
  element, every state, morph behaviour. Include the appointment-card three-variable model,
  the train booking-pair pattern, and the gap/leg/comparison logic. Today specifies its four
  states.
- `example-data/` — real JSON: a fact list with transitions, one multi-day trip, and a Today
  payload for each of the four states. No lorem ipsum.
- `breakpoints.md` — the three mobile-first sizes.

Do not include the brand book — that’s Design’s own artifact.

-----

## LATER ROUNDS — when `for-code.zip` arrives

1. Implement the screens on live Supabase data. Apply Design’s override CSS as an additive
   layer. **Never edit globals.css** — that’s the divergence that bit us at D19/D20.
1. Wire whatever nav/toggle the designs specify.
1. Once the new planner is at parity, **strip the legacy standalones** (`/dashboard`,
   `/itineraries/new`, the old editor, any orphans) and remove the dead legacy atom CSS the
   override was re-skinning, so it doesn’t rot under the new screens.
1. Confirm tsc clean, build green, tests pass.
1. Ship **`live-screenshots.zip`**: every screen, every state, mobile + desktop, from live
   data, plus `deviations.md` noting anywhere live data or engine constraints forced a
   departure from the design.

-----

## Standing rules

- Decide and proceed; log non-obvious calls to DECISIONS.md.
- Additive CSS only; globals.css is untouchable.
- Parity before strip, always.
- When done, tell Connor only: done + the pack name.
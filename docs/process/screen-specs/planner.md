# SCREEN SPEC — PLANNER / TIMELINE

*For Design. Destination: `screen-specs/planner.md` inside `for-design.zip`.*

## Purpose

The single planner. It is both **display and input** — there is no separate “build my day”
form. You read your plan here and you shape it here. The screen is a vertical, time-ordered
spine of facts; you add facts in plain language, in any order, and the engine threads them
into a coherent plan with travel back-calculated between them.

## Mental model

A vertical spine: top = earliest, bottom = latest. Three kinds of thing sit *on* the spine,
and two kinds sit *beside* it as proposals.

On the spine:

- **Anchors** — fixed facts (an appointment, a flight, a hotel check-in). → `AnchorCard`
- **Legs** — the travel between two adjacent anchors. → `LegCard`
- **Gaps** — unallocated time between anchors. → `GapCard`

Beside it, as confirmable proposals (never silently inserted):

- **Intentions** — things you want but haven’t fixed (“see the museum”). → `IntentionCard`
- **Inferred proposals** — multi-day implies accommodation + luggage. Surfaced for
  confirmation, visually provisional.

Core loop: type a fact in plain language → it lands on the spine **at the right time**
(insert-by-time, not append) → the engine recomputes the legs around it → if a leg has
choices, you pick from the `ComparisonMatrix` → choosing **hardens** fuzzy values.

## The AnchorCard model (the heart of the screen)

Three variables: **arrive-by**, **duration**, **leave-by**. Set any two and the third is
**derived**. Each variable can be in one of these states, and Design must make them visually
distinct:

- **precise** — a committed clock time; looks settled.
- **approximate** — “around 2ish”; looks soft.
- **ranged** — “between 2 and 3”; a span.
- **by-a-time** — “by 3 at the latest”; a ceiling.
- **maximise** — “as long as possible here”; an elastic value, always **bounded by standing
  constraints** (e.g. the last train home).
- **derived** — computed by the engine from the other two; looks effortless, not directly
  editable.

Fuzzy values **harden progressively**: “afternoon” becomes a precise arrive-by the moment a
train is selected. Design needs to show the journey from soft → settled clearly.

## LegCard & transitions

A leg sits between two anchors and represents the journey. Three structural patterns, each
with optional **first-mile / last-mile** sub-legs (e.g. walk → train → taxi):

- **Direct**
- **Drop-and-go**
- **Hub-to-hub**

The leg’s headline figure is **door-to-door total time** — that is the only thing that ranks.

Leg states (design each):

- **unresolved** — engine knows a leg is needed, no option chosen yet.
- **proposed** — engine’s best option shown, not committed.
- **chosen / booked** — committed.
- **at-risk** — tight connection or downstream conflict flagged.

## ComparisonMatrix

Opens when you tap a leg to choose transport.

- Shows the **top four fastest viable options**, ranked by **door-to-door total time**.
  “Show all” reveals the rest.
- **Speed ranks; exclusions filter.** An exclusion (“no flights”) removes options entirely —
  it never just down-ranks them.
- Each option shows: door-to-door time (the rank key), the mode mix / sub-legs, cost,
  departure + arrival.
- **Must not read as a preference-weighted scorecard.** There is one criterion. The ranking
  should feel self-evident, not like a multi-factor table the user has to interpret.

## Train booking-pair pattern

- Outbound + return are a **single bookable unit**.
- Left/right chevron steps between the two halves.
- A live **consequence band** shows downstream impact of the current selection
  (e.g. “this return means you leave the museum by 16:10”).

## Inference principle

The engine infers what context allows and surfaces it as a **confirmable proposal** — never
an automatic insertion. Suggested *activities* are never auto-added to the timeline.
Proposals (accommodation, luggage, an intention) must read as provisional and dismissable,
clearly different from committed anchors.

## Screen states to design

1. **Empty** — no facts. The plain-language input is the hero. A calm invitation, not a form.
1. **Sparse** — one or two anchors, gaps dominant, legs unresolved. The engine is asking to
   be fed.
1. **Threaded** — multiple anchors with computed legs; a coherent plan. The everyday state.
1. **Resolving** — `ComparisonMatrix` open, or a fuzzy value hardening. A focused sub-state.
1. **At-risk** — a tight connection / conflict flagged, consequence band live. Clear but
   **calm** — not alarm-red everywhere.

## Layout (mobile-first)

Single vertical column spine. The plain-language input is always reachable (sticky or a
persistent affordance). Cards full-width with generous vertical rhythm. On mobile the
`ComparisonMatrix` is a **focused sheet/overlay**, not a wide table. At larger sizes the
spine stays centred with breathing room rather than stretching to fill width.

## Restraint notes (brand-critical)

This is where “private jet, not Monarch” lives. Withhold. The plan should feel considered
and quiet — warm linen paper (#F2EEE3) dominant, gold accent **reserved** for the single
most important action or the live indicator, never sprinkled. Derived values should feel
effortless, as if the system did the work silently. Avoid badge-clutter and a pill on
every row.
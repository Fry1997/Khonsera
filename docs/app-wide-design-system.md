# Khonsera app-wide design system

Status: **Pass 5 — spacing, alignment and placement**

This document defines how the approved visual reference becomes the language of the whole application. It replaces the previous pattern of treating individual routes as separate visual editions.

## Product character

Khonsera is a precise, calm travel instrument. It should feel highly considered and operational without becoming cold, futuristic or decorative.

The visual language is:

- warm ivory application ground
- near-white working surfaces
- deep green for identity, controls and dependable actions
- burnt orange for movement, direction and moments that require attention
- fine warm borders rather than heavy card shadows
- large editorial headings paired with compact technical labels
- dense, detailed information arranged with clear hierarchy
- restrained, slightly asymmetric geometry and a consistent icon weight

## Architecture rule

**Routes own composition. The design system owns appearance.**

A route may decide that Today uses a continuous itinerary while Wallet uses a document library. It may not invent its own colour palette, typography scale, button treatment, status language, card geometry, navigation pattern or page-spacing system.

The shared authority is layered deliberately:

1. `src/app/khonsera-system.css` — colour, type, spacing tokens, shell, controls, surfaces and semantic status.
2. `src/app/khonsera-components.css` — navigation items, itinerary nodes, commitment cards, movement cards, transfers, passes, tickets and sheets.
3. `src/app/khonsera-primary-flows.css` — the shared planning-to-operation composition used by Today and Plan.
4. `src/app/khonsera-secondary-surfaces.css` — Plan index, Wallet and the common list, ledger, task, contact and empty-state language.
5. `src/app/khonsera-demo.css` — the visible staff-demo boundary without a second component system.
6. `src/app/khonsera-layout.css` — final page gutters, column edges, vertical rhythm, card alignment and responsive placement.

These layers load after the historical route styles. Older files remain temporarily for structural compatibility while their visual authority is retired during the rollout.

## Shared primitives

### Application shell

One wordmark, app bar, desktop rail, mobile bottom navigation, overflow sheet and account treatment are used across all authenticated routes.

Selected navigation uses deep green with a small orange directional mark. Desktop and mobile use the same selection language rather than unrelated skins.

### Surfaces

- **Ground** — the warm application canvas
- **Surface** — primary cards, documents and sheets
- **Subtle surface** — chips, secondary controls and inset groups
- **Inset** — readouts and non-interactive wells
- **Overlay** — modal and bottom-sheet content

Surfaces use warm hairlines and restrained elevation. Shadow cannot be used to disguise weak hierarchy.

### Typography

- Satoshi: wordmark, display, headings, controls and body
- JetBrains Mono: times, station codes, technical labels and eyebrows

Eyebrows are uppercase, compact and orange. Headings are deep green with tight editorial tracking. Body copy is quieter but remains high contrast.

### Colour semantics

- **Deep green** — primary interaction, dependable action, selected navigation
- **Burnt orange** — direction, movement, live travel moments and active attention
- **Green status** — on time, confirmed, complete
- **Amber status** — tight, delayed, caution
- **Rust status** — failed, cancelled, at risk
- **Blue-grey status** — neutral information

Orange is not a general decoration colour. Green is not used to make every surface feel selected.

### Controls

All primary controls use a minimum 44px target. Button, input, selector, chip, icon-button and focus treatments are shared. Focus rings use orange so keyboard state remains visible against green controls.

### Itinerary and commitments

Today and Plan use the same spine vocabulary:

- a fine structural rail
- compact, squared timeline glyphs
- orange for movement and changes
- green for commitments and dependable actions
- one decisive emphasis treatment for the immediate next movement
- shared appointment, station, transfer, gap and base treatments

Plan variables use a common three-readout grid. Movement cards use the same route, timing, spare-time and risk hierarchy whether they appear during planning or on the live day.

### Transport and documents

Timeline nodes, rail legs, transfers, live status, tickets and passes are one component family wherever they appear.

- Today shows a compact operational pass.
- Plan docks the same pass into the itinerary.
- Bookings and Wallet may expand the document with changes, seats, restrictions and price.
- The operator band, route codes, timing hierarchy, status language and ticket action remain recognisably the same.

The document family is modern and technical rather than decorative paper cosplay. A route or line accent identifies the mode; it does not restyle the entire component.

### Sheets

All plan, import and edit dialogs use the shared `Sheet` primitive. Mobile presents a bottom sheet with safe-area padding; tablet and desktop use a centred, bounded dialog. Focus, Escape handling and opener restoration remain owned by the component.

## Today and Plan: one product flow

Today is the operational state of the plan, not a separate dashboard skin.

Both routes now share:

- the same bounded working canvas and desktop main/context proportions
- the same orange-marked day identity header
- the same itinerary, movement, commitment and document hierarchy
- the same compact concierge context rail
- matching decision readouts: Plan’s leave-by decision and Today’s live next move
- the same responsive transition from one-column mobile to a main/context command desk

The live next-move surface remains light and structured. The former decorative gradient and circular countdown treatment are replaced by a near-white instrument panel, an orange directional seam and a compact technical countdown readout.

## Secondary surfaces

The application no longer falls back to an older card language after leaving Today or an individual plan.

- **Plan index** presents days as dense operational records grouped by time horizon, with work/personal line identity and quiet destructive actions.
- **Wallet** behaves as a document library rather than a novelty overlapping stack. The next pass remains complete; additional documents use compact, recognisable previews.
- **Tasks and ledgers** share section headers, row density, check controls, totals and monetary typography.
- **Contacts** use the same asymmetric geometry, green identity block and orange communication cue.
- **Empty states** are direct and actionable. Decorative brand imagery is removed from the working UI.

## Spacing, alignment and placement

The app now uses one page grid rather than route-by-route nudges.

- Mobile uses a consistent 16px working gutter, reduced to 14px only at the 320px minimum.
- Tablet uses 24px gutters and retains a single primary reading flow before splitting supporting context.
- Desktop uses a 744px operational column, a 336px context column and a 24px shared gutter.
- Today, Plan and the staff demo share the same outer edges and column boundaries.
- Page headers, first content blocks and supporting action rows align to those same edges.
- The itinerary spine uses a fixed marker column and consistent card offset, removing uneven left edges between movement, appointment, station and ticket blocks.
- Card internals use shared 8px, 12px, 16px and 24px intervals rather than unrelated local values.
- Wallet, settings, lists and empty states use the same page rhythm and no longer sit arbitrarily inside the shell.
- Safe-area padding and bottom-navigation clearance are handled by the shared frame rather than individual routes.

This pass deliberately changes placement only. It does not alter colour, typography, status meaning, data behaviour or the demo/live boundary.

## Migration sequence

1. **Foundation** — shared tokens, shell, typography, controls, surfaces and status language. Complete in Pass 1.
2. **Common components** — navigation, cards, sheets, itinerary primitives, tickets and passes. Established in Pass 2.
3. **Primary flows** — Today and Plan share one planning-to-operation hierarchy. Established in Pass 3.
4. **Secondary surfaces** — Plan index, Wallet, tasks, ledgers, contacts and empty states use the shared language. Established in Pass 4.
5. **Spacing and placement** — one page grid, vertical rhythm, card alignment and responsive edge contract. Established in Pass 5.
6. **Coherence audit** — remove redundant route-level appearance rules and visually verify populated states at every supported width.

## Responsive contract

- 320px: absolute minimum without horizontal overflow
- 390px: primary mobile acceptance width
- 430px: large-phone width
- tablet: increased gutters, no arbitrary desktop card grid
- desktop: persistent rail and bounded working canvas

Mobile is not a scaled-down desktop dashboard. Content order, density and disclosure may change, while the shared primitives remain the same.

## Review checklist

For every migrated route:

- Does it visibly belong to the same application as Today and Plan?
- Are shared components reused rather than reskinned?
- Are status meanings identical across contexts?
- Does the screen remain useful at 320px?
- Is every interactive target at least 44px?
- Is orange reserved for movement or attention?
- Is information density controlled by hierarchy rather than empty space?
- Do page edges, card edges and header edges align to the shared grid?
- Does route CSS contain composition rather than a new visual or spacing system?

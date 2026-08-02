# Khonsera app-wide design system

Status: **Pass 2 — shared component language**

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

A route may decide that Today uses a continuous itinerary while Wallet uses a document stack. It may not invent its own colour palette, typography scale, button treatment, status language, card geometry or navigation pattern.

The shared authority is layered deliberately:

1. `src/app/khonsera-system.css` — colour, type, spacing, shell, controls, surfaces and semantic status.
2. `src/app/khonsera-components.css` — navigation items, itinerary nodes, commitment cards, movement cards, transfers, passes, tickets and sheets.

Both load after the historical route styles. Older files remain temporarily for composition while their appearance rules are removed during the rollout.

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
- one dark-green emphasis surface only for the immediate next movement
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

## Migration sequence

1. **Foundation** — shared tokens, shell, typography, controls, surfaces and status language. Complete in Pass 1.
2. **Common components** — navigation, cards, sheets, itinerary primitives, tickets and passes. Established in Pass 2.
3. **Primary flows** — Today and Plan migrate together.
4. **Secondary surfaces** — Trips, Bookings, Wallet, live updates, wayfinding and settings.
5. **Coherence audit** — remove route-level appearance rules and test all supported widths.

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
- Does route CSS contain composition rather than a new visual system?

# Khonsera app-wide design system

Status: **Pass 1 — shared foundation**

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
- restrained radii and a consistent icon weight

## Architecture rule

**Routes own composition. The design system owns appearance.**

A route may decide that Today uses a continuous itinerary while Wallet uses a document stack. It may not invent its own colour palette, typography scale, button treatment, status language, card geometry or navigation pattern.

`src/app/khonsera-system.css` is loaded after the historical style layers and is the final shared authority. Older route files remain temporarily while their composition rules are separated from their visual rules.

## Shared primitives

### Application shell

One wordmark, app bar, desktop rail, mobile bottom navigation, overflow sheet and account treatment are used across all authenticated routes.

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

### Transport and documents

Timeline nodes, rail legs, transfers, live status, tickets and passes are one component family wherever they appear. Today may show a compact operational ticket; Bookings may show it in a list; Wallet may show the full pass. Their identity and states remain consistent.

## Migration sequence

1. **Foundation** — shared tokens, shell, typography, controls, surfaces and status language.
2. **Common components** — navigation, cards, sheets, itinerary primitives, tickets and passes.
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

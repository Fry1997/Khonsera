# Khonsera — Component & Screen Contract (§3)

The shared inventory Code and Design refer to **by the same names**. Re-ground every session on this
+ `docs/design-tokens.md`. Status: **exists / partial / stub / not-built**. When Design introduces a
new component, register it here via the relay.

## Name reconciliation (protocol name ↔ code)
| Protocol §3 name | In code |
|------------------|---------|
| Active tile | dashboard `HeroTrip` (`src/app/(app)/dashboard/page.tsx`) — partial |
| Intention card | `src/components/itinerary/stopover-card.tsx` |
| Gap / question card | `src/components/itinerary/transition-row.tsx` + `src/components/gap-mode-picker.tsx` |
| Leg card | `transition-row.tsx` (+ `train-ticket-card.tsx` for booked) |
| Comparison matrix | — (not built; data via `use-route-preview.ts`) |
| Journey list card | `TripRow` in `src/app/(app)/itineraries/page.tsx` |
| Readiness prompt | back-calc logic only (`StopoverBackCalc`); no UI |

## Screens / surfaces
| Surface | File | Status | Notes |
|---------|------|--------|-------|
| Welcome / first-run | `src/app/page.tsx` | partial | Hero + four pillars; no two-path concierge fork |
| Journey list / home | `src/app/(app)/dashboard/page.tsx` | exists | hero trip, upcoming, stats, calendar, week grid |
| Timeline (core) | `src/app/(app)/itineraries/[id]/itinerary-editor.tsx` + `components/itinerary/timeline.tsx` | exists | anchors/legs/gaps/stopovers, map, status flow |
| New brief | `src/app/(app)/itineraries/new/new-itinerary-form.tsx` | exists | base location, anchors, bookings, spine preview |
| Capture | `src/app/(app)/capture/` + `components/capture/` | exists | fact cards, in-text light-up, autosuggest |
| Today / Live | dashboard `HeroTrip` | partial | calm/imminent/live; **no disruption surface** |
| Comparison view | — | not-built | needs the door-to-door ranking work |
| Mode switch (Work⇄Personal) | — | not-built | workspaces in DB, no toggle UI |
| Settings | `src/app/(app)/settings/page.tsx` | exists | travel profile, calendar, gmail, theme, rail seed |
| Contacts | `src/app/(app)/customers/[id]/contacts-panel.tsx` | exists | list + add/edit/delete |
| Tasks | — | not-built | no task list/CRUD |
| Expenses | `src/app/(app)/expenses/` | exists | totals strip, month groups, status |
| Bookings / Flights / Locations / Customers / Itineraries | `src/app/(app)/{bookings,flights,locations,customers,itineraries}/` | exists | supporting lists |
| Workspace / admin | — | not-built | roles/approvals/allowance |

## Components
| Component | File | Status | States |
|-----------|------|--------|--------|
| Anchor card | `components/itinerary/anchor-card.tsx` | exists | appointment/stay/meal/event/station; collapsed/expanded; timing modes |
| Transition / Leg / Gap | `components/itinerary/transition-row.tsx`, `gap-mode-picker.tsx` | exists | mode pills, previews, sub-leg pickers, feasibility flag |
| Intention (stopover) card | `components/itinerary/stopover-card.tsx` | exists | dashed, back-calc summary (fits/tight/infeasible) |
| Transport booking card | `components/itinerary/transport-booking-card.tsx` | exists | mode, hubs, changeovers, ref/seat/price, confirmed |
| Accommodation booking card | `components/itinerary/accommodation-booking-card.tsx` | exists | check-in/out, ref, room, price |
| Journey spine | `components/itinerary/journey-spine.tsx` | exists | read-only preview, empty state |
| Journey map | `components/journey-map/journey-map.tsx` | exists | MapLibre; dusk/midnight/sahara; **Design themes, doesn't rebuild** |
| Train ticket card | `components/train-ticket-card.tsx` | exists | compact/expanded, Aztec barcode, outbound/return |
| Flight status card | `components/flight-status-card.tsx` | exists | scheduled/active/landed/cancelled/diverted |
| Journey list card | `itineraries/page.tsx` `TripRow` | exists | incomplete/complete, live variant, status pill |
| Expense row | `expenses/expenses-row.tsx` | exists | type, amount, status |
| Contact chip "send update" | — | partial | data model only; no action UI |
| Task row | — | not-built | |
| Active tile | dashboard `HeroTrip` | partial | no imminent/live/disruption morph set |
| Comparison matrix | — | not-built | |
| Readiness prompt | `StopoverBackCalc` logic | stub | no narrative UI |
| Mode switch | — | not-built | |
| Notification / nudge | home/leave-by nudges in `timeline.tsx` | partial | no severity system / dismissible nudge component |
| Pickers / primitives | `transport-hub-picker.tsx`, `place-picker.tsx`, `components/ui/{form,button,page-shell,editorial,verdict-pill}.tsx` | exists | |
| Nav shell | `app-sidebar.tsx`, `mobile-topbar.tsx`, `mobile-tabbar.tsx` | exists | desktop + mobile |

## The "not-built" set (where net-new Design work lands)
Comparison matrix · Mode-switch (Work/Personal) · Workspace/admin · Tasks · immersive Today/Live +
disruption · Readiness prompt UI · Contact-chip "send update" · a proper severity-based
Notification/nudge component.

## Build-order spine (sequence relay round-trips by this)
foundation → timeline → capture → decisions (comparison) → day-of (today/live) → nav → orchestration
→ people/expenses → teams. Design surfaces in roughly this order so design effort tracks what Code
can wire next.

# Khonsera — Foundation Rebuild: Triage Inventory (Step 2) ⛔ checkpoint

Per the Code Kickoff Brief. **Nothing is deleted yet — this is for your review.** Marks: **KEEP**
(salvage as-is / light edits) · **REWIRE** (good algorithm, must re-point at the new data model) ·
**REBUILD** (concept stays, redone on the new foundation) · **STRIP** (not in the new product).

## Recommended posture (the one decision that shapes everything)

**Reshape-in-place onto the new foundation — NOT a greenfield rebuild.** Rationale: the current repo
is *not* a blank-slate mess. Identity (`workspaces`/`memberships`/`profiles`) exists; the journey
spine (`itineraries`/`stops`/`transitions`) exists; and the engines the brief tells us to KEEP
(capture parser, Trainline/Gmail, MapLibre + rail routing, planning/feasibility, the theme) are
tested and recent. A literal rebuild would discard working code and re-introduce bugs we already
fixed. The truly foundational work that *can't* be retrofitted cheaply (§2, §15) is narrower:

1. **Identity → add `Mode` (work/personal) + the hard privacy boundary + the role reshape**
   (`company_admin | team_manager | traveller`). Every record scoped to user + mode (+ workspace).
2. **Journey model → promote `Intention`, `Gap`, `ResourceState` to first-class**, give `stops`
   true `Anchor` semantics, and `transitions` true `Leg` semantics (bookingStatus, resourceConsumed).

Everything else is KEEP, REWIRE-to-new-model, or STRIP. This gets us to the plateau in a fraction of
the time and risk of a from-scratch rebuild, while still honouring "clean, navigable foundation."

---

## Data model / DB (40 tables) — the foundational layer

| Area | Tables | Call |
|------|--------|------|
| Identity & tenancy | `profiles`, `workspaces`, `memberships`, `workspace_settings` | **REBUILD** — add `mode`, privacy-boundary RLS, role enum (company_admin/team_manager/traveller). Foundational; do first. |
| Journey core | `itineraries`(Journey), `stops`(Anchor), `transitions`(Leg) | **REBUILD/extend** — Anchor/Leg semantics; add `Intention`, `Gap`, `ResourceState` tables. |
| Capture substrate | `captured_inputs`, `standing_facts`, `intents` | **KEEP** (re-scope to mode). |
| Bookings | `travel_bookings`, `travel_booking_segments`, `booking_intents` | **REWIRE** — behind the §17 provider-stub interface. |
| People/ledger | `contacts`, `expense_records`, `mileage_expenses`, `notification_rules` | **KEEP/REWIRE** — contacts + expenses are in spec (§4.8–4.10); add `tasks`. |
| Travel profile/calendar | `travel_profiles`, `calendar_connections`, `calendar_event_links`, `gmail_*` | **KEEP** (Gmail/Trainline is brief-KEEP). |
| Rail/routing cache | `rail_route_cache`, `route_preview_cache` | **KEEP**. |
| **CRM / field-sales (legacy)** | `customers`, `customer_sites`, `visit_plans`, `visit_checklist_items`, `visit_status_edges`, `saved_trips`, `saved_trip_edges`, `travel_options`, `journey_legs`, `journey_leg_alternatives`, `planning_runs`, `trip_progress` | **STRIP / confirm** — these are a B2B customer-visit CRM flavour the new personal+work concierge spec doesn't include. Biggest strip; needs your nod. |
| Infra | `audit_events`, `jobs`, `itinerary_status_edges` | **KEEP**. |

## Routes (28) → the spec's screen list

| Current route | Call | Becomes |
|---------------|------|---------|
| `dashboard` | **REBUILD** | Journey list / home (+ Active tile placeholder) |
| `itineraries/[id]` | **REBUILD** | **Timeline** (core surface — display + input) |
| `itineraries/new` | **STRIP/merge** | folds into Timeline (one-surface principle, §5/§19) |
| `itineraries` (list) | **KEEP/REBUILD** | Journey list |
| `capture` (+drafts) | **KEEP** | Capture (manual NL entry — just built, on-brand) |
| `settings` (+rail-network) | **KEEP** | Settings (mode, home anchor, notif channel, morning routine) |
| `expenses` | **KEEP/REWIRE** | Expenses |
| `customers` (+[id]/new) | **STRIP** | (CRM — not in spec; contacts replace it) |
| `flights` | **STRIP/merge** | folds into flight anchors (§8) |
| `bookings` | **STRIP/merge** | folds into Timeline / a bookings wallet |
| `locations` | **STRIP/merge** | folds into Settings (home/start) + place picker |
| auth: `login/signup/forgot/reset`, `auth/callback` | **KEEP** | unchanged |
| `api/auth/{gmail,google}`, `api/barcode`, `api/maps/*` | **KEEP** | unchanged |
| `api/debug-email` | **STRIP** | dev-only |
| NEW (not built) | **BUILD** | Today/Live · Comparison · **Mode switch** · Workspace/admin stubs |

## Lib modules (19) — the engines

| Module | Call | Note |
|--------|------|------|
| `parser/`, `dictionary/` | **KEEP** | capture engine (just built/tested) |
| `gmail/` | **KEEP** | Trainline parser — brief-KEEP; broaden providers later |
| `osm/`, `itinerary/` | **KEEP** | rail routing + solver; brief-KEEP map |
| `planning/`, `feasibility/` | **KEEP/REWIRE** | decision layer (§7) — re-point at new model |
| `actions/` | **REBUILD** | server actions re-wired to mode-scoped model |
| `aviationstack/` | **KEEP** | flight status (§8 day-of) |
| `google/`, `integrations/`, `flags/`, `audit/`, `supabase/`, `db/`, `state/`, `types/`, `jobs/`, `testing/` | **KEEP** | infra/utilities |

## Components (~40)
**KEEP/REWIRE:** journey-map/*, train-ticket-card, flight-status-card, transport-hub-picker,
place-picker, icons, khonsera-brand, the capture/* set, app-sidebar/mobile-* nav, week-calendar,
ui/* primitives. **REBUILD as named placeholders** (so Design restyles, not restructures):
`ActiveTile, AnchorCard, IntentionCard, GapCard, LegCard, ComparisonMatrix, JourneyListCard,
ModeSwitch, ContactChip, TaskRow, ExpenseRow, NudgeCard, ReadinessPrompt` (map the existing
anchor-card/stopover-card/transition-row into these names). **STRIP:** customer/visit components.

---

## Decisions I need from you (the checkpoint)
1. **Posture:** reshape-in-place (recommended) vs literal greenfield rebuild?
2. **The CRM strip** (`customers`/`customer_sites`/`visit_*`/`saved_trips`/`travel_options`/
   `journey_legs*`/`planning_runs`/`trip_progress` + their pages/components) — confirm these go.
   This is the single biggest deletion; it's a real product shift (field-sales CRM → personal+work
   concierge). I won't touch them without your yes.
3. **Just-built capture UX** (badges/autosuggest/in-text overlay) — KEEP & re-wire (recommended),
   or rebuild as a plain placeholder?
4. **Backend stays Supabase/Postgres** (current) — the handover says "React/TS/SVG" but is silent on
   backend; I recommend keeping Supabase (RLS is how we enforce the privacy boundary cleanly).
5. **Fonts:** code-canonical (Cormorant Garamond + Inter + Satoshi + JetBrains Mono) already settled
   last pass; the brief's "Playfair/Lora" is superseded. Confirm the token manifest stands.

## Once approved — the plan (Steps 3–5)
- **Step 3 (foundation):** Mode + privacy-boundary RLS + role reshape on identity; Journey/Anchor/
  Intention/Gap/Leg/ResourceState model; persistence ("never lose work"). Ugly UI is fine.
- **Step 4:** route skeleton for the screen list, wired to the model, using the named placeholder
  components.
- **Step 5:** salvage — map into Timeline; Trainline parser into Capture; theme tokens flow through.

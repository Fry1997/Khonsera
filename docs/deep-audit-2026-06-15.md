# Deep Audit — Coherence & Correctness Sweep (2026-06-15)

Follow-up to `docs/deep-review-2026-06-15.md`. Connor asked us to "go deeper — check every
function lives where it should, and sense-check every feature against its intention." Seven parallel
audit agents swept the codebase against CLAUDE.md (the intention spec) and the deployed database.
This is the consolidated findings register, ordered by severity, with what's fixed vs. outstanding.

## CRITICAL — fixed this pass

### Personal-mode privacy boundary was breached in the data layer (FIXED, migs 0043–0045)
The most serious finding. Migration 0010 (pre-Mode) created broad `*_member_*` RLS policies keyed
only on `is_workspace_member(workspace_id)` — **no owner check, no mode guard**. Migration 0030
added the correct mode-aware policies but **never dropped the 0010 ones**, and because RLS policies
are PERMISSIVE (OR'd), the broad policy won. The result: **any workspace member could read (and
often modify) a colleague's PERSONAL-mode data** — the exact data breach CLAUDE.md calls out. The
0039 sweep had fixed only `expense_records` SELECT; ~20 other tables were still exposed. Personal
rows confirmed to carry `workspace_id` in production (5 itineraries / 29 stops / 25 transitions),
so the leak was live, not theoretical.

Closed across three migrations, each table given its correct boundary:
- **0043** — core spine: `itineraries`, `stops`, `transitions` (correct companion policies already
  existed → safe drop).
- **0044** — user-scoped private (`calendar_connections`, `captured_inputs`, `intents`,
  `standing_facts`, `travel_profiles`, `gmail_connections`/`gmail_imported_messages` SELECT,
  `gmail_scanned_emails`) → **owner-only**; itinerary-scoped (`booking_intents`,
  `calendar_event_links`, `notification_rules`, `stopovers`) → **can_access_itinerary**; expense
  write-side (`expense_records`, `mileage_expenses`) → owner (+ work-mode member for manager review).
- **0045** — legacy trip tables (`journey_legs` via `transition_id`, `travel_bookings` via
  `booking_intent_id`) → gated through their linked itinerary.

Verified with `get_advisors(security)`: no `_member_*` personal-leak policies remain. Also
reconciled migration-file drift — **0038–0045 existed only in the DB; written back into
`supabase/migrations/`** so the repo is the source of truth again.

## HIGH — fixed / outstanding

- **`contacts` personal-contact leak — FIXED (mig 0046).** `contacts` had a `mode` column but no
  owner column, so the personal contact was workspace-visible. Added `user_id` (backfilled from the
  workspace owner), and gated: personal contacts → owner-only, work contacts → workspace-shared CRM.
  `createContact`/`createContactQuick` now stamp `user_id`.
- **Gate-change nudge false-fired on mock data — FIXED.** Threaded the provider `sample` flag through
  `ParkingInput`/`GateChangeInput` → `Nudge`. The gate rule now **suppresses entirely when sampled**
  (a fabricated gate diff can't honestly signal a change); the parking nudge is **marked `sample`**
  so the surface shows a "· sample" cue instead of a confident alarm. Locked with two new tests.
- **`expense_caps` writes are now manager-gated in RLS — FIXED (mig 0047).** Added an
  `is_workspace_manager()` SECURITY DEFINER helper (manager tier = company_admin/team_manager/owner/
  admin, matching `MANAGER_ROLES`) and gated `expense_caps` writes with it; members keep SELECT. A
  traveller can no longer raise their own per-diem via the REST API.

## MEDIUM — coherence / dead surface

- **Dead "Find & book" — FIXED.** `FlightFinder`/`StayFinder` now read `?find=flight|stay`, open the
  finder, and clear the param. The Readiness button works.
- **Day-divider used UTC — FIXED** (`plan/[id]/page.tsx`). Day key now computed in Europe/London
  (`en-CA`), matching every display formatter, so a late-night stop lands on the right day.
- **`/settings/locations` 404 — FIXED.** The brief's base-location card now links `/locations`.
- **Dead `IntentionCard`** on `/plan/[id]` — rendered behind `intentions`, but nothing writes the
  table, so it never appears (dormant, not a visible malfunction). LEFT as-is: `Intention` is a core
  entity; either build a capture path or drop the reader. Flagged, not ripped out.
- **Orphaned `/compare` stub — FIXED.** Now redirects to `/plan`, matching the orphan-redirect
  convention; the per-leg CompareSheet + FlightFinder are the real comparison surfaces.
- **Stale legacy nav cluster — FIXED (deleted).** `mobile-topbar.tsx`/`mobile-nav.tsx`/`nav-tabs.tsx`
  were a closed, never-mounted cluster referencing the retired `/dashboard`; removed (git preserves).
- **"One Toolkit, Two Views" — FIXED (the real gap) + a documented justified asymmetry.** The
  flight/stay finders + calendar import are plan-only *by architecture* (they need an `itineraryId`;
  the brief is pre-creation), so that asymmetry is legitimate — documented, not a bug. The real gap —
  the plan page's transport-add being thinner than the brief's card — is **closed**: `PlanAdd`'s
  transport now captures changeovers (multi-segment), service/flight number, seat, class/cabin, and
  price, routed through a new `addBookingRun` action that builds the same departure → changeover(s) →
  arrival locked run the brief and Gmail-import produce. A booked train added on the plan page is now
  as rich as one added on the brief.

## Utility consolidation — haversine FIXED; the rest documented as deliberate work

- **`haversine` ×4 → consolidated (FIXED).** All forks used the same 6371 km radius, so routing the
  mileage engine and rail-network through the canonical `haversineMeters` (`geo.ts`) is
  value-preserving — confirmed by the green mileage tests. (`from-stops`'s display-miles variant kept
  its antipode guard; geo is the shared core.)
- **The rest stay documented (NOT a blind sweep), each for a real reason:** the inline `money()`
  copies format **major-unit** amounts while the canonical `formatMoney` takes **minor units** (a
  blind swap = ÷100 bugs); `flight-status-card`'s tz-less formatter needs the **airport's** local
  zone, not a blanket Europe/London (wrong for international flights); the duration "12m"/"12 min"
  split is purely cosmetic. Each wants a deliberate fix (a shared major-unit money formatter; an
  airport-tz lookup), not a mechanical merge.
- **Mock-booked flights show a real "Manage / cancel"** with no "· sample" cue (ManageBookings).
- **Stay free-cancellation deadline computed wrong** (`duffel.ts` `mapStayRates`) — picks the first
  partial-refund window, not the last fully-refundable one (inert behind the Stays 403 today).

## LOW — hygiene (architecture is fundamentally sound)

- **Utility duplication** — `haversine` reimplemented ×4, currency `money()` ×5 (+2 canonical),
  duration formatter ×4 (one renders "12m" vs another "12 min"), time formatter ×4 (one is tz-less
  → wrong zone). Consolidate into `lib/geo.ts`, `lib/types/money.ts`, `lib/types/time.ts`.
- `journey-map/from-stops.ts` is pure domain logic under `components/` (documented, borderline).
- Docs drift: `docs/itinerary-pages.md` still documents the retired `/itineraries/[id]` editor as
  canonical and describes a Gmail scan-cache + marketing filters that aren't actually wired.
- Pre-existing DB advisors: mutable `search_path` on two functions; `http`/`cube`/`earthdistance`
  extensions in `public`; always-true policy on the `_debug_routes_api` debug table; leaked-password
  protection off; internal SECURITY DEFINER helpers callable by `anon` (revoke EXECUTE).

## What the audit confirmed is HEALTHY

The structure is fundamentally sound — the breach was an incomplete cleanup, not a design flaw. The
three live engines are genuinely pure + unit-tested and degrade silently; the Offer→Quote→Booking
vocabulary holds cleanly across flights + stays; provider gating is consistent (no adapter blocks the
build when unkeyed); the Gmail hard-won fixes are intact; the dormant parser is truly unwired; the
HMRC mileage maths is precise and year-effective; FX degrades honestly; approvals are work-only +
manager-gated; the contract components all live in `concierge/`; the tokens-only and serverless iron
rules show no genuine violations; rename works end-to-end; the Trip-tools hierarchy from the first
pass reads coherently.

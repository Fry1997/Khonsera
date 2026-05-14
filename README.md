# Journies

Travel-aware business visit planner. Plan, confirm and execute on-site customer
visits with rail vs drive comparison, partner rail booking, calendar blocks,
expenses and day-of navigation.

## Stack

- Next.js 15 (App Router) + React + TypeScript
- Tailwind CSS
- Supabase (Postgres + Auth + Storage), RLS from day one
- Vercel for hosting

## Architecture spine

```
User
 └── Workspace (personal | organisation)
      ├── Customers / CustomerSites / Contacts
      ├── Locations + TravelProfile
      ├── VisitPlan                 ← the top-level object
      │    ├── PlanningRun
      │    │    └── TravelOption
      │    │         └── JourneyLeg (+ alternatives)
      │    ├── CalendarEventLinks
      │    ├── BookingIntent → TravelBooking
      │    ├── ExpenseRecords (+ MileageExpense)
      │    ├── VisitChecklistItems
      │    └── SavedTrip → TripProgress
      └── NotificationRules
```

`VisitPlan → PlanningRun → TravelOption → JourneyLeg → SavedTrip` is the spine.

## Integration strategy

Every external dependency (calendar, routing, rail timetable, rail booking,
notifications) is behind an interface in `src/lib/integrations/`. Each module
returns `IntegrationResult<T>` in one of three modes:

- `live` — real provider call (none yet)
- `demo` — realistic mock data; only returned when **staff** has demo mode on
- `unavailable` — honest "not connected" state for real users

This means real users always go through real flows with honest gaps, while
staff can flip demo mode to walk the end-to-end product. The toggle is
server-enforced via `profiles.is_staff`.

Feature flags live in `src/lib/features.ts`. Flip to `true` as each integration
lands.

## Local setup

```bash
# Install deps
npm install

# Copy env template and fill in Supabase keys
cp .env.example .env.local

# (Optional) start Supabase locally
npx supabase start
npx supabase db reset      # applies migrations + seed

# Run dev server
npm run dev
```

Make any account `is_staff` from SQL:

```sql
update profiles set is_staff = true where email = 'you@example.com';
```

## Build phases

- **Phase 0** (this PR): bones — Next.js + Supabase + auth + RLS schema + nav + skeleton screens
- **Phase 1**: schema (folded into Phase 0 — every entity exists with RLS)
- **Phase 2**: app shell (done — all 10 screens routed with skeletons)
- **Phase 3**: customers + locations + settings CRUD
- **Phase 4**: visit planning end-to-end with stubbed routing/rail data
- **Phase 5+**: swap stubs for real integrations one at a time

## Project layout

```
src/
  app/
    (auth pages: login, signup, callback)
    (app)/                  authed routes (sidebar nav)
      dashboard/
      visits/ new/ [id]/ [id]/travel-day/ [id]/booking/
      itinerary/
      customers/
      locations/
      expenses/
      settings/
  components/
    ui/                     shared primitives (Button, PageShell, ComingSoon)
  lib/
    supabase/               server, browser, middleware
    integrations/           calendar, routing, rail, booking, notifications
    planning/               pure feasibility engine
    auth.ts                 requireUser, requireUserContext
    demo-mode.ts            staff-only demo toggle
    features.ts             feature flag constants
    types/                  domain types
supabase/
  migrations/0001_init.sql  full schema + RLS + auto-provisioning trigger
  seed.sql
  config.toml
```

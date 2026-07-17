# Khonsera

Khonsera is a travel-day operating system. It brings the plan, appointments, tasks, bookings, tickets, leave-by times, routes, live disruption information and expenses into one continuous day.

The product promise is simple:

> Know what is next, when to leave, how to get there and what you need when you arrive.

## Product shape

The live product is organised around five core surfaces:

- **Today** — the current travel day, projected from every plan covering today.
- **Plan** — create, import and resolve a day or multi-day trip.
- **Wallet** — tickets and travel documents, ordered by when they are needed and available offline.
- **Navigate** — door-to-door navigation for the next movement.
- **Tasks** — actions attached to the day rather than a separate general-purpose task manager.

People/clients, expenses, mileage and settings support that travel-day loop. They are not separate product centres.

See [`docs/product-roadmap.md`](docs/product-roadmap.md) for the current scope and sequencing.

## What is implemented

Khonsera is beyond its original scaffold phase. The repository currently includes:

- authentication, workspaces and row-level security;
- personal and work modes;
- day and multi-day plans with ordered stops and transitions;
- a time-resolution engine and leave-by derivation;
- recurring plans and reminders;
- Google Calendar import and Gmail booking ingestion;
- Trainline email/PDF parsing and ticket materialisation;
- rail and flight booking structures, accommodation and manual transport;
- map rendering, stored polylines and navigation deep links;
- live rail departure/disruption hooks, TfL status and weather;
- offline ticket storage and barcode presentation;
- expenses, mileage, contacts, customers and saved locations;
- staff-only demo fixtures for end-to-end review.

Not every external integration is production-complete. Missing providers must remain explicit and honest rather than silently falling back to fake data for real users.

## Stack

- Next.js 15 App Router, React 19 and TypeScript
- Tailwind CSS plus the current `cc-*` component vocabulary
- Supabase Postgres, Auth and Storage with RLS
- Vercel deployment
- Vitest unit and Supabase integration tests
- MapLibre/PMTiles and provider-backed route data

## Domain spine

The active model is centred on an itinerary/event and its ordered day:

```text
User
└── Workspace
    ├── Travel profile, saved locations, people and clients
    ├── Itinerary (a day or multi-day event)
    │   ├── Intention / purpose
    │   ├── Stops
    │   ├── Transitions
    │   ├── Booked transport and stays
    │   ├── Tickets and documents
    │   ├── Tasks, reminders and recurring rules
    │   └── Expenses and mileage
    └── Connected calendar, Gmail and provider integrations
```

`Itinerary → Stop → Transition` is the operational spine. Today is a projection of that plan, not a separate editable copy.

## Integration principles

External providers are isolated behind actions and integration modules. Follow these rules:

1. Real users receive live provider data or a clear unavailable state.
2. Demo data is staff-only and server enforced.
3. Imported source material retains provenance where possible.
4. Provider failures must not corrupt the underlying plan.
5. A travel day must remain usable offline where the required document was already materialised.

Environment variables are documented in [`.env.example`](.env.example).

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

For a local Supabase stack:

```bash
npx supabase start
npx supabase db reset
npm run db:types
```

## Validation

```bash
npm run typecheck
npm test
npm run build
```

Integration tests require a running Supabase instance and the `SUPABASE_TEST_*` environment variables:

```bash
npm run test:integration
```

Pull requests run the non-database checks in GitHub Actions. Vercel remains the deployment/build status source.

## Working agreements

- Branch from the repository default branch and use a focused pull request.
- Protect the travel-day promise from feature sprawl.
- Prefer shared `cc-*` primitives over one-off page markup.
- Keep Today decisive: one prominent next action, then supporting context.
- Preserve RLS and workspace scoping for every new table or query.
- Add pure tests for planning, time and projection logic.
- Do not commit secrets or service-role credentials.
- Treat older design documents as historical unless they are marked current in the roadmap or design index.

## Repository layout

```text
src/
  app/
    (app)/
      today/             current-day projection
      plan/              itinerary index and detail
      wallet/            tickets and documents
      navigate/          next-movement navigation
      tasks/             day-linked actions
      contacts/          personal people
      customers/         work clients and sites
      expenses/ mileage/ supporting records
      settings/          profile and integrations
  components/
    plan/ today/ wallet/ shared product components
    ui/                  shared primitives
  lib/
    actions/             server actions and data orchestration
    planning/            pure planning/projection logic
    integrations/        provider adapters
    supabase/            browser/server clients
    types/               domain and generated database types
supabase/
  migrations/            schema, functions and RLS
  seed.sql
```

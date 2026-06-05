# Tell Khonsera — Capture Substrate

Reference for the database substrate and fact-type schema registry that the
"Tell Khonsera" natural-language capture feature is built on. Migrations
`0027_tell_khonsera_substrate.sql` and `0028_enable_rls_exposed_tables.sql`.

This substrate is **additive and non-destructive**. The structured-form trip
creation flow (`/itineraries/new`) is unchanged; capture is a new entry point
that writes into the same `stops` / `transitions` / `travel_bookings` tables so
all downstream surfaces render identically. The parser, gap engine, and capture
UI are **not** part of this substrate — they sit on top of it (later build steps).

## One object — the fact — moving through one lifecycle

Every fact carries provenance + lifecycle so the (future) gap engine can decide
which facts to trust silently and which to confirm:

- `confidence` (`high` / `medium` / `low`) — how sure we are.
- `source` (`manual` / `captured` / `parsed_email` / `calendar` / `partner_api` /
  `inferred` / `system`) — how it entered the system.
- `commitment_state` (`raw → sorted → planned → booked → live → done` / `cancelled`)
  — the per-fact lifecycle. **Distinct from the existing `stops.commitment`**
  column (solver hardness: `preferred` / `required`).

These three columns were added to `stops`, `transitions`, and `travel_bookings`.
Defaults (`high` / `manual`; `planned` for stops/transitions, `booked` for
bookings) preserve all existing behaviour — every pre-existing row reads as a
hand-entered, planned fact, so no backfill was needed (beyond marking facts on
completed/cancelled itineraries as `done` / `cancelled`).

## New tables (migration 0027)

| Table | Purpose |
|-------|---------|
| `captured_inputs` | Raw user text + the parser's draft (`parsed_payload` jsonb) before it becomes records. Holds lifecycle (`captured_input_status`) and pointers (`created_stop_ids[]`, `created_transition_ids[]`, `created_booking_ids[]`, `created_itinerary_id`) to whatever was created on confirmation. The evidence trail and parser memory. |
| `standing_facts` | Persistent personal context that isn't a place/contact/trip ("shared car", "Mai home Tue/Thu"). `fact_kind` (open vocab) + `details` jsonb + optional `valid_from`/`valid_to`. |
| `intents` | Held wishes with no date anchor ("check in on parents"). `label` held verbatim; resurfaced via `surface_after` / `last_surfaced_at`. Optionally linked to the `captured_input` that produced it. |

All three are workspace-scoped with RLS via the existing `is_workspace_member(workspace_id)`
helper, four policies each (select/insert/update/delete) — matching every other
workspace-scoped table.

## RLS security fix (migration 0028)

Enabled RLS on four tables the advisor flagged as ERROR-level (anon key could
read/write):

- `gmail_scanned_emails` — user data; workspace-membership policies (matches `gmail_connections`).
- `rail_network_edges`, `rail_named_route_segments` — reference data; **authenticated
  SELECT**, **admin-only writes** (`profiles.is_admin`), mirroring the in-app
  `ctx.isAdmin` gate on `seedRailEdges`/`clearRailNetwork`.
- `rail_route_cache` — derived cache upserted by authenticated server actions on a
  miss; **authenticated select/insert/update**. This carries the same advisor WARN
  (`rls_policy_always_true`) as the pre-existing `route_preview_cache` — accepted:
  it's a shared, non-sensitive cache written by any authenticated user, so writes
  cannot be admin-gated.

## Fact-type schema registry (code, `src/lib/dictionary/`)

The dictionary's Layer-1 concept words ("train", "hotel") instantiate a fact-type
that carries its own slots. Schemas are **reference data in code** (not a DB table)
— version-controlled, code-reviewed, shipped with the app.

- `types.ts` — the model: `SlotTier` (`essential_to_work` / `essential_to_use` /
  `nice_to_have`), `SlotDef` (data type, tier, resolver target, `autoInferFrom` /
  `derivableFrom`, elicitation prompt, db-mapping hint), `FactShape`
  (`dated_event` / `undated_task` / `intent` / `note`), `FactTypeSchema`, and
  `FactTypeRegistry`.
- `fact-types/*.ts` — one module per fact-type. Core travel set:
  `train_journey`, `flight`, `accommodation`, `meeting`, `meal`, `event`. Plus the
  verbatim-hold shapes (`note`, `task`, `intent`) which keep the user's exact words
  and never interpret an unknown subject noun (the §4 tiered-honesty rule — worst
  case is an honest "noted", never a confident wrong guess).
- `registry.ts` — assembles the modules; `getSchema()`, `listSchemas()`,
  `conceptWordIndex()`. Pure, no I/O.
- `registry.test.ts` — invariants (unique names, valid tiers, dated events have an
  essential slot, verbatim shapes don't, concept-word uniqueness).

The gap engine (next build step) computes open questions as **schema slots wanted −
slots filled**, ranked by tier. Slot↔DB mapping is many-to-one: a `train_journey`
fans out across `travel_bookings` + `travel_booking_segments` + locked `transitions`
+ transit `stops` — see each module's `targets` and `dbMapping` hints.

### Adding a fact-type
Add a module under `src/lib/dictionary/fact-types/`, register it in `registry.ts`.
The brief's wider list (~17 types: bus/coach, taxi, ferry, tube, car_hire, parking,
real-world-action, …) is added the same way — marked `TODO(dictionary)` in
`registry.ts`.

## Regenerating types
After any migration: `npm run db:types` (local) or the Supabase MCP
`generate_typescript_types` for project `attbfwemjoslugvtfbrt`, writing
`src/lib/types/database.ts` (do not hand-edit). The curated subset enums live in
`src/lib/types/domain.ts`.

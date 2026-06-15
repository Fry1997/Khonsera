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

## HIGH — outstanding (needs a decision or a follow-up change)

- **`contacts` personal-contact leak — needs a schema change.** `contacts` has a `mode` column but
  **no `user_id`**; the one personal contact in prod is workspace-visible with no owner column to
  scope it. Fix requires adding an owner column (`user_id`) + an owner-or-work-member policy. Not a
  blind one-liner — flagged for design.
- **Gate-change nudge false-fires on mock data** (`src/lib/integrations/aerodatabox.ts` +
  `src/lib/actions/context.ts:104`). With `AERODATABOX_KEY` unset it invents a gate and diffs it
  against the plan's real gate → a confident "Gate changed" alarm on fiction. Violates the
  provider-gating "no false alarm" rule. The `sample` flag is dropped before reaching the nudge.
  Parking nudge has the same class at lower stakes. Fix: thread `sample` through and suppress/soften
  the nudge when the signal is sampled.
- **`expense_caps` writes aren't manager-gated in RLS** (only app-layer). A traveller could raise
  their own per-diem cap via the REST API directly. Needs an `is_workspace_manager()` helper + a
  manager-gated write policy.

## MEDIUM — coherence / dead surface (Code, mostly quick)

- **Dead `IntentionCard`** on `/plan/[id]` — rendered behind `intentions`, but **nothing writes the
  `intentions` table** (no create path). Either build an intention-capture affordance or drop the
  reader+card until that stage.
- **Dead "Find & book"** — Readiness's button pushes `?find=flight|stay` but neither finder reads
  the param, so it silently does nothing. Fix: have the finders open on the param.
- **"One Toolkit, Two Views" broken both ways** — plan-page transport-add is thinner than the
  brief's (no changeover/seat/price); the flight/stay finders + calendar import exist only on the
  plan page, not the brief. The standing principle says they must match.
- **Two dead routes** — `/settings/locations` (linked from the brief's base card → 404; should be
  `/locations`) and an orphaned `/compare` stub (superseded by FlightFinder; should redirect).
- **Day-divider uses UTC** (`plan/[id]/page.tsx:393`) while every display uses Europe/London — a
  late-night stop can land on the wrong day. The exact UTC-vs-London class CLAUDE.md keeps flagging.
- **Stale legacy nav cluster** (`mobile-topbar.tsx`/`mobile-nav.tsx`/`nav-tabs.tsx`) — never
  mounted, references the retired `/dashboard`. Delete or mark superseded.
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

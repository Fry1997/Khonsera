# DECISIONS.md — Foundation Pass

Running log of assumptions and technical calls made autonomously under the Standing Orders
("decide and proceed"). Surfaced at the end of the pass instead of interrupting the build.
Newest at the bottom of each section.

## Posture (resolves the triage checkpoint)
- **D1 — Reshape-in-place, not greenfield.** Identity (`workspaces`/`memberships`/`profiles`) and
  the journey spine (`itineraries`/`stops`/`transitions`) exist and are tested; rebuilding from
  scratch would discard working engines and re-introduce fixed bugs. The genuinely-foundational
  work is (a) Work/Personal **Mode** + the privacy boundary, and (b) promoting **Intention/Gap/
  ResourceState** to first-class. Everything else is KEEP / REWIRE / STRIP per
  `docs/foundation-rebuild-triage.md`.
- **D2 — Keep Next.js App Router.** Standing Orders lock "React + TypeScript, standard router";
  the existing App Router satisfies this. Switching frameworks would be gratuitous churn.
- **D3 — Keep Supabase + anon-key/RLS client** (locked default). The privacy boundary is enforced
  in the data layer via RLS, exactly as the spec demands.
- **D4 — Fonts stay code-canonical** (Cormorant Garamond + Inter + Satoshi + JetBrains Mono). The
  Kickoff Brief's "Playfair Display, Lora" is superseded by the token manifest settled last pass.

## Data model
- **D5 — `mode` is a column, not a separate tenancy axis.** Added `app_mode` enum ('work'|'personal')
  to `itineraries`, `contacts`, `expense_records`, and new `tasks`. Personal-mode rows are visible
  to the owner only; work-mode rows to the owner + active workspace members. Backfilled
  `itineraries.mode` from `workspaces.type` ('organisation' → work).
- **D6 — RLS turned ON for the journey core.** `itineraries`/`stops`/`transitions` previously had
  NO row-level security (app-level scoping only — a latent breach risk the spec flags). This pass
  enables RLS with a `can_access_itinerary()` helper enforcing the §2 boundary. This is additive
  and owner-permissive, so it does not restrict any legitimate existing access.
- **D7 — Spec roles added additively.** `membership_role` gains `company_admin`/`team_manager`/
  `traveller` alongside legacy `owner`/`admin`/`member`/`viewer` (mapping: owner→company_admin,
  admin→team_manager, member/viewer→traveller). Legacy values retained to avoid breaking existing
  rows; the app reads via a mapping helper.
- **D8 — New first-class tables:** `intentions` (+`intention_anchors` link), `gaps`,
  `resource_states`, `tasks` — per handover §4.4/4.5/4.7/4.9.

## Deferred / blocking (needs an explicit nod — NOT done this pass)
- **B1 — Dropping the legacy CRM tables is the one irreversible step I will not take unsupervised.**
  `customers`, `customer_sites`, `visit_plans`, `visit_checklist_items`, `visit_status_edges`,
  `saved_trips`, `saved_trip_edges`, `travel_options`, `journey_legs`, `journey_leg_alternatives`,
  `planning_runs`, `trip_progress` and their routes/components are STRIP candidates (see triage),
  but they may hold real data. The code routes are removed (reversible via git); the **tables are
  left intact** until you confirm. No data lost.

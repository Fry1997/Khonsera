# Native-readiness audit — sharing one backend across web + iOS + Android

Last updated: 2026-06-28 · Companion to `docs/native-map-strategy.md` (maps) and
DECISIONS.md D104. The product is going **true-native** (Swift iOS + Kotlin
Android) **+ web desktop**.

## The one idea that kills the sync pain
**You do not keep three apps in sync. You keep one backend + one contract, and
the three clients are thin renderers.** Drift only happens when *business logic*
gets re-implemented per platform. So the whole job is: push logic **down** into
a shared backend, generate the **contract**, and let each UI be natively
idiomatic. The thinner the clients, the less there is to ever sync.

## The 5 layers (and where sync risk lives)
| Layer | Who owns it | Shared? | Sync risk |
|------|-------------|---------|-----------|
| **1. Data** — Postgres + **RLS** + Auth (Supabase) | one DB | ✅ already shared | none — RLS is the security model |
| **2. Logic** — solver, parser, ranking, materialisation… | **Supabase Edge Functions** (Deno/TS) | ✅ once moved | none — logic lives once, all clients call it |
| **3. Integrations** — Google/Duffel/Darwin/Valhalla… (secrets) | server only (Edge Functions / API routes) | ✅ | none — secrets never ship to a client |
| **4. Contract** — generated DB types + function I/O + **design tokens** | generated artifacts | ✅ | a schema change → **compile error** in every client, not silent drift |
| **5. UI** — React (web) · SwiftUI · Compose | per platform | ❌ **by design** | none — you never sync a view; feature parity is a *product* choice |

## What the audit found (the numbers)

### Already native-ready ✅
- **Supabase is the shared backbone.** Browsers never query Supabase directly
  today — but they don't have to: **RLS is the enforcement layer**
  (`is_workspace_member()`, `can_access_itinerary()`, migration 0030). A native
  client with a valid Supabase JWT hitting the same tables is protected
  *identically*. The personal-vs-work privacy boundary lives in RLS, not app
  code — so it travels untouched. **Native does plain CRUD directly via the
  Supabase Swift/Kotlin SDKs, day one, safely.**
- **Auth is portable.** `requireUserContext()` (`src/lib/auth.ts`) is derivable
  from a Supabase session + reads of `profiles`/`workspaces`/`memberships` →
  same on native via the Supabase SDKs.
- **~60% of the ~130 server actions are pure CRUD** (39 files,
  `src/lib/actions/*`) — native gets these "for free" against Supabase; nothing
  to port.
- **The ~15 pure logic engines are 100% portable Deno/TS, no framework deps:**
  parser (`src/lib/parser/*`), solver (`src/lib/itinerary/solver.ts`), planning/
  ranking (`src/lib/planning/*`), nav guidance (`src/lib/nav/*`), recovery, live,
  context, readiness, mileage, geo, tickets, dictionary, today. These are the
  crown jewels and run in Edge Functions **unchanged**.
- **11 HTTP API routes already exist** (`src/app/api/**`: basemap, barcode,
  maps/places, darwin, OAuth) — platform-agnostic, reusable by native as-is.

### The gaps to close 🔧
1. **~30% LOGIC + ~10% INTEGRATION actions are web-only RPC** (Next.js "use
   server"). These (e.g. `attach*BookingToStop`, `createItineraryFromBrief`,
   `resolveItineraryTimes`, `plan-edit.ts`'s `addManualAnchor`/`compareLeg`,
   `gmail.scanGmailForBookings`, `connections.*` Duffel) wrap the pure engines +
   DB writes + integrations. **They must move to Supabase Edge Functions** so web
   and native call one implementation. (Next coupling is *thin* —
   `revalidatePath`/`cookies()`/`redirect()`/`cache()` — strip per function.)
2. **No Edge Functions exist yet** (`supabase/functions/` absent). That's the new
   home for Layer 2 + 3.
3. **No machine-readable design tokens.** Tokens live only as CSS vars
   (`globals.css` / `docs/design-tokens.md`) — no JSON. Native needs a
   **`tokens.json`** exported from the canonical source, consumed by web CSS +
   generated iOS/Android token files. (The Design↔Code protocol already treats
   tokens as the lingua franca; this just makes them portable.)
4. **Integration secrets** (Google, Duffel `DUFFEL_API_TOKEN`, Darwin, TfL,
   AviationStack, DragonPass, Parkopedia, AeroDataBox, Valhalla, Photon) **can
   never be in a native client** → they stay behind Edge Functions / API routes.
5. **OAuth needs native handling.** Gmail/Google connect/callback routes assume
   web redirects → add native **deep-link** redirect handling.

## Migration sequence (incremental — not a big bang)
You do **not** port all 130 functions before native. Native MVP works on Layer 1
(Supabase CRUD) + a handful of Edge Functions. Order:

1. **Carve a clean shared-logic boundary (web repo, now):** ensure the pure
   engines import **no** Next.js APIs (they're already pure — just enforce it),
   so they lift into Deno verbatim. Low risk, high value.
2. **Stand up Supabase Edge Functions** for the LOGIC/INTEGRATION the native MVP
   needs first — likely: `resolveItineraryTimes`/solver, `plan-edit` core
   (`addManualAnchor`, `compareLeg`, `removeStop`), nav routing
   (`fetchNavRoute`), and auth-adjacent reads. Web switches those calls to the
   Edge Functions (proves the shared path before native exists).
3. **Publish the contract:** keep `database.ts` generated (`npm run db:types`);
   add an Edge-Function I/O type package; add **`tokens.json`** + an export step.
4. **Native OAuth** deep-links for Gmail/Google.
5. **Native spike** (Swift): Supabase sign-in → load a journey via direct CRUD →
   call one Edge Function (the solver) → render on **Mapbox Standard** cotton.
   Proves auth + data + shared logic + the map in one slice.
6. **Build native** for real, porting further Edge Functions as features land.

## How sync stays painless, forever (governance)
- **One logic home.** A function lives in exactly one place (an Edge Function).
  Clients call it; they never re-implement it. This is the rule that prevents
  three-way drift.
- **Generated contract.** Types come from the DB schema + function signatures →
  a schema change surfaces as a **compile error** in web *and* native, not a
  silent bug. Same for `tokens.json` → if a token moves, every client's
  generated theme fails to build until updated.
- **Versioned APIs.** Edge Functions/API are versioned so an older app store
  build keeps working while web ships ahead.
- **Feature parity is a product decision, not a maintenance treadmill.** Native
  can lag a web feature; the contract stays stable, so lagging costs nothing.
- **Design tokens never fork** (existing iron rule) — now enforced across
  platforms via the single `tokens.json`.

## Honest effort / risk
- The real work is **porting LOGIC/INTEGRATION actions to Edge Functions**
  (~40% of ~130 functions) — but the *hard* part (the pure engines) ports
  unchanged; the wrappers are mostly DB writes + a strip of Next coupling.
- **Deno runtime check:** the pure engines are plain TS (fine in Deno); watch
  Node-specific deps (e.g. `bwip-js` for barcodes, `unpdf` for Gmail PDFs) —
  those stay in API routes or get Deno-compatible equivalents.
- **`tokens.json` export** is small but new; wire it so web keeps using the same
  values (no visual change) while native gains a source.
- **Don't over-build ahead of need:** Layer 1 + the MVP's Edge Functions are
  enough to ship a native spike; the rest follows feature-by-feature.

## What does NOT change in this web repo now
This audit is a roadmap; it doesn't refactor the web app today. Web keeps its
Server Actions and MapLibre map. The first *code* steps (engine boundary, first
Edge Functions, `tokens.json`) are separate, scheduled pieces — each small,
verifiable, and shippable on their own.

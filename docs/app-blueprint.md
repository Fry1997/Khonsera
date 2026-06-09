# Khonsera — App Blueprint (the single source for Code ↔ Design)

**Status: PROPOSAL for sign-off.** This is the artifact that fixes the handoff: one place that
describes the *actual* app, the *one* app we're collapsing to, and the screen-by-screen briefs Design
works from. Nothing here is built yet — it's for you + Design to react to first.

Decisions taken (this turn): **planning = unify both methods into one new flow**; **process =
blueprint first, then build**.

---

## 1. Why the app feels "weird and inconsistent" (the diagnosis)

The app is **two products spliced together**, both reachable from the same nav:

- **Legacy (pre-rebuild):** `dashboard` ("Build my day" hero), `itineraries/new` (a 1,421-line
  "Build my day" brief form), `itineraries/[id]` (heavy editor), `bookings`, `flights`, `customers`,
  `locations`.
- **New concierge (foundation pass):** `today`, `itineraries/[id]/timeline`, `tasks`, `contacts`,
  `compare`, `workspace`.

We built the new spine **alongside** the old one and stopped at a "navigable plateau" — we never did
the foundation brief's **strip** step. So both planners exist, the sidebar lists 12 items from both
eras, the Edition II skin only re-paints the *legacy* atom classes (so the new screens are half-
skinned), and the legacy screens are desktop-first (the mobile breakage). **This is structural, not a
styling miss** — no amount of re-skinning fixes a two-generations app.

---

## 2. Current-state inventory (every route, real state)

Verdict legend: **KEEP** (as-is, light touch) · **MERGE** (fold into the unified planner) ·
**STRIP** (remove as a standalone) · **REDESIGN** (keep concept, new screen on the spine).

| Route | Era | What it is | Data | Mobile | Verdict |
|-------|-----|-----------|------|--------|---------|
| `dashboard` ("Home") | legacy | "Build my day" hero + stats + week calendar | live | ✗ desktop grid | **REDESIGN** → fold into **Today** |
| `today` | new | Day-of ActiveTile + chain | live | ✓ | **KEEP** (becomes the home) |
| `itineraries` | legacy-ish | Journeys list (editorial rows) | live | ~ | **REDESIGN** → **Journeys** on the spine |
| `itineraries/new` | legacy | **1,421-line "Build my day" brief form** (the weird one) | live | ✗ two-col, breaks | **MERGE** → the unified planner |
| `itineraries/[id]` | legacy | Heavy editor (290 kB) | live | ~ | **MERGE** → the unified planner |
| `itineraries/[id]/timeline` | new | Timeline view (contract cards) | live | ✓ | **REDESIGN** → *becomes* the planner (display **and** input) |
| `capture` (+`/drafts`) | new | "Tell Khonsera" NL capture | live | ✓ | **MERGE** → the planner's fast-entry mode |
| `compare` | new | ComparisonMatrix (decision layer) | stub | ✓ | **MERGE** → inline gap-resolution on the timeline |
| `bookings` | legacy | Bookings wallet | live | ~ | **MERGE** → a "wallet" panel within a journey |
| `flights` | legacy | Flight status list | live | ~ | **MERGE** → flight anchors on the timeline |
| `locations` | legacy | Saved places manager | live | ✗ desktop grid | **STRIP** → Settings (home/base) + place-picker |
| `customers` (+`/[id]`,`/new`) | legacy | Lightweight CRM (you want this kept) | live | ~ | **KEEP** but reposition → work-mode "Clients", out of the traveller nav |
| `contacts` | new | ContactChip list | live | ✓ | **KEEP** (People) |
| `tasks` | new | Task CRUD | live | ✓ | **KEEP** |
| `expenses` | legacy-ish | Expense ledger | live | ~ | **KEEP** (light redesign) |
| `workspace` | new | Teams/admin stub (work mode) | live | ✓ | **KEEP** |
| `settings` (+`/rail-network`) | legacy | Settings + admin | live | ~ | **KEEP** (light redesign; absorb home/base + locations) |

---

## 3. The target: ONE app

### 3a. The unified planner (the core decision — "unify into one flow")
**One surface = the Timeline, which is both display and input** (handover §5; CLAUDE.md "One Toolkit,
Two Views" taken to its conclusion). It replaces the brief form, the heavy editor, *and* the separate
timeline view:

- **Enter** a journey two ways, both landing on the same Timeline: **"Tell Khonsera"** (natural
  language → parsed onto the timeline) or **"New journey"** (blank timeline). No separate 1,400-line
  form.
- **Build on the timeline.** The brief's whole toolkit lives **inline, where each piece belongs**:
  add an anchor, add a transport/accommodation booking (the existing cards, inline between anchors),
  import from Gmail, set an intention. Questions appear at the exact point in the sequence they
  apply.
- **"Build my day" becomes an action, not a screen** — a "resolve the day" / compute-times control on
  the timeline that runs the solver and fills gaps, surfacing the ComparisonMatrix inline when a gap
  needs a decision.
- **Result:** capture → timeline → day-of (Today) is one continuous spine. No mode-switch between
  "planning screen" and "view screen".

### 3b. One nav (12 → 6, mode-aware)
Traveller (both modes): **Today** · **Journeys** · **People** · **Tasks** · **Expenses** ·
**Settings**. Work mode adds **Workspace** (and, if kept, **Clients**). **"Tell"** stays the global
action; **"New journey"** lands on the planner.
Removed from nav (folded in): Home/dashboard→Today · Bookings/Flights→inside a journey ·
Locations→Settings · Compare→inline · Customers→work-mode Clients.

### 3c. What happens to each piece
- **STRIP** (delete code): `itineraries/new` brief form, the heavy `itineraries/[id]` editor,
  `locations` page, `bookings`/`flights` as standalone pages, `compare` as a standalone page,
  `dashboard` as a standalone. *(Their capabilities move onto the planner / Today — nothing is lost,
  it's relocated.)*
- **KEEP** (engines, reused by the planner): the Gmail/Trainline parser, the transport/accommodation
  **booking cards**, the **solver**, the **map**, the capture parser, the contract components.
- **KEEP** (features): contacts→People, tasks, expenses, workspace, the customers/visits CRM
  (repositioned to work-mode Clients).

---

## 4. Mobile-first posture (non-negotiable, applies to every screen)
The product is a phone-first concierge. Rules for every screen:
- **Single column by default**; multi-column only as a `lg:` enhancement, never the base.
- No fixed-width `gridTemplateColumns` as the base layout (the current dashboard/new-form sin).
- The sticky action bar sits above the mobile tab bar (already a known fix).
- Touch targets ≥ 44px; the timeline rail and cards reflow vertically.
- Every screen spec below must show a **mobile** state, not just desktop.

---

## 5. Per-screen design briefs (what Design designs, screen-by-screen)
Each priority screen, with the contract components it composes and the **states** to design
(including empty + mobile). Design returns one screen at a time; Code implements; we screenshot the
**live** result and Design reacts to the real thing.

**P1 · Planner (the unified Timeline)** — *the hero, do first.*
Components: `AnchorCard`, `LegCard`, `GapCard`, `IntentionCard`, the inline booking cards,
`ComparisonMatrix` (inline on gap-resolve), the rail. Entry: Tell (NL) + New (blank).
States: blank/new · sparse (1 anchor) · full booked day · day-with-gaps · resolving-a-gap ·
importing-from-email · mobile (rail + cards stacked, inline tools as sheets).

**P1 · Today** — the day-of home. Components: `ActiveTile`, `AnchorCard`, `NudgeCard`,
`ReadinessPrompt`. States: calm · imminent · live · disruption · nothing-today · mobile.

**P2 · Journeys (list)** — `JourneyListCard`. States: list · empty · mobile · (work vs personal).

**P2 · People / Tasks / Expenses** — `ContactChip` / `TaskRow` / `ExpenseRow`. States: list ·
empty · add · mobile.

**P3 · Settings · Workspace · Clients(work)** — forms + stubs. States: default · empty · mobile.

---

## 6. The Code ↔ Design loop (the process fix)
What went wrong: the design brief was scoped to a **brand book + 2 idealised hero screens**, while an
**unfinished migration** sat underneath — so Design skinned atoms it could see and never touched the
real screens/flows/mobile. The fix:

1. **This blueprint is the single source.** Both sides work from it; it lists the *real* screens and
   the *one* target app. It's versioned in-repo.
2. **Product shape is decided before pixels** (done here: unify; one nav; strip legacy).
3. **Design works against real screens with real states**, screen-by-screen (the P1→P3 order),
   returning **per-screen specs** (layout + the contract component names + every state incl. mobile)
   — not a global token override and not idealised one-offs.
4. **Tight loop with live proof:** Design delivers a screen → Code implements on the real data →
   Code screenshots the **live** screen (desktop + mobile) → Design reacts to that, not to a mockup.
   No more designing in the abstract.
5. **Tokens stay the contract** (`docs/design-tokens.md`); component **names** stay the contract
   (`src/components/concierge/`). Design changes the look by swapping token values + per-component
   rules, never by restructuring.

---

## 7. Build order once signed off
1. **Collapse the spine:** make the Timeline the one planner (fold capture entry + booking tools +
   solver action onto it); land "New journey"/"Tell" there.
2. **Strip** the legacy standalones (brief form, heavy editor, locations, bookings/flights/compare/
   dashboard pages) once their capabilities are on the planner.
3. **One nav**, mobile-first, all screens on Edition II tokens (incl. the concierge screens the
   override doesn't currently reach).
4. **Design P1 screens** (Planner, Today) for real → implement → screenshot → iterate. Then P2, P3.

> Open question for you/Design before build: confirm the **6-item nav** and that **Clients/Customers**
> moves to a work-mode section rather than the main nav. Everything else follows from §3.

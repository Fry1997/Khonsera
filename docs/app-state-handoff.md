# Khonsera — App State Handoff

*A review snapshot: where the app is vs the briefs, and the open decisions. Branch
`claude/khonsera-build-brief-An4oz` @ `d79c3c7`. Build green · tsc clean · 204 tests passing.*

---

## 1. In one paragraph (plain)

Khonsera now has a **real public front door** (marketing + waitlist, app gated behind login), a
**brand system** (Edition II) applied across the shell and core screens, and a **genuinely working
planner**: you can tell it a fact in plain words *or* add one with a form, it lands on a time-ordered
spine, you can edit an anchor's arrive/duration/leave with different "kinds", tap a leg to compare
travel options ranked by real door-to-door time, set constraints ("no flights", "home by 23:00"),
and it flags tight connections. Booked train tickets render as **real scannable barcodes** in a
**Wallet** and a fullscreen **ScanView**, and **Today** is a live *projection* of that same plan.
What's *not* done: showing a booked ticket as a "pass" docked on the plan timeline, reacting to live
delays, and email forward-to-import — each blocked on a schema add or external infrastructure, not on
effort (details in §6).

## 2. The two briefs, at a glance

| Brief | State |
|---|---|
| **Landing + Waitlist** (`landingwaitlistbrief.md`) | **Done.** Built, Design-elevated (Round 3), live. |
| **Planner Master** (`khonseraplannermasterbrief.md`) | **Substantially wired.** 6 of 9 "done-when" met; the document family + Wallet are designed (Round 5) and on real data. 3 items blocked on infra/schema (§6). |

## 3. The Design↔Code relay — where it stands

Code starts each chain, Design elevates, you ferry the packs.

| Round | Surface | State |
|---|---|---|
| R1 | Planner spine cards, Today, bottom nav | Designed + adopted |
| R2 | App shell, secondary screens | Designed + adopted |
| R3 | **Landing / waitlist** | Designed + adopted |
| R4 | (auth/login) | Designed + adopted earlier |
| R5 | **Booked-document family + Wallet** (`TicketCard`/`StatusStrip`/`BarcodePresenter`/`ScanView` + the first-class `Pass`) | Designed + adopted |
| **Next** | The **new planner editing surfaces** (variable editor sheet, comparison sheet, constraints, manual-add) are **Code-built on tokens, not yet Design-elevated** | **A good candidate for a screenshot round** |

## 4. Surface map — what each screen is today

**Two generations still coexist.** The new concierge surfaces are the product direction; several
legacy screens still exist and run but are slated to be **stripped once parity is reached** (the
"parity-before-strip" rule).

### Primary product surfaces (new, real)
| Route | What it is | State |
|---|---|---|
| `/` | Public marketing + waitlist + discreet Log in | **Real**, Design-elevated |
| `/today` | Day-of surface — **pure projection** of the plan (4 engine-selected states), promotes the next document → ScanView | **Real**, wired |
| `/plan` | The single planner: spine + plain-language capture + manual add + anchor editing + leg comparison + constraints + at-risk | **Real**, wired (Code-styled editing sheets) |
| `/wallet` | Document-centric stack of booked passes, grouped by day / time-needed, offline barcodes, opens ScanView | **Real**, on real booking data |
| `/tasks` · `/contacts` · `/expenses` · `/workspace` | Mode-scoped secondary screens | Real data, lighter craft |
| `/welcome` | First-run fork | Real |
| `login`/`signup`/`forgot`/`reset` | Auth (Midnight Threshold) | Real, Design-elevated |

### Legacy surfaces (still present, pre-strip)
`/dashboard`, `/itineraries`, `/itineraries/[id]` (planning editor), `/itineraries/new` (brief),
`/itineraries/[id]/timeline`, `/bookings`, `/flights`, `/customers*`, `/locations`, `/compare`,
`/capture`, `/settings` (kept functional — Gmail/calendar/palette). These are the **older build**;
they work but are not the concierge direction. **Strip candidates** once `/plan` reaches full parity.

## 5. Planner "done-when" scorecard (§12 of the master brief)

| # | Criterion | State |
|---|---|---|
| 1 | A fact (plain-language **or** manual add) lands by time + recomputes legs | ✅ |
| 2 | An anchor's three variables edit, derive, harden through the kinds | ✅ |
| 3 | A leg ranks fastest-first door-to-door, exclusions filter, commits, hardens | ✅ |
| 4 | A booked rail leg opens a full TicketCard with a scannable Aztec in ScanView | ✅ (from Wallet + Today) |
| 5 | A forwarded confirmation imports as a draft → joins the plan | ⛔ infra (inbound email) |
| 6 | The Wallet lists bookings grouped by date / time-needed, barcodes open offline | ✅ |
| 7 | A live delay perturbs the plan, flips a leg at-risk, surfaces an intervention | ⛔ infra (no live feed); at-risk *detection* ✅ |
| 8 | Today renders as a projection and re-projects after every change | ✅ |
| — | Five planner states + four Today states render | ✅ (states wired; visual polish is a Design pass) |

## 6. The three remaining items — why blocked, and the fix

1. **Docked pass on the spine** (`.cc-pass--docked`, brief §6.2/§8). *CSS + `Pass` component ready.*
   Blocked because a booked journey is stored as departure→changeover→arrival **stops** and nothing
   records which stop-span a `travel_booking` covers. **Fix:** add `booking_intents.arrival_stop_id`
   (small migration) + populate it in `createItineraryFromBrief` (a large, critical function — touch
   carefully) + collapse the span into the docked pass on `/plan`. *Doable next; needs the schema add.*
2. **Reactive recompute on live signals** (§3.9/§8.2). The recompute→consequence→`NudgeCard`
   mechanism is buildable, but **there is no live rail/TfL feed** wired here to exercise it. **Fix:**
   wire a signal source, or build the mechanism behind a deliberate "simulate delay" test harness now.
3. **Email forward-to-import** (§4.3, P1.5). Parsers exist; **inbound email (address + webhook) is
   external infra** not provisioned. **Fix:** pick a service (e.g. an inbound-email provider), then
   it's mostly parser reuse.

## 7. Engine + data wiring (technical)

- **Data model:** `itineraries` → `stops` (+`metadata` carrying variable *kinds*, timing mode,
  barcode refs) → `transitions` (`is_locked`, `computed_duration_minutes`). Booked docs in
  `travel_bookings` + `travel_booking_segments` (operator/seat/coach/ticket_type/platform/**barcode_data**).
  `intentions`, `gaps`, `standing_facts` (constraints), `waitlist` (0033).
- **Engine (`src/lib/planning`)**: `door-to-door.ts` (`rankByDoorToDoor`/`topViable`/
  `doorToDoorMinutes`/`connectionBufferMinutes`/`isExcluded`), `spine.ts` (`insertByTime`/`orderByTime`),
  `today.ts` (`projectToday`, the Today state machine — unit-tested), `feasibility/check.ts`
  (`checkLegFeasibility` → ok/tight/late, drives at-risk). The solver (`resolveItineraryTimes`) runs
  after every mutation.
- **Planner actions (`src/lib/actions/plan-edit.ts`)**: `setAnchorVariable`, `compareLeg`/`chooseLeg`/
  `createLeg`, `addManualAnchor`. Constraints: `src/lib/actions/constraints.ts`. Wallet data:
  `src/lib/actions/wallet.ts` (`loadWalletTickets`/`loadJourneyTickets`).
- **Barcodes:** `BarcodePresenter` generates real Aztec/PDF417/QR client-side via **bwip-js** into a
  canvas (offline-capable from the cached payload). The whites are literal `#fff` (never themed) so a
  gate reader always reads them.
- **Styling:** additive Edition II layers, **globals.css untouched**; import order globals → brand →
  screens → shell → landing → documents → wallet. Components style by `.cc-*` + `data-*`.

## 8. Known caveats / debt

- **Time zones:** anchor time edits use a loose local→ISO conversion (matching existing codebase
  behaviour). Proper workspace-tz handling is a follow-up.
- **Legacy not stripped:** two UI generations coexist (see §4) — a deliberate parity-before-strip.
- **Recurring stale-clone:** the cloud container occasionally re-clones at an old commit; recovered
  every time by resetting to origin (work is always safe on the branch). Worth fixing in env config.
- **`/wallet?demo=1`** (staff) renders design fixtures; the product path shows real bookings.

## 9. Suggested next steps (decision points for you)

1. **Screenshot round to Design** for the new planner editing surfaces (variable editor, comparison
   sheet, constraints, manual-add) — they're Code-styled on tokens but not yet elevated. *Lowest risk,
   high polish payoff.*
2. **Docked pass on the spine** — say the word and I'll add `booking_intents.arrival_stop_id` + wire it
   (the one remaining high-visual-payoff item; I'll re-test the brief + Gmail flows after).
3. **Reactive engine behind a test harness** — build the recompute→NudgeCard loop now, ready for a
   real feed later.
4. **Begin the legacy strip** — once you're happy `/plan` + `/today` cover the old `/itineraries`
   flow, retire the old screens.
5. **Forward-to-import** — pick an inbound-email provider and I'll wire the parser path.

# Functional Integrity Review — why the app feels broken

*Code-traced, 2026-06-10, branch @ `09625f0`. Every symptom you hit, mapped to its exact cause,
plus what my previous handoff overclaimed, and the repair programme.*

---

## Verdict, plainly

You're right, and the app-state handoff I gave you was too generous. The new planner surfaces are
individually real, but they were **never joined into one coherent product**: the capture flow still
exits into the legacy app, the new planner is a single-journey window with no way to choose a day,
your real tickets are stored somewhere the new Wallet never looks (and the Wallet isn't linked from
anywhere), and the journey lifecycle (planning → planned) is only operable from a legacy page — so
Today can never go live for a trip you make in the new UI. **No data has been lost** — your Trainline
tickets, barcodes included, are intact in the database. The failures are wiring and navigation, and
they are all fixable. But several of my "done-when met" claims were true only on demo fixtures, not
on your real data, and I'm correcting that here.

---

## 1. Each thing you hit, traced

### 1a. "Adding a new fact renders you onto the old page" — CONFIRMED
The sidebar's gold **Tell Khonsera** button goes to `/capture` (the capture screen). On confirm,
`capture-screen.tsx:166` does `router.push("/itineraries/[id]")` — **the legacy planning editor**.
Its fallback is `router.push("/dashboard")` — also legacy. From there the chain is all legacy: the
editor's "← All itineraries" breadcrumb → the old trips list → its "+ New itinerary" → the old brief
("Plan your day"). That is exactly the sequence in your screenshots. **The new app's primary capture
action exits into the old app.**

### 1b. "A fact on a different day just vanishes / Plan drops me into the existing plan" — CONFIRMED
Two compounding causes:
- `captureOnPlan` (the capture bar on `/plan`) **creates a brand-new itinerary every time** — it
  never appends to the journey you're looking at. (My own code comment flags this as "the follow-up
  slice"; it was never built.)
- `/plan` shows **one journey only**: the nearest with `date_end >= today`, hard-limited to 1, with
  **no day/journey switcher**. So your other-day fact created a separate itinerary that `/plan`
  silently never shows. Your live data shows the orphans: untitled and near-empty itineraries on
  Jun 6/7/9 sitting invisible behind the Jun 11 TEST trip.

### 1c. "Today had nothing to set" — CONFIRMED, and worse than it looks
Today's query requires `status IN ('planned','in_progress')`. **Every one of your trips is status
`planning`.** The only way to advance a trip to `planned` is the **"Advance to planned" button on the
legacy editor**. So a user living in the new UI can *never* make Today go live. Today then shows its
empty state, whose CTA drops you into `/plan` — which shows whatever single journey it picked, not
the day you meant. The lifecycle is stranded in the legacy app.

### 1d. "My tickets no longer render as a train card with the QR" — CONFIRMED (wrong data source)
The important part first: **your tickets are intact.** The Jun 25 Dancing Duck trip carries the full
East Midlands Railway booking (ref MC287441) as `transit_departure → changeover → arrival` stops,
**with the 233-char Aztec barcode payloads stored on the stops' metadata — outbound and return.**
What's broken is where the new code looks:
- The new Wallet (`loadWalletTickets`) reads `travel_bookings` + `travel_booking_segments` via
  `booking_intents`. In your live DB that path contains **two demo rows with zero barcodes** —
  the Gmail-import path that built your real trip wrote the ticket data onto the **stops**, and
  created no booking rows. So the Wallet is empty of your real tickets *by construction*.
- The **Wallet has no navigation entry anywhere** — it was built as a "secondary surface reached
  from Today's document area / a menu", but neither link was ever added. It's reachable only by
  typing `/wallet`.
- On `/plan`, a booked rail span renders as a plain LegCard, not a ticket — the "docked pass" was
  the item I'd flagged as schema-blocked. (See §3: it turns out it is *not* schema-blocked — the
  stop metadata identifies the booked span, so I was wrong about needing a migration.)
- The legacy pages (old editor / old timeline) render ticket cards from stop metadata — which is why
  this *used* to work and now appears "gone": you're standing in the new UI, which never reads it.

### 1e. "No way to scan tickets in the planning page" — CONFIRMED
The Gmail "Scan for tickets" flow exists only on the **legacy** brief, the **legacy** editor, and
Settings. It was never wired into `/plan`. (Your screenshots show it on the old pages because that's
the only place it lives.)

### 1f. "The old page has more modalities than the new one" — CONFIRMED
The legacy brief/editor offer transport booking cards (date, stations, times, changeovers, seat,
ref, price), accommodation cards, per-leg mode pickers, be-home-by, notes. The new `/plan` has:
plain-language capture, a basic manual add (appointment/place + time + duration), variable editing,
leg comparison, constraints. **It is missing: add-booked-transport, add-accommodation, scan-for-
tickets, notes, and journey lifecycle.** This violates the codebase's own "One Toolkit, Two Views"
rule — the new primary surface withholds tools the old one has.

### 1g. "Old pages still exist and are accessible" — CONFIRMED, by design but leaking
"Parity-before-strip" was the deliberate posture — but the legacy surfaces aren't merely *parked*,
they're **actively routed into** by the new app (1a's capture redirect is the worst leak). So the two
generations don't coexist quietly; the seams are load-bearing.

---

## 2. Corrections to my previous handoff (owning it)

| Earlier claim | Reality |
|---|---|
| Done-when #4 "booked rail opens a TicketCard with scannable Aztec in ScanView" ✅ | True **only for demo fixtures** (`/wallet?demo=1`). Your real tickets never reach the Wallet — wrong data source. **Not met.** |
| Done-when #6 "Wallet lists all bookings…" ✅ | Same — the real-data path returns ~nothing, and the Wallet isn't linked in the UI. **Not met.** |
| Done-when #8 "Today renders as a projection" ✅ | The projection engine is real and tested, but Today can't go live for any trip made in the new UI (status stranded at `planning`). **Met mechanically, broken practically.** |
| Done-when #1 "a fact lands by time and recomputes" ✅ | True *within one journey* — but capture creates hidden new journeys instead of appending, so in practice facts "vanish". **Half-met.** |
| "Docked pass is blocked on a schema add" | **Wrong.** The booked span is identifiable from the contiguous `transit_*` stops sharing a `booking_reference` in metadata — no migration needed. I over-stated the blocker. |

The pattern in those mistakes: I verified slices against build/tests/fixtures, not against **your
real data and real navigation paths**. The engine work is sound; the product joinery wasn't done.

## 3. What is genuinely solid (so we keep it)

- **Data is safe**: all itineraries, stops, the Trainline booking + both Aztec payloads, intentions.
- The engines: door-to-door ranking, insert-by-time, the solver, `projectToday` (unit-tested),
  feasibility/at-risk, the deterministic parser.
- The barcode renderer (bwip-js → real scannable Aztec/PDF417/QR, offline-capable).
- The designed component families (spine cards, document family, the Pass/Wallet treatment, landing,
  shell, auth) and the additive CSS architecture.
- Build green, tsc clean, 204 tests.

## 4. The repair programme (proposed order)

**P0 — make the new app one coherent product (the "joinery" pass):**
1. **Tickets from the real source.** A reader that folds contiguous `transit_*` stops (shared
   booking ref) into `TicketVM`s — Wallet reads stop-metadata **and** travel_bookings; the booked
   span on `/plan` renders as the **docked Pass** (no longer blocked); ScanView works on your real
   Aztecs.
2. **`/plan` becomes journey-aware.** A days/journeys strip (upcoming + recent), default nearest;
   capture **appends to the journey in view** when the fact's date fits, otherwise creates and
   *switches to* the new day — never silently.
3. **Route coherence.** Capture (everywhere, including `/capture`) lands on `/plan` for the journey
   it touched; nothing in the new shell links into legacy; legacy pages remain URL-reachable only
   until strip.
4. **Lifecycle out of legacy.** Today projects `planning` journeys too (or `/plan` gets the
   advance action) — a new-UI user can reach a live Today.
5. **Wallet reachable.** Nav/menu entry + Today's document area.

**P1 — parity on the missing tools, then strip:**
6. Scan-for-tickets (Gmail import) from `/plan`; add-booked-transport + accommodation in the manual
   add; notes. Then the legacy strip per the standing rule.

**P2 —** the previously-listed remainder (reactive live signals behind a harness; forward-to-import).

---

*Everything in §1 was verified in code or against the live DB this session; §2's corrections
supersede `docs/app-state-handoff.md` where they conflict.*

# PROPOSAL — Events, organised by day (the Plan re-architecture)

*For review before implementation. Resolves the root error: `/plan` is a singleton with no way to
choose, create, or switch the day a fact belongs to. Nothing here is built yet — this is the plan.*

---

## 0. Plain-English summary (60 seconds)

Today the app has **one** "plan" view that silently picks a journey for you. That's the bug behind
everything confusing: you can't say "I'm working on the 25th," you can't start "something for the
15th," facts land on the wrong day or vanish, and Today can never go live.

The fix is a two-level structure that matches how you actually think:

- **An index of Events** — every trip/day you've got, shown and sorted **by its start date**. A single
  appointment is a one-day Event; "Sweden for 3 days" is a multi-day Event. You see them all, you pick
  one, or you start a new one.
- **An Event you work inside** — one Event's spine (the timeline you already have), scoped to it.

When you tell Khonsera a fact, the **date decides the Event**: it opens the right day (creating it if
needed). No date? It's a **reminder**, parked to deal with later — not forced onto a day. Multi-day
**spans are inferred** where the facts allow it (a return flight on the 28th means the trip that
started on the 25th is 4 days), otherwise a fact is a single day until you say otherwise.

**No database migration is needed for the core** — Events are the itineraries you already have, spans
are the `date_end` you already have, reminders reuse the `intents` table already built.

---

## 1. The model

**Event** = the unit. (Data: one `itineraries` row — already has `date_start`, `date_end`, `title`,
`status`, `mode`.) An Event is a single happening *or* a multi-day trip/adventure.

- **The hinge is `date_start`.** Events are shown, grouped, and ordered by it. "The start date is what
  it hinges by, shows by, in the view."
- **The span is `date_start → date_end`.** A single Event defaults to one day (`date_end = date_start`).
  A multi-day Event spans its range and is shown as such ("Wed 25 – Sat 28 · 4 days").
- Events are **organised by day** in the index; a multi-day Event appears at its start day.

**Three things a captured fact can become** (the parser already classifies; we make the routing honest):

| Result | What it is | Where it lives |
|---|---|---|
| **Anchor** | a fixed point in a day's plan (meeting, flight, check-in) | a stop inside an Event |
| **Reminder** | a dateless "deal with this later" — *not* an anchor or task | an `intents` row, surfaced in a Reminders strip |
| **Task** | a to-do (optionally due-dated) | a `tasks` row (unchanged) |

## 2. Your exact scenario, solved

> *Planning the 25th, back out, later add a fact that belongs to the 15th.*

- You finish on the 25th and leave. **Plan** now shows the **index**: a list of your Events by start
  date — the 25th, the 11th, etc. — not a silent singleton.
- You hit **Tell Khonsera** and say *"dentist at 2pm on the 15th."* The date routes it: **no Event
  exists for the 15th, so Khonsera creates one** (locked to the 15th, auto-named "Dentist"), opens it,
  and stages the fact to confirm. It never touches the 25th.
- Had you said *"and a 9am meeting"* while **inside** the 25th, it appends to **the 25th** — because
  you're in that Event.
- Had you said *"must remember to renew my passport"* (no date) → a **Reminder**, parked, surfaced
  later. Nothing forced onto a day.

## 3. Surfaces

### 3a. Plan index — `/plan` (NEW)
A list of Events, **grouped/sorted by start date** (Today · This week · Later · Past→archive). Each row
uses the existing **`JourneyListCard`** contract component (already designed): start date (hinged),
name, **span** ("1 day" / "4 days · Wed 25–Sat 28"), status, a glance line (n stops · booked?). Plus:
- **"+ Plan something"** → create an Event: **start date (required — the lock) + name (optional**;
  Khonsera auto-names from the first place). End date optional (else inferred/single-day).
- A **Reminders** strip (dateless intents) — "things to slot in later."
- Tapping a row → the Event detail.

### 3b. Event detail — `/plan/[id]` (the current spine, moved here)
Everything `/plan` does now — capture bar, manual add, anchor three-variable editing, leg comparison,
constraints, the document family, **docked passes**, the five planner states — **scoped to this Event**.
Adds:
- A header: name · **date range / span** · status · **← back to Plan**.
- **Day dividers** for multi-day Events (Day 1 · Wed 25 / Day 2 · Thu 26 …); single-day Events show none.
- Capture/add here **append to this Event** (the real append path — replaces today's "new journey
  every time" bug).

## 4. Where a fact goes — the routing rules (the core fix)

| You are… | The fact has… | What happens |
|---|---|---|
| **inside an Event** (`/plan/[id]`) | any | appends to **that** Event, by time |
| at a **global** Tell (sidebar/topbar/Today) | a **date** | **find** the Event whose span covers that date → open it; else **create** one locked to that date (auto-named) → open it, fact staged to confirm |
| at a **global** Tell | **no date** | becomes a **Reminder** (parked), not placed on a day |
| at a global Tell | a **return/bounding** fact (flight/train/hotel) | creates/extends the Event and **infers the span** (§5) |

"Find" = an Event in the active mode whose `[date_start, date_end]` covers the date. Overlap (rare) →
nearest start date wins; if genuinely ambiguous, a one-tap chooser. **Never** the silent singleton.

## 5. Span inference (assume a day until told otherwise)

At materialise time (and when a booking is imported/added), infer `date_end`:

- **Return flight/train** (outbound date < return date) → `date_end` = return date.
- **Hotel** (check-in < check-out) → extend `date_end` to check-out.
- **Otherwise** → `date_end = date_start` (single day).
- **Re-infer** when a later bounding fact arrives (adding a return *extends* an existing Event).

So "fly to Sweden the 25th, back the 28th" becomes a **4-day Event** automatically; "dentist at 2pm"
stays a **single day** until you extend it.

## 6. Interrelation / "adventures" (honest about what's inferable)

- **Inferable now:** one capture/booking that spans dates → **one multi-day Event** (via §5). This
  covers the real "adventure" case (a trip bounded by its travel).
- **Deferred (P2), flagged as speculative:** auto-**merging two already-separate Events** on adjacent
  days into one adventure. That's a guess that can be wrong (two unrelated things can sit on
  neighbouring days), so I will **not** auto-merge silently. Instead, P2 adds a *suggested* "these look
  related — combine?" prompt you accept or dismiss. Until then, related days stay separate Events you
  can see together in the index.

## 7. Lifecycle — making Today reachable (fixes the dead end)

Today currently only shows `planned`/`in_progress` Events, and the only way to advance is a **legacy**
button — so a new-UI Event can never go live. Fix: **Today projects any Event whose span includes
today**, regardless of draft/planning status (you don't have to "publish" a plan for it to be your
day). The status field stays for later workflow, but it's no longer a trap. (`projectToday` already
exists; this is a query change + a small status touch on the Event detail.)

## 8. Tickets from the real source (folding in the integrity-review P0)

Independent of the index pivot but required to make the app whole, and now **unblocked**:

- Your booked travel lives in **stop metadata** (`transit_departure/changeover/arrival` stops sharing a
  `booking_reference`, with the Aztec payloads) — not the empty `travel_bookings` table the new Wallet
  reads. I'll add a **reader that folds those contiguous transit stops into `TicketVM`s**, so:
  - the **Wallet** shows your real tickets (and gets a **nav entry** — it currently has none),
  - the booked span on the Event spine renders as the **docked Pass** (this was *not* schema-blocked —
    I was wrong; the metadata identifies the span),
  - **ScanView** opens your real Aztec barcodes (offline).

## 9. Data model — what's reused vs added

- **Events** → `itineraries` (exist). **Span** → `date_end` (exists). **Reminders** → `intents` (exist,
  migration 0027). **Status** → `itineraries.status` (exists). **Bookings** → stop metadata (exist).
- **No migration required for P0.** (A later nicety — a `reminder` flag or `relates_to` for adventures —
  would be its own small migration in P2, not now.)

## 10. Routing coherence & legacy

- `/plan` = index · `/plan/[id]` = Event. **All** entry points route here: the global Tell, the
  Today CTA, the legacy `/capture` confirm. **Nothing in the new shell links into legacy.**
- Legacy `/itineraries*`, `/dashboard`, `/bookings`, old brief/editor: left **URL-reachable but
  orphaned** (no links in) — **parity-before-strip**. They get removed in a follow-up once you've
  confirmed the new Plan covers them. (Per your steer: build-and-route-now, delete-later — not a
  big-bang delete.)

## 11. Build phases

**P0 — the coherent product (this proposal's heart):**
1. Split `/plan` → **index** + `/plan/[id]` **detail** (move current spine logic to the detail).
2. **JourneyListCard index** grouped/sorted by start date + **"+ Plan something"** (date + optional name).
3. **Capture routing**: append-in-Event; global Tell resolves by date (find-or-create); dateless →
   reminder. Repoint `/capture` + Today CTA.
4. **Span inference** (§5) at materialise/import.
5. **Tickets from real source** + docked Pass + Wallet reader + **Wallet nav entry** + ScanView (§8).
6. **Today lifecycle** fix (§7).
7. Multi-day **day dividers** + Event header.

**P1 — parity tools, then strip:** scan-for-tickets (Gmail) on the Event detail; add-booked-transport
+ accommodation in manual add; notes. Then retire legacy.

**P2 — the rest:** "combine related days?" suggestion; reactive live signals (behind a test harness);
email forward-to-import.

## 12. Fit with the master brief

The master brief is **day/plan-centric** — it specs the *single spine* (my Event detail) and Today as
its projection, but **under-specifies the container** (how you pick/create/switch the day). This
proposal adds exactly that container **above** the brief's planner without contradicting it: the brief's
"planner page" = the Event detail; the new index is the missing level; span-inference and
reminders extend (don't replace) §4's capture model and §2's data model. The "One Toolkit, Two Views"
rule is honoured by bringing the missing tools (scan/transport/hotel) onto the Event detail in P1.

## 13. Open decisions for you / your middle layer

1. **Naming.** "Event" vs "Trip" vs "Day" vs "Plan" for the unit; "Reminder" confirmed for dateless.
   (Design owns final voice; I need a working label.)
2. **Today's go-live rule (§7):** project *all* Events whose span includes today (proposed), or keep an
   explicit "this is my day" toggle?
3. **Span default:** single-day until a bounding fact appears (proposed) — agreed?
4. **Index grouping:** Today / This week / Later / Past-archive (proposed) — or a flat date-sorted list?
5. **Scope confirm:** P0 as listed in one programme, or land it in smaller reviewable chunks?

*Awaiting your go (and your middle layer's read) before I implement. I'll build nothing until you
confirm — and I'll adjust this proposal to whatever comes back.*

---

## CONFIRMED (middle-layer review — build it, in chunks)

**Approved.** Decisions locked:
1. **Naming** — `Event` is the **internal/code** label only; **not surfaced in UI**. UI shows each
   entry by **content + span** ("Dentist · Tue 15", "Sweden · Wed 25–Sat 28"), no category noun.
2. **Today go-live** — **automatic**, no toggle: Today projects every Event whose span includes today.
3. **Span default** — single-day until a bounding fact appears.
4. **Index grouping** — Today / This week / Later / Past→archive, **mirroring the Wallet's grouping**.
5. **Scope** — land P0 in **reviewable chunks**, not one programme.

**Edges to resolve in-build:**
- **E1 — Today under overlap:** if multiple Events cover today, Today **composes** today's slice across
  all of them (union of today's stops, ordered by time) — never silently pick one.
- **E2 — Return-fact association:** a later-dated bounding fact at a *global* Tell **extends the
  originating Event** only when (a) captured inside it, or (b) route-reversal matches an existing
  Event's outbound; a lone bounding fact matching nothing → one-tap chooser, **never a silent new Event**.
- **E3 — Legacy leg-recompute:** opening any Event in the new detail **re-runs the leg solver** (guarded)
  so old plans don't show bare legs.

**Chunked sequence (each a checkpoint):**
1. **Structural split** — `/plan` index + `/plan/[id]` detail (move the spine to the detail). ← *this chunk*
2. Capture routing (append-in-Event; global Tell find-or-create; dateless → reminder); repoint /capture + Today CTA.
3. Span inference (E2).
4. Today lifecycle (E1).
5. Day dividers + Event header (full).
*In parallel/early:* ticket reader + docked Pass + Wallet reader + Wallet nav + ScanView (E3).

**Design contract:** all new surfaces (Plan index, Event header, create affordance, day dividers,
reminders strip) are Code-built on `.cc-*` + tokens and **queued for a Design round**; `JourneyListCard`
is rebuilt to `.cc-*` (it had no Edition II pass) and repointed to `/plan/[id]`.

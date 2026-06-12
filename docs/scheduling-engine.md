# The threading engine — planning ↔ live, and the time between

> The engine is the product. Bookings, capture, navigation are all valuable, but
> the core promise is this: **give us what you've got, in any order, and we thread
> it into a coherent day — then look after you through it.** Planning and live are
> not two features. They are the same engine seen from two moments in time.

## One model, two projections (already the architecture)

- **`solveTimes`** (`src/lib/itinerary/solver.ts`) is the threading core: given
  fixed points (anchors) and the legs between them, it propagates times outward,
  applies arrival **buffers as slack** (not inflated journeys), and fills the
  timeline. Pure, deterministic.
- **`projectToday`** (`src/lib/planning/today.ts`) states it outright: *"Today is
  the plan seen through now."* Same model, viewed from the current moment → the
  live state.

So **planning = thread + project from whenever; live = thread + project from now +
your GPS.** No second engine, no drift. Everything below extends this one spine.

## 1. Any order in → a coherent day out (the magic on add)

You hand us facts however they arrive — "dentist at 2", "train to Derby", "lunch
with Sam", "home by 6" — in any sequence. The engine:

- slots each into its place in time;
- computes the **transition** between each adjacent pair (the modality + routed
  travel time);
- applies **leave-bys** and **buffers**;
- re-threads the whole chain so every downstream time shifts coherently.

Instantly, on screen, as you add. **That instant coherence is the headline feel** —
you think in fragments; it returns a day.

## 2. Fixed vs open legs

- **Fixed leg** (a booked train, the 16:56): hard before/after facts — two anchors
  with locked times; the engine threads around them.
- **Open leg** (turn-up-and-go, an open return, "a train that day"): a **range**,
  not a time. The engine's job is to **choose or offer** the service that lands you
  in time for the next fixed point — and that choice reshapes the surrounding free
  time: *"the 15:10 leaves you 40 min in Leicester; the 15:40 runs straight
  through."* Open legs are how you deliberately **create or spend** time.

## 3. The time between — gaps as first-class (the part nobody else does)

People exist between their appointments. Once the fixed points and their
connecting travel are threaded, what's left is **rested time — an asset, not a
void.** For each gap the engine knows:

- **Where** you are during it (at a station, in a town, at home);
- **How long** it genuinely is — the spare minutes *after* travel and buffers;
- **What's reachable** — the **unplanned-time radius**: what you can get to and back
  from in the spare time, by an available mode.

Then it can *offer* — *"40 min near Leicester — lunch nearby? slot the errand?
just rest?"* — and *absorb*: drop "grab lunch" in and it fits the gap, re-threading
leave-bys so you still make the train. The gap is where travel and rest negotiate:
a long modality may eat all the spare time, or leave a usable pocket; an open leg
can be chosen to open a pocket on purpose.

## 4. The same brain, live

Living the day, the engine is the same — projected from **now + your position**:

- it re-threads from where you actually are (the live "from");
- a slip re-propagates downstream (knock-on) exactly as adding a fact re-threads
  in planning;
- a gap shrinks or grows live — *"your train's 12 late; your Leicester pocket is
  now 28 min."*

Planning builds the thread; live keeps it true. (The live half — states, the two
forks, on-service tracking — is `docs/today-live-engine.md`.)

## 5. Why this is powerful

- **Zero-friction in, coherence out.** No spreadsheet of leave-bys in your head.
- **It does the dread maths** — connections, buffers, "will I make it" — once, and
  keeps doing it as reality moves.
- **It turns dead time into opportunity** — gaps become "what can I do", not waiting.
- **It handles the choices** — which train, when to travel, what to slot in — with
  the consequences visible before you commit.
- **The plan you built is the guardian you carry** — same engine, so what you
  planned is exactly what looks after you, adapting live.

## 6. Have vs need

**Have:** `solveTimes` (threading + buffers), `projectToday` (plan-through-now),
the brief's any-order capture + re-thread, transitions/routing, the leave-by /
feasibility / `checkPickup` primitives.

**Need:** the **gap engine** (true spare time + location + unplanned-time radius +
"what can you do"); **open-leg selection/offer**; the **live DayState engine**
(position-aware, the forks, on-service tracking); and the **instant on-add
re-thread** polish across both surfaces.

## 7. Build order (engine-first)

1. Harden the shared **threading core** (`solveTimes`) as the single source used by
   brief, planning and live.
2. The **gap engine** — compute genuine spare time + location, then the
   unplanned-time radius and the "what can you do" affordance.
3. **Open-leg selection** — offer/choose services against the next fixed point.
4. The **live DayState engine** — project from now + GPS, the two forks, on-service
   tracking (`docs/today-live-engine.md`).

# KQA-UX-001 — The stranded-car business day

**Status:** Designed, not yet executed  
**Lens:** UX  
**Primary purpose:** Stress a realistic multimodal business-travel day, then deliberately introduce human-ordering mistakes, state mutations, location ambiguity and impossible vehicle continuity.

## Why this scenario

This is not a happy-path demo.

The day is plausible enough that Khonsera should be genuinely useful, but it contains several ordinary real-world details that itinerary software often ignores:

- driving to a station is not the same thing as being ready to board;
- a parked car remains an asset at a physical location;
- train/tube/walking legs have station-ingress and transfer friction;
- people add facts in the wrong order;
- dead time is part of the day and should remain comprehensible;
- location names can be ambiguous;
- changing one fact should visibly re-thread dependent advice;
- a later mode choice can be logically impossible even when each individual leg is routable.

The test deliberately attempts to make Khonsera accept a superficially valid but physically inconsistent day.

## Research basis

The route shape is grounded in real transport infrastructure:

- Bedford is a Thameslink station with an ANPR-managed station car park. Thameslink says station parking may require a parking/payment action and Bedford is listed among its ANPR car parks.
- Thameslink operates direct rail between Farringdon and Harpenden.
- Bedford and Harpenden are both on the Thameslink corridor.
- Canary Wharf is served by the Elizabeth line and also has DLR/Jubilee interchange.
- Thameslink advises travellers to use journey planners because published timetables may be amended; exact services/times must therefore be frozen from authoritative sources at execution time rather than hard-coded permanently into this UX scenario.

Canonical sources:
- https://www.thameslinkrailway.com/travel-information/car-parking
- https://www.thameslinkrailway.com/travel-information/car-parking/automatic-number-plate-recognition
- https://www.thameslinkrailway.com/journey/farringdon-to-harpenden
- https://www.thameslinkrailway.com/journey/Bedford-to-Harpenden
- https://www.thameslinkrailway.com/service-updates/timetables
- https://tfl.gov.uk/elizabeth-line/stop/910GCANWHRF/canary-wharf

## Run identity

Suggested run ID:

`KQA-UX-001-stranded-car`

When eventually executed, append date/build if needed:

`KQA-UX-001-stranded-car-20260922-<short-sha>`

## Synthetic traveller

- New-ish Khonsera user.
- Home/base: Wellingborough.
- Owns/has access to one car at the start of the day.
- No hire car, second car or colleague pickup exists unless explicitly added later.
- Comfortable with rail and London public transport but does not know Khonsera's internal model.
- Wants the app to tell them when to leave and how the day fits together; they should not need to do route arithmetic manually.

## Day objective

Use a normal weekday.

For the first execution, use **Tuesday 22 September 2026** if the relevant providers are operating a normal usable service. If engineering work or abnormal service materially changes the scenario, preserve the same mission but select the next representative weekday and record the change.

The traveller needs to:

1. leave Wellingborough in the morning;
2. drive to **Bedford railway station**;
3. park the car there;
4. take rail into London;
5. attend a fixed morning appointment around Paddington;
6. have a period of genuine dead time;
7. move across London for lunch / another commitment;
8. attend an afternoon appointment in Canary Wharf;
9. travel to Harpenden for a final commitment;
10. get home to Wellingborough that evening.

The day should remain feasible but not excessively slack.

## Core anchors

Exact provider-valid train times are frozen at execution time. The fixed human commitments are:

### Anchor A — morning meeting
- Location: Paddington area, London.
- Preferred concrete picker target: a real geocodable Paddington Central / Kingdom Street address.
- Start: approximately 09:00.
- Duration: 60 minutes.
- Hard arrival requirement.

### Anchor B — lunch / working catch-up
- Location: Farringdon / Smithfield area.
- Start: approximately 11:30.
- Duration: 45–60 minutes.
- Moderately flexible.
- Purpose: force a central-London location change while leaving some dead time before/after.

### Anchor C — afternoon meeting
- Location: Canary Wharf.
- Preferred concrete picker target: One Canada Square / Crossrail Place area rather than the generic district where possible.
- Start: approximately 13:30.
- Duration: 60–75 minutes.
- Hard-ish arrival requirement.

### Anchor D — Harpenden appointment
- Location: a real geocodable location in Harpenden, preferably not literally the station so a final-mile choice is required.
- Start: approximately 16:30.
- Duration: 45–60 minutes.

### Home
- Wellingborough.
- Desired home-by: approximately 19:30.

## Planned transport shape

The expected *shape*, not the exact eventual route:

1. **Drive**: Wellingborough -> Bedford railway station.
2. **Park**: car remains at Bedford.
3. **Rail**: Bedford -> London.
4. **Public transport / walk**: central London -> Paddington appointment.
5. **Walk / public transport**: Paddington -> Farringdon.
6. **Elizabeth line / other sensible TfL option**: Farringdon -> Canary Wharf.
7. **Public transport**: Canary Wharf -> Farringdon / northbound rail connection.
8. **Rail**: Farringdon -> Harpenden.
9. **Walk / taxi / local transit**: Harpenden station -> final appointment.
10. **Adversarial request**: choose **Drive** from Harpenden toward Wellingborough even though the traveller's only car is still at Bedford.
11. **Recovery**: correct the day by returning to Bedford, recovering the parked car, then driving home.

## The deliberate traps

### Trap 1 — build the day in the wrong order

Do **not** start with the base.

Create at least the morning appointment first, then add the base afterwards.

Observe whether:
- setting base is obvious;
- the base picker makes sense;
- the app acknowledges the action immediately;
- route/bookend/leave-by guidance rethreads without refresh;
- old guidance is not left looking current;
- no second click/navigation is needed.

This is the canonical issue #87 pattern.

### Trap 2 — location ambiguity

Search/select locations using natural human terms first:

- "Bedford station"
- "Paddington"
- "Farringdon"
- "Canary Wharf"
- "Harpenden"

Before accepting, assess:
- whether station vs district vs venue is clear;
- whether the result contains enough address/context;
- whether similarly named entities are easy to distinguish;
- whether the selected result is visibly confirmed after the picker closes;
- whether changing a mistaken selection is easy.

Then repeat at least one location using a precise address and compare the experience.

### Trap 3 — the station-parking blind spot

Drive to Bedford station.

A road ETA to the station is **not** the same as a boardable train connection.

Test whether the flow accounts for, exposes or makes it easy to add:
- finding a parking space;
- parking/payment task;
- car-park-to-platform walk;
- useful station-arrival buffer.

Try the natural user behaviour first: simply choose "drive to Bedford station" followed by a train.

Observe whether Khonsera:
- unrealistically joins car arrival directly to train departure;
- prompts for a station/parking buffer;
- lets the user add "park car" cleanly;
- recalculates leave-by when parking time is inserted later.

Do not presuppose the product must literally have a "parking" entity. Judge whether the traveller can model the real requirement naturally and whether guidance stays truthful.

### Trap 4 — dead time

Leave a genuine gap of roughly 45–75 minutes between commitments.

Do not immediately fill it.

Observe:
- whether the timeline makes the gap understandable;
- whether it looks like missing data or intentional free time;
- whether the app tries to over-thread it;
- whether the traveller can later insert a coffee/work stop without rebuilding the day;
- whether adding something into the gap rethreads only what should change.

### Trap 5 — mutate a fixed commitment after routing exists

Once the day looks threaded:
- move one London appointment earlier by ~20–30 minutes.

Observe:
- immediate acknowledgement;
- visible recalculation/pending state;
- surrounding legs changing;
- buffers becoming tighter where appropriate;
- leave-by guidance changing;
- no stale old/new values coexisting without explanation;
- no refresh.

Then undo or restore the original time and assess whether the second mutation is equally reliable.

### Trap 6 — London mode choice

For at least one central-London leg, inspect alternatives:
- walk;
- Tube / Elizabeth line;
- taxi/drive if offered.

The UX question is not "is every mode technically routable?"

Ask:
- are nonsensical options de-emphasised or explained?
- does the comparison make door-to-door time obvious?
- are station access/transfer costs represented?
- is the chosen option clearly committed?
- after choosing, does the rest of the day immediately reflow?

### Trap 7 — navigation handoff

Use Khonsera's Navigate experience for at least:
- the morning drive to Bedford station;
- one London walking/public-transport transfer if supported;
- the Harpenden final-mile leg.

Check:
- destination identity;
- mode consistency;
- whether "back to plan" preserves context;
- whether the navigation target is the actual venue rather than an ambiguous area/station;
- whether completing/returning leaves the plan in a sensible state.

### Trap 8 — impossible car teleport

After the Harpenden appointment, explicitly choose **Drive** toward Wellingborough.

At this point, the synthetic traveller's only car is still parked at Bedford.

This is the central adversarial probe.

Observe whether Khonsera:
- blindly accepts Drive;
- remembers or infers that the car was left in Bedford;
- warns/challenges the traveller;
- asks whether this is taxi/hire/another vehicle;
- offers a route back to the parked car;
- at minimum makes the physical contradiction visible.

Do **not** silently reinterpret "Drive" as taxi. If the UI's semantics are ambiguous, log that as a UX finding.

A system that happily creates Harpenden -> Wellingborough by own-car without any vehicle acquisition has produced a locally routable but globally impossible day.

### Trap 9 — legitimate recovery

Correct the impossible day by choosing:

Harpenden -> Bedford by rail -> collect parked car -> drive Bedford -> Wellingborough.

Observe:
- whether inserting the Bedford recovery is straightforward;
- whether the app preserves earlier work;
- whether the return-home time updates;
- whether vehicle continuity now makes sense;
- whether the previously impossible direct-drive leg disappears cleanly.

### Trap 10 — legitimate exception / positive control

After recording the failed/impossible-car behaviour, try modelling a legitimate exception:

"Collect hire car" or "Get access to another car" in Harpenden before selecting Drive.

This is a **positive control**, not an assumption that Khonsera already models vehicle assets.

The desirable product behaviour is nuanced:
- warn about impossible own-car continuity;
- allow a new car source when the traveller explicitly establishes one;
- avoid permanently banning Drive just because the morning car is elsewhere.

If Khonsera cannot express this distinction, record it as a model/UX capability gap rather than forcing a fake pass.

## Human-tempo observation

For every meaningful mutation, use the shared contract:

`action -> acknowledgement -> background work -> visible consequence -> stable state`

Key actions in this run:
- set base;
- select/change location;
- add parking/free-time item;
- change appointment time;
- change transport mode;
- open/close Navigate;
- attempt impossible Drive;
- insert recovery route.

Record:
- acknowledgement latency;
- first dependent visual change;
- stable-state latency;
- whether stale data remains visible;
- whether the traveller is tempted to click again;
- whether refresh/reload is required.

No reload/navigation-away workaround is allowed during a normal mutation check.

## Modals, sheets and transient surfaces

During the run, catalogue every encountered:
- place picker;
- add/edit sheet;
- mode picker;
- comparison panel;
- ticket/pass overlay;
- navigation handoff;
- warning;
- toast;
- error;
- pending/recalculation state.

For each, assess UX rather than visual polish:
- why did it appear?
- is the decision clear?
- is Cancel/back behaviour safe?
- does closing it preserve state?
- after confirming, is the consequence obvious?
- can the user recover from a mistaken selection?

Full visual design/aesthetic judgement belongs to a later UI-lens rerun of this same scenario.

## Expected UX invariants

The scenario is successful only if all applicable invariants hold:

1. The traveller always knows whether an action was accepted, pending, failed or finished.
2. Dependent guidance updates without manual reload.
3. The product never presents known-stale leave/travel guidance as current after a successful mutation.
4. Location identity remains unambiguous enough to trust.
5. A road ETA to a station is not treated as equivalent to being train-ready without any way to represent the missing operational time.
6. Dead time remains legible and editable.
7. Mode changes propagate to timings and downstream advice.
8. Navigation preserves the intended destination and mode.
9. The app does not silently teleport the traveller's only car.
10. A legitimate second/hire car can be distinguished from impossible continuity, or the limitation is made explicit.
11. The recovery route can be inserted without rebuilding the whole day.
12. The traveller can understand the entire day without doing hidden arithmetic themselves.

## Findings we are actively hunting

This run is intentionally looking for:
- stale client state;
- missing cache/revalidation;
- hidden loading;
- double-click temptation;
- ambiguous place selection;
- missing parking/station-ingress time;
- impossible asset continuity;
- nonsensical transport modes;
- over-aggressive auto-routing;
- dead-time confusion;
- lost context when entering/exiting Navigate;
- mutation order dependencies;
- poor recovery from a wrong choice;
- derived times that change only after refresh;
- the app being technically correct per leg but globally nonsensical.

## What is not part of this run

This is **UX**, not the full fidelity pass.

During execution we still use real providers to select a plausible real service and avoid testing against impossible fixture data, but we do not yet perform the exhaustive provider-by-provider truth audit.

After this run, the **same run/scenario** should be reusable as:

- `QA:UI KQA-UX-001` — visual hierarchy/polish across every captured state;
- `QA:FIDELITY KQA-UX-001` — authoritative verification of every route, timing, platform/live fact, buffer and consequence.

## Execution rule

Do not fix defects while first discovering them.

For the initial run:
1. execute;
2. capture evidence;
3. open separate material issues;
4. finish the scenario where possible using only behaviour a normal traveller could discover;
5. then prioritise fixes;
6. rerun the exact same scenario against the changed build.

This scenario is intentionally designed to embarrass the product. A clean run should be earned, not assumed.

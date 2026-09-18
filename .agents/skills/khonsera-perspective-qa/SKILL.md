---
name: khonsera-perspective-qa
description: "Run evidence-led Khonsera frontend QA from a selected lens: UI (visual/interface quality), UX (human task flow and reactivity), fidelity (real-world/travel truth), or all. Use when asked to inspect a route, modal, sheet, pop-out, traveller flow, itinerary, disruption, or release as a real user rather than infer correctness from source code."
metadata:
  author: khonsera
  version: "1.0.0"
---

# Khonsera Perspective QA

## Purpose

This skill tests Khonsera as a traveller experiences it.

It does not treat a green build, a successful API call, or an eventually-correct page as proof that the product works.

Run the **same scenario** through one or more lenses:

- **UI** — does the interface look deliberate, coherent, polished and responsive?
- **UX** — can a traveller understand, operate and recover from the flow naturally in human time?
- **Fidelity** — is what Khonsera says actually true, correctly derived and appropriately certain?
- **All** — run UI, UX and fidelity as separate passes over the same scenario and evidence set.

The lens changes the questions, not the underlying traveller mission.

---

## Invocation

Prefer explicit invocations such as:

```text
Use khonsera-perspective-qa in UI mode.
Scenario: sign in, open an existing Plan, set a base, inspect the page and every sheet/modal/pop-out that appears.
Environment: current Vercel Preview.
Device: desktop + 390px mobile.
```

```text
Run the same QA scenario in UX mode.
Do not refresh to reconcile state. Dwell after every meaningful mutation.
```

```text
Run the same scenario in fidelity mode.
Cross-check every passenger-facing travel claim against authoritative real-world data.
```

```text
Run khonsera-perspective-qa in all modes against the latest validated preview.
Mission: get from Wellingborough to a 10:00 meeting in Harpenden, dinner afterwards, then home; introduce an 8-minute rail delay.
```

If the user says "same scenario", reuse the previous mission, environment, fixtures and run context unless a changed build requires a new deployment identifier.

If the user provides a sufficiently clear mission, do not stop to ask unnecessary clarifying questions. Record reasonable test assumptions in the run manifest.

---

## Inputs

Capture these before execution:

- **lens**: `ui`, `ux`, `fidelity`, or `all`
- **mission**: the traveller's objective, not a list of selectors
- **environment**: preview preferred for destructive/full-flow testing; production only for safe smoke work
- **exact commit/deployment**
- **account strategy**:
  - isolated throwaway user for destructive CI/browser work
  - hosted synthetic account only if provisioned through supported Auth
  - never use a real customer's account/data for destructive testing
- **device/viewports**: default desktop + 390px mobile for user-facing work
- **scope**: routes/features explicitly in scope
- **time context**: local date/time/timezone when travel truth depends on "now"
- **truth sources** for fidelity runs

Create a short **run ID**, for example:

`KQA-20260918-base-reactivity-01`

Use the same run ID across UI/UX/fidelity passes over the same scenario where practical.

---

## Core operating rules

1. **Evidence before conclusions.**
2. **Use the product. Do not infer behaviour from JSX/source alone.**
3. **Never weaken a failing test to make CI green.**
4. **Do not reload, navigate away/back, or remount a route to obtain expected post-mutation state unless reload/navigation is itself under test.**
5. **Unknown/stale travel information must remain explicitly unknown/stale.**
6. **A server/database mutation succeeding is not proof that the visible product reacted correctly.**
7. **Do not silently fix the product during an audit pass. Capture the defect first.** If the user asked to fix as part of the run, reproduce and record the failing evidence before implementation.
8. **Do not claim an interaction happened in a tool that cannot interact.** Opera may independently inspect/navigation/render; use Playwright for click/type flows when Opera lacks those controls.
9. **Treat loading, transitional and failure states as first-class screens.**
10. **Inspect every transient surface encountered**: modal, sheet, drawer, popover, tooltip, ticket overlay, picker, alert, toast, error message and empty state.

---

# Shared execution protocol

## Phase 0 — Establish the exact build

Before testing:

- identify the exact Git SHA;
- identify the Vercel deployment/alias under test;
- confirm the deployment is READY;
- confirm the account/data boundary;
- record browser/project/viewport;
- do not accidentally compare screenshots from different commits as if they were one run.

For release work, prefer a Vercel Preview first.

---

## Phase 1 — Write the traveller mission

Write one concise mission in human terms.

Good:

> I have a 10:00 meeting in Harpenden. I am leaving from Wellingborough, need dinner afterwards and need to get home that evening. I initially create the meeting before setting my base.

Bad:

> Click Set Base, click option 3, assert text.

The mission must allow realistic ordering mistakes and later edits.

Where relevant, explicitly include:
- event first, base later;
- base first, event later;
- change event after routing exists;
- change base after routing exists;
- change transport mode after a leave-by exists;
- disruption after the calm plan is already visible.

These mutation-after-render paths are mandatory for stateful frontend features.

---

## Phase 2 — Create controlled test state

Use the smallest realistic setup.

For destructive/repeatable flows:
- isolated Supabase;
- fresh synthetic user;
- synthetic places/appointments/bookings;
- cleanup after run.

Do not seed the final expected UI state if the scenario is meant to prove the UI can create it.

For signup testing, create the account through the actual signup form.

For authenticated testing where preconditions are impractical to build through UI, seed only the minimum precondition and then perform the behaviour under test through the real UI.

---

## Phase 3 — Execute interactions

Use Playwright or another actual interaction engine for:
- fill;
- click;
- submit;
- select;
- drag where relevant;
- Back/Forward;
- refresh tests;
- mobile viewport;
- network interception/failure;
- timing measurements.

Use the real application controls and accessible names where practical.

Avoid direct database writes for the behaviour under test.

### Human-tempo observation

After every meaningful action, stop and observe.

Capture:

`action -> acknowledgement -> background work -> visible consequence -> stable state`

Record at least:

- action timestamp;
- acknowledgement latency;
- first dependent visual change latency;
- stable-state latency;
- loading/progress wording;
- stale values visible during transition;
- browser errors;
- requests started/finished where useful.

Recommended observation points for important mutations:
- immediately before;
- ~300 ms;
- ~1 s;
- ~2 s;
- final stable state.

Do not add arbitrary sleeps merely to make a test pass. Wait on meaningful product states while also recording what was visible during the wait.

### No-refresh rule

For a normal mutation test, the following are forbidden as reconciliation mechanisms:

- `page.reload()`
- `page.goto(currentRoute)`
- navigating away and back
- reopening the app
- forcing component remount

If a manual refresh is needed before dependent state becomes correct, open a defect.

Canonical example: issue #87 — setting/changing Plan base must update bookend/mode/leave-by automatically.

---

## Phase 4 — Independent real-browser pass

Use Opera Browser Connector as an independent rendered-browser inspection layer when connected.

Opera is especially useful for:
- real deployed rendering;
- accessibility tree inspection;
- screenshots;
- route navigation;
- verifying that the hosted build looks like the automated evidence;
- spotting visual issues that test assertions do not describe.

If Opera exposes no click/type action in the current connection, do not pretend it completed interactive steps. Use the state produced by Playwright/hosted fixtures plus Opera inspection.

Capture desktop and mobile evidence through an interaction-capable browser; use Opera as additional real-browser evidence where its permission surface permits.

---

## Phase 5 — Observability pass

Observability corroborates browser evidence; it does not replace reproduction.

### PostHog

When PostHog is enabled:
- verify the intended environment is ingesting;
- locate the synthetic session/page navigation where possible;
- inspect session replay for stalls/repeated clicks when useful;
- keep synthetic traffic identifiable/excludable from normal product analytics;
- preserve input masking and privacy controls;
- do not place sensitive travel content in analytics event properties.

### Sentry

When authenticated Sentry access is available:
- inspect unexpected issues/events for the exact environment/release;
- correlate event timestamp/release/URL with the QA run;
- do not expose auth tokens;
- do not print raw sensitive stack/event data.

If Sentry access is unavailable, say so in the evidence report; do not imply the run was Sentry-clean.

### Vercel

Check:
- deployment state;
- runtime errors/5xxs;
- release/commit identity;
- relevant build warnings.

A browser-visible success with unexplained runtime errors is not a clean pass.

---

# Lens: UI

## Question

**Does every rendered state look deliberate, coherent, polished and appropriate to Khonsera?**

UI mode is not primarily about whether the button works. Interact enough to expose every relevant state, then review what is rendered.

## Inspect every view and transient surface

For each route/modal/sheet/popover encountered, inspect:

### Hierarchy
- Is the primary thing visually primary?
- Is secondary information genuinely secondary?
- Is there a clear reading order?
- Does the eye know where to go next?

### Geometry and boundaries
- spacing rhythm;
- alignment;
- container widths;
- card/surface boundaries;
- padding consistency;
- border/radius consistency;
- orphaned controls;
- elements appearing visually detached from their owner;
- accidental empty space;
- cramped density.

### Typography
- type hierarchy;
- line length;
- contrast;
- label/body distinction;
- awkward wrapping;
- uppercase/eyebrow consistency;
- punctuation/copy presentation.

### Controls
- primary vs secondary buttons;
- disabled/loading appearance;
- tap/click affordance;
- destructive action treatment;
- field grouping;
- picker/dropdown/sheet relationship;
- focus/hover/selected states where available.

### Responsive presentation
At minimum desktop + 390px:
- horizontal overflow;
- clipped content;
- bottom navigation covering content;
- modal/sheet viewport fit;
- keyboard/form action reachability;
- long place/station names;
- buttons wrapping poorly;
- cards collapsing into ambiguous layouts.

### State polish
Review separately:
- empty;
- initial;
- loading;
- success;
- error;
- stale/revalidating;
- disrupted;
- modal open;
- validation error;
- long-content state.

## UI findings

A UI issue is valid even when all functionality passes.

Do not reduce UI review to accessibility violations or pixel-perfect comparison. Record whether the interface looks accidental, inconsistent or visually confusing.

---

# Lens: UX

## Question

**Can a traveller understand what happened, what is happening now, and what to do next without fighting the product?**

UX mode is task- and time-oriented.

## Test the whole interaction, not just the final state

For every meaningful user action ask:

1. Did the product acknowledge me immediately?
2. Do I know whether it is working, succeeded or failed?
3. Did every dependent part of the page react?
4. Is old information still visible as if current?
5. Do I understand what to do next?
6. Did I have to click twice, refresh, navigate away/back or guess?
7. Did the app preserve my context?
8. Did the system make me perform avoidable travel arithmetic?

## Mandatory mutation testing

For each important entity, test both:

**initial render with state already present**

and

**mutation while remaining on the page**

Examples:
- Plan loaded with base set;
- open Plan without base -> set base -> observe;
- change base while Plan remains open;
- change a leg mode;
- edit an appointment time;
- add/delete a stop;
- import/remove a booking;
- alter buffer;
- accept recovery/replan.

The second class is essential. A route that becomes correct only after reload fails UX QA.

## Human dwell

After important actions, deliberately do nothing for a bounded observation period.

This is designed to catch:
- "nothing happened";
- missing progress feedback;
- stale derived state;
- optimistic edited field with stale dependants;
- double-click temptation;
- flicker;
- contradictory old/new values;
- late layout jumps.

## Adversarial human ordering

Do not always follow the architecture's ideal sequence.

Try:
- destination/event first, base later;
- base first, event later;
- add then immediately edit;
- edit then change mode;
- change mode then base;
- delete and recreate;
- Back after save;
- refresh during a safe pending operation where appropriate;
- expired session;
- failed request then retry.

## Recovery

Exercise:
- invalid input;
- API 4xx/5xx;
- provider unavailable;
- slow provider;
- timeout;
- offline/lost network where practical;
- duplicate submission pressure.

The traveller must know whether the action:
- failed;
- is pending;
- succeeded.

---

# Lens: Fidelity

## Question

**Was Khonsera's passenger-facing answer actually true?**

Fidelity is independent from visual quality and task usability.

A beautiful, easy-to-use wrong answer fails.

## Build expected truth before judging the UI

Where practical, write a small truth sheet before inspecting Khonsera's final answer. This reduces confirmation bias.

Include:
- scenario date;
- timezone;
- origin/destination;
- coordinates or canonical place identity;
- booked facts;
- current/live facts;
- expected mode/route;
- authoritative timings;
- uncertainty/staleness;
- expected consequences.

## Source hierarchy

Prefer the most authoritative available source for the claim.

Examples:
- rail live running/platform: authoritative rail/provider feed;
- timetable/booked service: timetable/provider booking evidence;
- TfL: TfL source;
- route geometry/travel time: configured routing provider;
- flight status: authoritative aviation/provider source available to Khonsera;
- location identity: provider/place details used by Khonsera.

Use general web search only when an authoritative source is unavailable or to locate that source.

Record the source and observation time.

## Compare the complete truth chain

For travel-data work:

`authoritative provider truth -> Khonsera parsing/normalisation -> passenger-facing UI -> consequence/replanning behaviour`

Validate each boundary.

Do not stop at "API returned 200".

## Fidelity assertions

Check:
- correct place;
- correct date/time/timezone;
- correct mode;
- correct route/leg ordering;
- correct duration;
- correct leave-by/arrive-by derivation;
- correct platform/service/status where available;
- correct buffer/slack;
- correct consequence of a delay;
- correct recovery/replanning options;
- booked vs live distinction;
- stale vs current distinction;
- uncertainty preserved.

### Unknown means unknown

If the provider does not know:
- do not fall back to a booked platform as if live;
- do not invent a route/time;
- do not transform missing data into certainty;
- do not hide staleness.

The expected output may legitimately be "unknown", "checking", or "live information unavailable".

## Counterfactual consequence testing

When a fact changes, verify the advice changes correctly.

Examples:
- +8 min train delay -> recalculate connection risk and downstream appointment consequence;
- platform unavailable -> remove platform certainty without erasing the booked journey;
- base changes -> recalculate first/last leg and leave guidance;
- mode changes -> recalculate duration and dependent leave time.

---

# Lens: All

Run three distinct passes:

1. **UI pass**
2. **UX pass**
3. **Fidelity pass**

Do not collapse them into one generic verdict.

Use the same:
- scenario;
- build;
- account/fixtures;
- key screenshots;
- run ID.

A finding can appear in multiple lenses, but describe the lens-specific failure separately.

Example:

- UI: the recalculating state has no visual affordance.
- UX: the traveller cannot tell anything is happening for 1.7 s.
- Fidelity: stale leave-by remains visible as current during recomputation.

That is one interaction with three different quality failures.

---

# Evidence bundle

For significant runs, preserve an evidence bundle conceptually shaped like:

```text
test-results/qa-runs/<run-id>/
  manifest.json
  timeline.json
  findings.md
  screenshots/
    00-before.png
    01-300ms.png
    02-1s.png
    03-2s.png
    04-stable.png
    mobile-*.png
  truth/
    expected.md
    provider-evidence.json
```

The exact implementation may evolve, but the evidence must identify:
- run ID;
- lens;
- exact SHA/deployment;
- scenario;
- browser/viewport;
- account type;
- timestamps;
- expected vs actual;
- screenshots;
- timings;
- browser/runtime errors;
- provider truth for fidelity findings.

---

# Finding and issue rules

Open a GitHub issue when a reproducible defect is likely to cause:
- wrong passenger action;
- missed/risky connection or appointment;
- stale/unknown data presented as current;
- lost work;
- duplicate action;
- stuck flow;
- unexplained waiting;
- need for refresh/reload to reconcile;
- unclear primary action;
- material accessibility/mobile failure;
- visibly broken/inconsistent UI;
- runtime/browser error affecting confidence.

Default categories:

- `traveller-truth`
- `functional`
- `reactivity`
- `ux`
- `ui-visual`
- `performance`
- `accessibility`
- `observability`

Suggested severity:

- **P0** — dangerous/systemic passenger-truth failure or severe data/security loss
- **P1** — core task/trust failure; wrong guidance, blocked flow, stale guidance requiring manual recovery
- **P2** — meaningful friction, responsive/accessibility defect, substantial visual quality problem
- **P3** — polish/inconsistency with limited task impact

Do not bundle independent P1/P0 behavioural or truth defects into a cosmetic mega-issue.

## Issue evidence

Include:
- run ID/lens;
- mission;
- environment + exact SHA/deployment;
- viewport/browser;
- steps;
- expected;
- actual;
- timing;
- screenshot/log/replay evidence;
- provider truth where relevant;
- traveller consequence;
- reproducibility;
- severity rationale.

---

# Pass criteria

Do not output one vague "PASS".

Report lens verdicts separately.

### UI pass
No unresolved in-scope visual defect that materially reduces polish, hierarchy, clarity, responsive fit or interface coherence.

### UX pass
The traveller can complete the mission without hidden workarounds, unexplained waits, refresh-to-fix behaviour, contradictory state or avoidable confusion.

### Fidelity pass
Passenger-facing facts, derived timings and consequences agree with authoritative truth within documented provider/rounding constraints; unknown/stale information remains honestly represented.

### All pass
UI + UX + fidelity each pass independently, with no unexplained browser/runtime errors in the tested flow.

---

# Final report format

Keep the final report compact but evidence-led:

```text
Run: KQA-...
Build: <sha> / <deployment>
Mission: ...
Lens: UI | UX | Fidelity | All

Result
UI: PASS / FINDINGS
UX: PASS / FINDINGS
Fidelity: PASS / FINDINGS

What I actually exercised
...

Key findings
1. ...
2. ...

Evidence
- screenshots/timings
- browser errors
- PostHog/Sentry/Vercel evidence
- provider truth sources

Issues opened
#...

Not exercised / limitations
...
```

Never hide tool limitations. A read-only browser inspection is not an interactive E2E pass.

---

# Khonsera standing principle

A test is not complete because the application eventually reached the right page.

For meaningful frontend behaviour, prove:

`the user acts -> Khonsera visibly responds -> dependent state reconciles -> the result is understandable -> the result is true`.

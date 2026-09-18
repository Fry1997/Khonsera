# Synthetic Traveller QA Protocol

## Purpose

Khonsera must be tested as a travel product, not only as a codebase.

A green build, passing unit tests, a valid provider response, or a rendered page is not sufficient evidence that a traveller can understand and use the product under time pressure. This protocol adds a traveller-led frontend gate on top of the existing unit, integration, Playwright, accessibility, Lighthouse, provider-truth and production-build checks.

The question for every meaningful release is:

> Can a new traveller complete a realistic travel day, understand what Khonsera is telling them, recover when conditions change, and trust the result without needing to understand the implementation?

## Test identities and data safety

### Isolated destructive traveller

For CI and any flow that creates, edits or deletes application data:

- use the local isolated Supabase environment;
- create a unique throwaway Auth user for each run;
- confirm that user;
- elevate only that local user when the pre-release staff gate requires it;
- use synthetic itinerary data only;
- delete the user after the run;
- never use production service-role credentials, production users, real itineraries or real customer data.

This is the role already used by `tests/e2e/authenticated.spec.ts` and `tests/e2e/traveller-experience.spec.ts`.

### Hosted synthetic traveller

For Vercel Preview and production smoke tests, use a dedicated synthetic account only when it has been provisioned through the supported application/Auth path.

The hosted account must:

- be unmistakably labelled as synthetic/test data;
- contain no real person's personal or travel information;
- never be used to test destructive billing, messaging or irreversible third-party actions;
- be excluded from product analytics used for business decisions where possible;
- be safe to reset.

Until a supported hosted test account exists, production/preview checks remain non-destructive and must not manufacture users by directly editing `auth.users` or bypassing normal Auth controls.

## Core personas

Each release does not need every persona, but material changes should select the persona most likely to expose the risk.

### A. New traveller

A first-time user who has never seen Khonsera.

Primary questions:

- Is sign-up understandable?
- Is onboarding clear?
- Can they work out what to do next without prior product knowledge?
- Do empty states explain the product rather than merely report that nothing exists?

### B. Working day traveller

A user travelling to a meeting with a hard arrival time.

Scenario shape:

- home → station;
- rail leg with a change;
- walk/taxi to appointment;
- fixed arrival requirement;
- return journey later the same day.

Primary questions:

- Is the leave-by time obvious?
- Is the next action obvious?
- Are buffers and consequences comprehensible?
- Does the product reduce arithmetic rather than expose more of it?

### C. Disrupted traveller

The same day with one material disruption:

- delay;
- cancellation;
- changed platform;
- live data unavailable;
- connection becomes tight or impossible.

Primary questions:

- Does booked information disappear when it is no longer trustworthy?
- Is uncertainty explicit?
- Is the consequence explained in passenger language?
- Is replanning actionable?
- Does stale information ever look current?

### D. Multimodal traveller

A journey containing at least three modes, for example drive/taxi → rail → walk.

Primary questions:

- Are mode changes visually and conceptually clear?
- Are transfer buffers represented correctly?
- Does the plan still feel like one journey rather than unrelated cards?

### E. Low-connectivity traveller

A normal journey under delayed, failed or intermittent network requests.

Primary questions:

- Does the UI retain orientation?
- Are loading states meaningful?
- Do failures preserve the last known trustworthy state?
- Can the traveller distinguish "unknown" from "on time"?

## Mandatory frontend layers

### 1. Public entry and Auth

Exercise:

- landing page;
- login;
- signup;
- forgot/reset password;
- invalid credentials;
- validation errors;
- successful sign-in;
- sign-out;
- refresh while authenticated;
- refresh while signed out;
- deep-link to a protected route while signed out;
- browser back/forward around Auth transitions.

Review:

- field labels and keyboard behaviour;
- password manager/autofill compatibility;
- useful errors without leaking account existence unnecessarily;
- focus placement after validation;
- no dead-end states.

### 2. Onboarding and empty account

A brand-new synthetic account must be inspected before demo data is enabled.

Exercise:

- first authenticated landing;
- empty Today;
- empty Plan;
- any welcome/setup flow;
- mode choice if applicable;
- first saved place/fact where supported.

Review whether a first-time user understands:

- what Khonsera expects from them;
- what it will do in return;
- where to start;
- what is optional.

### 3. Plan creation and editing

Exercise the real UI for:

- creating a plan;
- adding timed and untimed items;
- adding rail/movement legs where supported;
- editing time/location/details;
- deleting/cancelling an item;
- reordering/automatic ordering;
- saving and returning later;
- page refresh after save;
- browser back/forward after edits;
- duplicate submission/double-click resistance.

Test awkward inputs:

- same start/end time;
- item spanning midnight;
- very long names;
- missing optional fields;
- invalid dates/times;
- overlapping commitments;
- short connection;
- no feasible connection.

### 4. Today

Test at least:

- empty day;
- future day;
- active calm day;
- imminent departure;
- disrupted day;
- completed/past items.

For each state, first inspect only the first viewport.

A traveller should immediately be able to answer:

1. What should I do next?
2. When do I need to do it?
3. Where am I going?
4. Is anything wrong?
5. What happens if the current plan fails?

If the first viewport cannot answer those questions, treat it as an experience defect even if the data below the fold is correct.

### 5. Live travel trust

For rail/live-provider work use:

> authoritative provider truth → Khonsera parsing/normalisation → passenger-facing UI → consequence/replanning behaviour

Inject and verify:

- on time;
- delayed;
- platform change;
- cancelled;
- provider says platform is unavailable;
- provider unavailable;
- timeout;
- stale response;
- conflicting booked and live values.

Rules:

- unknown must remain unknown;
- stale must not look live;
- booked data must not masquerade as current live data;
- a changed platform must replace, not merely sit beside, the stale booked platform;
- disruption must propagate to connection/consequence messaging.

### 6. Navigation and orientation

Exercise navigation through visible controls, not only direct URLs.

Verify:

- Today → Plan → Navigate → Today;
- all primary shell destinations;
- Work/Personal mode transitions where applicable;
- browser back and forward;
- direct deep links;
- reload on each primary route;
- opening a route in a new tab where meaningful;
- mobile bottom-nav behaviour;
- current-location indication.

A user must never need to remember where they came from to understand the current screen.

### 7. Overlays and transient UI

Exercise:

- ticket reveal;
- modals;
- sheets/drawers;
- menus;
- toasts;
- destructive confirmations;
- loading indicators.

Verify:

- open/close latency;
- focus moves into the overlay and returns correctly;
- Escape/back behaviour where appropriate;
- background is not accidentally interactive;
- mobile viewport does not crop the primary action.

### 8. Failure and recovery

Fault-inject representative calls:

- 3-second latency;
- request timeout;
- HTTP 500;
- HTTP 429;
- offline/network failure;
- malformed optional provider data.

Verify:

- no blank page;
- no unhandled browser error;
- no infinite spinner;
- retry/recovery path where useful;
- last trustworthy state is distinguishable from current truth;
- the user can continue using unrelated parts of the app.

## Performance budgets

These are experience ceilings, not micro-benchmarks. Regressions within the ceiling still deserve investigation when a previously fast action becomes noticeably slower.

Existing traveller audit budgets remain:

- login → useful Today: < 4 s;
- authenticated cold Today → useful state: < 3 s;
- Today → Plan: < 2 s;
- Plan → Navigate: < 2 s;
- Navigate → Today: < 2 s;
- ticket reveal: < 1 s.

Additionally record where practical:

- TTFB;
- DOMContentLoaded;
- first paint;
- first contentful paint;
- Core Web Vitals;
- time until the first traveller-useful instruction is visible;
- long tasks or visibly blocked input.

Any wait longer than roughly 300 ms should provide visible feedback when the user has initiated an action.

## Responsive and visual coverage

Minimum release evidence:

- desktop Chromium at a normal laptop width;
- mobile Chromium at 390 px;
- real-browser inspection in Opera for the hosted Preview when available.

Material layout changes should additionally inspect:

- narrow mobile around 360 px;
- tablet around 768 px;
- large desktop.

Verify:

- no horizontal overflow;
- no clipped primary actions;
- no text collisions;
- touch targets remain usable;
- fixed navigation does not cover content;
- keyboard focus is visible;
- important travel status is not communicated only by colour.

## Accessibility

Run automated WCAG A/AA checks and manually inspect:

- semantic headings;
- labelled controls;
- keyboard-only completion of primary flows;
- focus order;
- dialog focus management;
- error announcement;
- contrast;
- zoom/text enlargement on critical screens.

Serious or critical automated violations are release blockers.

## Browser/runtime cleanliness

Every traveller run records:

- uncaught page errors;
- console errors;
- failed critical network requests;
- redirect loops;
- hydration errors;
- duplicate submissions;
- obvious stale-cache behaviour.

A release is not clean if the UI "works" while the browser is emitting unexplained errors.

## Observability evidence

For a hosted Preview or production smoke:

### PostHog

Verify that the browser visit creates the expected pageview/session data in the correct project.

Where session replay is enabled:

- confirm form inputs remain masked;
- never use real personal or travel data to test replay;
- synthetic/test traffic should be distinguishable or excluded from business reporting.

### Sentry

Once authenticated Sentry access and deployment credentials are provisioned:

- verify release creation/source maps;
- trigger only a deliberate safe test error;
- confirm the event is received in the correct environment/release;
- confirm the stack is source-mapped;
- confirm no sensitive input is attached.

### Vercel

Check:

- deployment READY;
- release commit;
- aliases;
- runtime errors;
- relevant runtime logs after the browser walkthrough.

Observability is evidence, not a substitute for reproducing the UI.

## Real-browser review with Opera

The Opera Browser Connector is used as an additional hosted-browser evidence source.

Current supported actions are navigation, page/accessibility-tree inspection, screenshot capture, history, tab management and page reads. It currently does not provide click/type actions through this integration.

Therefore:

- use Opera to inspect the real hosted Preview/production render;
- navigate directly between routes when interaction is not required;
- capture screenshots/accessibility structure for visual/orientation review;
- do not claim an interaction was tested in Opera when the connector could not perform it;
- use Playwright for interactive/destructive flows until browser click/type automation is available;
- when Opera gains interaction controls, add a hosted synthetic traveller walkthrough rather than replacing Playwright.

## Evidence bundle

A meaningful frontend PR should leave enough evidence that another engineer can understand what was actually tested.

Attach or retain:

- exact commit SHA;
- environment/deployment URL;
- selected persona/scenario;
- desktop screenshot;
- mobile screenshot;
- disrupted-state screenshot when relevant;
- traveller-audit JSON/performance output when relevant;
- browser-console/runtime error result;
- provider fixture or authoritative source used for travel-data work;
- PostHog/Sentry/Vercel confirmation where relevant;
- issue links for every accepted defect.

"Build passed" is not sufficient evidence.

## Defect severity

### P0 — unsafe or destructive

Examples:

- exposes another user's data;
- gives passenger guidance that can reasonably direct them onto the wrong service;
- destructive action without meaningful confirmation/recovery;
- Auth/access-control bypass.

Blocks release.

### P1 — traveller trust or task failure

Examples:

- cannot sign in or complete a core flow;
- stale/unknown travel data is presented as current fact;
- disruption consequence is materially wrong or hidden;
- primary action is unusable on a supported viewport;
- major route produces a runtime error.

Blocks release unless explicitly isolated from the release.

### P2 — meaningful friction

Examples:

- confusing hierarchy;
- sluggish transition;
- poor recovery messaging;
- back/refresh loses orientation;
- important action is unnecessarily hard to find.

Should normally be fixed before broad release; may be separately tracked for a narrow change.

### P3 — polish

Examples:

- minor spacing;
- wording refinement;
- non-blocking visual inconsistency.

Track when reproducible.

## Issue format

Every issue raised from traveller QA should include:

- scenario/persona;
- environment and commit;
- starting state;
- exact actions;
- expected traveller understanding/behaviour;
- observed result;
- screenshot/video/evidence;
- console/network/runtime evidence if relevant;
- reproducibility;
- severity;
- whether provider truth, parsing, UI or consequence logic is the failing layer.

Avoid issues that only say something "feels wrong" without preserving the evidence that produced that judgement.

## Release gate

For a meaningful frontend or travel-behaviour change, the preferred release sequence is:

1. read the affected code;
2. reproduce the current product behaviour;
3. identify authoritative provider truth where relevant;
4. make the smallest coherent change;
5. run unit/integration tests;
6. run authenticated Playwright;
7. run the synthetic traveller audit;
8. inspect desktop and mobile visual evidence;
9. inspect the hosted Preview in a real browser;
10. verify console/network/runtime cleanliness;
11. verify observability where configured;
12. run production build;
13. merge only with evidence attached;
14. deploy exact validated SHA;
15. perform a non-destructive production smoke;
16. inspect post-release runtime/observability.

A release can pass automated assertions and still fail this gate if the traveller experience is confusing, misleading, slow or untrustworthy.

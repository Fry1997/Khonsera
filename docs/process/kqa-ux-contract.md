# Khonsera QA:UX execution contract

This file is the standing execution contract for `QA:UX` commands.

## Command

`QA:UX KQA-UX-001`

This is an executable adaptive QA command, not a fixed Playwright test case.

The ChatGPT/GitHub integration records the command on the permanent QA Control issue. The `QA Observatory` workflow treats the authorised control comment as the trigger and launches an adaptive browser pilot.

Manual `workflow_dispatch` remains available as a fallback.

## The important distinction

`QA:UX` is exploratory passenger QA.

The pilot must observe the rendered screen, reason about what a traveller would do next, act through the visible UI, inspect the changed screen, and adapt. A different label, layout, control type or navigation path is not itself a test failure.

Playwright remains underneath the pilot to provide a real Chromium browser, mouse/keyboard execution, video, trace, screenshots and browser/network instrumentation. Playwright does **not** prescribe the sequence of selectors for `QA:UX`.

Rigid selector-driven flows belong in regression tests after a behaviour has been discovered and understood.

## KQA-UX-001 boundary

KQA-UX-001 is a production-experience test.

It must:

- exercise the currently deployed Khonsera front end at `https://www.khonsera.com`;
- use the live Khonsera Supabase project through a dedicated persistent QA traveller;
- behave through the passenger-facing UI wherever a traveller would;
- observe the current screen before deciding what to do next;
- recover from ordinary UI variation as a human traveller would;
- use real application/provider behaviour rather than replacing rail responses with deterministic mocks;
- preserve the QA traveller and the data produced by the run by default;
- record desktop and mobile evidence when the command requests both viewports;
- distinguish a product blocker from a runner/infrastructure failure.

It must not:

- start the isolated CI Supabase fixture;
- create and delete a throwaway traveller around each run;
- force demo mode;
- mock Darwin or other travel providers merely to make the scenario deterministic;
- treat an unexpected label or DOM structure as a product failure;
- use developer APIs, hidden application state or direct database writes to complete the traveller mission;
- use, import or expose real passenger/personal data in public Observatory evidence.

Unknown, stale, unavailable or contradictory travel information is itself evidence. Do not convert it into invented certainty for the sake of a passing run.

## Adaptive pilot

The Observatory uses OpenAI computer use with a persistent Playwright browser.

The loop is:

`current screenshot → model reasoning → mouse/keyboard actions → updated screenshot → reassess`

The model is given a traveller goal, constraints and QA heuristics rather than a list of selectors. It can scroll, click, type, use keyboard controls, wait for UI changes and recover when the interface differs from expectation.

The runner is bounded by a maximum turn count, action count and wall-clock duration. It is restricted to Khonsera navigation and stops rather than acknowledging a computer-use safety handoff automatically.

The repository requires an `OPENAI_API_KEY` GitHub Actions secret to run the adaptive pilot. That secret is never written to artifacts, release evidence or the repository.

## QA identity

The persistent QA traveller is provisioned through Supabase Auth and approved for the current closed-access application gate.

The Observatory workflow authenticates to a tightly scoped Supabase Edge Function with GitHub Actions OIDC. The function accepts only the Khonsera repository's QA Observatory workflow and issues a fresh one-time Auth link for the dedicated QA traveller.

No reusable QA password or Supabase service-role credential is stored in the repository or GitHub Actions.

The one-time Auth URL is consumed in a separate unrecorded browser context. The resulting Supabase SSR cookies are moved into the recorded traveller context, and the token-bearing URL is never recorded.

Khonsera's first-run welcome state is currently cookie-based, so the returning synthetic traveller context is seeded with the normal `khonsera_welcomed=1` cookie before recording.

## Data policy

The QA account is deliberately persistent.

Plans, places, preferences, odd states and prior test history created by QA should remain attached to that user. This lets later runs encounter accumulated state a real long-lived traveller would have.

Cleanup is selective, not automatic. Delete or reset QA data only when:

- a fix specifically requires a clean retest;
- accumulated test data makes the target condition impossible to reproduce; or
- pre-launch hygiene requires a deliberate reset.

Never clean data simply to make a run look tidy.

## KQA-UX-001 traveller mission

The pilot is given a mission, not a click script:

- enter the authenticated production Today experience;
- create a dated travel day;
- add a fixed project-review commitment;
- add a Wellingborough → Harpenden rail journey with a deliberately tight Luton change;
- return to Today;
- assess whether the passenger experience is clear, useful, fast and trustworthy.

If the UI takes a different route to accomplish those goals, the pilot should use it. If a confusing state is recoverable, the pilot records the friction and continues. It declares the mission blocked only when the product genuinely prevents progress after reasonable UI attempts.

Re-runs may encounter prior KQA plans because synthetic data is intentionally persistent.

## Evidence

Adaptive Observer mode records:

- Playwright video;
- Playwright trace;
- start/final screenshots plus per-turn screenshots in the workflow artifact;
- a JSONL action log containing each computer-use action and URL transition;
- a structured adaptive pilot report containing outcome, findings and what worked;
- console/page errors, failed requests, HTTP 5xx responses and slow network responses;
- turn/action timing and total duration;
- the workflow result and commit.

Evidence is published as a GitHub prerelease and appears automatically in the GitHub Pages QA Observatory.

The Observatory status is near-live: it can show queued/running/completed while the workflow executes. Video, trace and reports become available after evidence publication. It is replay/forensics, not a live VNC stream.

## Findings

Product findings come from the pilot's observed UI experience and technical browser signals.

Medium/high adaptive findings are published to GitHub as separate issues. If an issue with the same KQA title is already open, a later run adds new evidence to that issue instead of creating a duplicate.

A product blocker is a valid QA result and does not mean the adaptive runner itself failed. The workflow only fails its infrastructure gate when the browser/model/auth/evidence machinery cannot conduct the QA run.

For meaningful defects:

1. preserve the actual product evidence;
2. link the Observer run/release;
3. describe passenger impact and UI reproduction;
4. fix the smallest coherent cause;
5. add a deterministic regression test where the defect merits permanent protection;
6. retest with adaptive QA when passenger experience matters.

The QA Control issue is only a command bus. Product defects do not live there.

## Relationship to normal CI

Normal pull-request CI remains isolated and deterministic.

The ordinary `Validate` workflow may continue to use its local Supabase fixture and mocked/stubbed provider boundaries where appropriate for regression testing.

The old selector-driven KQA scenario is retained only as regression reference/protection. It is not the `QA:UX` execution engine.

That is separate from adaptive `QA:UX`, whose purpose is to explore the real passenger experience and adjust to the product that is actually on screen.

# Khonsera QA:UX execution contract

This file is the standing execution contract for `QA:UX` commands.

## Command

`QA:UX KQA-UX-001`

This is an executable QA command, not merely a test-case label.

The ChatGPT/GitHub integration records the command on the permanent QA Control issue. The `QA Observatory` workflow treats the authorised control comment as the trigger and runs the scenario.

Manual `workflow_dispatch` remains available as a fallback.

## KQA-UX-001 boundary

KQA-UX-001 is a production-experience test.

It must:

- exercise the currently deployed Khonsera front end at `https://www.khonsera.com`;
- use the live Khonsera Supabase project through a dedicated persistent QA traveller;
- behave through the passenger-facing UI wherever a traveller would;
- use real application/provider behaviour rather than replacing rail responses with deterministic mocks;
- preserve the QA traveller and the data produced by the run by default;
- record desktop and mobile evidence when the command requests both viewports.

It must not:

- start the isolated CI Supabase fixture;
- create and delete a throwaway traveller around each run;
- force demo mode;
- mock Darwin or other travel providers merely to make the scenario deterministic;
- use, import, or expose real passenger/personal data in public Observatory evidence.

Unknown, stale, unavailable, or contradictory travel information is itself evidence. Do not convert it into invented certainty for the sake of a passing run.

## QA identity

The persistent QA traveller is provisioned through Supabase Auth.

The Observatory workflow authenticates to a tightly scoped Supabase Edge Function with GitHub Actions OIDC. The function accepts only the Khonsera repository's QA Observatory workflow and issues a fresh one-time Auth link for the dedicated QA traveller.

No reusable QA password or Supabase service-role credential is stored in the repository or GitHub Actions.

The one-time Auth URL is consumed in a separate unrecorded Playwright browser context before the recorded traveller context begins, so the public trace/video does not contain the login token.

## Data policy

The QA account is deliberately persistent.

Plans, places, preferences, odd states and prior test history created by QA should remain attached to that user. This lets later runs encounter the accumulated state a real long-lived traveller would have.

Cleanup is selective, not automatic. Delete or reset QA data only when:

- a fix specifically requires a clean retest;
- accumulated test data makes the target condition impossible to reproduce; or
- pre-launch hygiene requires a deliberate reset.

Never clean data simply to make a run look tidy.

## KQA-UX-001 traveller scenario

The first production UX scenario establishes a time-sensitive travel day through the real product:

1. enter the authenticated production Today experience;
2. move through the real shell to Plan;
3. create a dated plan;
4. add a fixed commitment;
5. add a rail journey with a deliberately tight change at Luton;
6. return to Today and inspect what Khonsera communicates;
7. collect timings, visible first-viewport content, console/page errors, failed requests and HTTP 5xx responses.

The scenario intentionally creates durable QA data. Re-runs may therefore encounter prior KQA plans.

## Evidence

Observer mode records:

- Playwright video;
- Playwright trace;
- full-page screenshots at meaningful states;
- structured timing/browser-signal metrics;
- the workflow result and commit.

Evidence is published as a GitHub prerelease and appears automatically in the GitHub Pages QA Observatory.

The Observatory status is near-live: it can show queued/running/completed while the workflow executes. Video, trace and screenshots become available when the workflow publishes the evidence.

## Findings

A failing automated assertion is evidence, not permission to weaken the test.

For meaningful UX/product defects:

1. reproduce from the actual product evidence;
2. create a separate GitHub issue;
3. link the Observer run/evidence;
4. describe passenger impact and reproduction steps;
5. fix the smallest coherent cause;
6. retest against the appropriate environment.

The QA Control issue is only a command bus. Product defects do not live there.

## Relationship to normal CI

Normal pull-request CI remains isolated and deterministic.

The ordinary `Validate` workflow may continue to use its local Supabase fixture and mocked/stubbed provider boundaries where appropriate for regression testing.

That is separate from `QA:UX`, whose purpose is to observe the real passenger experience.

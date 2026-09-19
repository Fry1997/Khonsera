# Khonsera QA:UX execution contract

This file is the standing execution contract for `QA:UX` commands.

## Command

`QA:UX KQA-UX-001`

This is an executable exploratory QA command, not a fixed Playwright test case.

The ChatGPT/GitHub integration records the command on the permanent QA Control issue. The `QA Observatory` workflow starts a long-lived production Chromium session and exposes it through a deliberately dumb browser relay.

## Execution model

The intelligence stays in the active ChatGPT conversation.

The loop is:

`browser screenshot → ChatGPT inspects/reasons → QA:DO mechanical command → Playwright executes → new screenshot/state → ChatGPT reassesses`

The relay understands only mechanical browser actions such as click, double-click, type, keypress, scroll, wait, screenshot, same-site goto and finish. It does not know what a station field, Plan button or journey editor is.

That distinction is intentional: exploratory QA must not fail because a pre-written selector, label or DOM assumption changed.

Playwright supplies Chromium, mouse/keyboard execution, video, trace, screenshots and browser/network instrumentation. ChatGPT decides what a traveller should do from the screen that actually exists.

No OpenAI API key or separate model API billing is required. A QA:UX session does require an active ChatGPT conversation to pilot it.

## KQA-UX-001 boundary

KQA-UX-001 is a production-experience test.

It must:

- exercise the deployed Khonsera front end at `https://www.khonsera.com`;
- use the live Khonsera Supabase project through the dedicated persistent QA traveller;
- behave through the passenger-facing UI wherever a traveller would;
- inspect the current screen before choosing the next action;
- recover from ordinary UI variation as a human traveller would;
- preserve QA-created data by default;
- record evidence for the requested viewport(s);
- distinguish product blockers from relay/infrastructure failures.

It must not:

- start the isolated CI Supabase fixture;
- create/delete a throwaway traveller around each run;
- force demo mode;
- mock travel providers to manufacture a passing result;
- treat an unexpected label or DOM structure as a product failure;
- use direct database writes or hidden application state to complete the traveller mission;
- introduce real passenger/personal data into public QA evidence.

## Control channel

Issue #90 is the start command bus only.

A normal command:

`QA:UX KQA-UX-001`

starts the workflow.

Once the workflow has a run ID it creates a dedicated control branch:

`qa-control-<workflow-run-id>`

and seeds:

`qa-control/command.json`

For each active viewport the relay resets that file to sequence 0 and waits. The controlling ChatGPT conversation updates the file with an incrementing sequence number and one mechanical command at a time.

Example:

```json
{
  "runId": "35393789105",
  "viewport": "desktop-chromium",
  "sequence": 4,
  "command": { "type": "click", "x": 312, "y": 744 }
}
```

Supported command types are:

- `click`
- `double_click`
- `move`
- `type`
- `fill` — set the value of the focused standard form control (including native date/time inputs)
- `keypress`
- `scroll`
- `wait`
- `goto` (restricted to Khonsera)
- `screenshot`
- `finish`
- `abort`

The relay accepts only a command matching its exact run ID and active viewport, and only when the sequence number increases. Stale commands are ignored.

The control branch deliberately does not trigger QA workflows or CI. This prevents every mouse click from creating a fake/skipped Actions run.

## Live screen

Each workflow run owns a temporary-style branch named:

`qa-live-<workflow-run-id>`

The branch is updated after every browser command and contains:

- `qa-live/current.png` — latest rendered browser screen;
- `qa-live/state.json` — current URL, viewport, command count, recent browser/network signals and last action.

The GitHub Pages Observatory reads those files while the run is active, so a user can refresh and watch the screen advance without waiting for final evidence publication.

The branch contains QA-only synthetic state. Final replay evidence is still published separately after the run.

## QA identity

The persistent QA traveller is provisioned through Supabase Auth and approved for the current closed-access gate.

The Observatory workflow authenticates to a tightly scoped Supabase Edge Function with GitHub Actions OIDC. It mints a fresh one-time Auth link for the dedicated QA traveller.

The token-bearing URL is consumed in a separate unrecorded browser context. The resulting Supabase SSR cookies are copied into the recorded traveller context.

Khonsera's first-run welcome state is currently cookie-based, so the returning QA context is seeded with the normal `khonsera_welcomed=1` cookie before recording.

No reusable QA password or Supabase service-role credential is stored in GitHub.

## Data policy

The QA account is deliberately persistent.

Plans, places, preferences, odd states and prior test history created by QA remain attached to that account unless a specific retest requires selective cleanup.

Do not reset synthetic history merely to make a run tidy.

## KQA-UX-001 traveller mission

The active ChatGPT conversation pilots the traveller toward these goals:

- enter authenticated Today;
- create a dated travel day;
- add a fixed project-review commitment;
- add Wellingborough → Harpenden rail travel with a deliberately tight Luton change;
- return to Today;
- assess whether the resulting passenger experience is clear, useful, fast and trustworthy.

The mission defines intent, not the click path.

If the UI takes a different route, ChatGPT should use it. If a confusing state is recoverable, record the friction and continue. Declare the mission blocked only when the product genuinely prevents progress after reasonable attempts.

## Evidence

The relay records:

- Playwright video;
- Playwright trace;
- a screenshot after every command;
- a JSONL action log;
- final relay result and controller-supplied outcome/summary;
- console/page errors;
- failed requests;
- HTTP 5xx responses;
- slow responses;
- blocked external-navigation attempts;
- the workflow result and commit.

Final evidence is published as a GitHub prerelease and appears in the QA Observatory.

## Findings

The controlling ChatGPT conversation reviews the actual UI evidence and creates GitHub issues for meaningful product defects. The QA Control issue remains only the command/control channel.

Once exploratory QA discovers an important defect or invariant, encode that specific behaviour as deterministic regression coverage where appropriate.

## Relationship to normal CI

Normal pull-request CI remains isolated and deterministic.

The ordinary `Validate` workflow may continue to use its local Supabase fixture and deterministic Playwright tests.

That suite answers: “did a known behaviour regress?”

`QA:UX` answers: “what happens when an intelligent traveller uses the product that is actually on screen?”

They are complementary and should remain separate.

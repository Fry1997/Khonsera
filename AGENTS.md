# Khonsera agent operating contract

Khonsera is a user-facing travel product. Do not infer that a UI works from source code or a green build.

## Before changing code

- Read the affected route, shared components and relevant tests before editing.
- Preserve existing product decisions unless the task explicitly reopens them; consult `DECISIONS.md` and `CLAUDE.md` for historical context.
- Never invent credentials or commit secrets.

## Required verification

For ordinary code changes run typecheck, unit tests and a production build. For user-facing changes also run the Playwright browser suite.

Then inspect the affected route in a real browser at desktop and mobile sizes. Use a Vercel Preview URL when available. Check visual state, loading state, console/page errors, navigation, interaction and horizontal overflow. Browser evidence outranks assumptions from CSS or JSX.

Use Lighthouse as the performance/accessibility baseline.

## Observability

- Sentry owns unexpected application errors and traces.
- PostHog owns product behaviour/session evidence.
- Vercel provides deployment, runtime, Analytics and Speed Insights evidence.
- Do not add sensitive personal/travel content to analytics event properties.
- Never disable an observability or browser test merely to make a change appear green; fix the underlying problem or document a deliberate temporary exception.

## Database safety

Use migrations for schema changes. Review RLS whenever a public schema/table changes. Do not assume debug/internal tables are safe for browser roles merely because they already exist.

## UI completion standard

A UI task is complete only when implementation, browser behaviour and responsive presentation agree. At minimum verify the target flow in desktop Chromium and the 390px mobile Chromium viewport and leave no unexplained browser console errors.

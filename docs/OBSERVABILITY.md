# Khonsera observability and browser verification

Khonsera should not be treated as correct because it compiles. The recovery workflow requires evidence from the running product.

## Responsibilities

| Tool | Primary job | Do not use it as |
| --- | --- | --- |
| Sentry | Runtime exceptions, request errors, source-mapped stack traces, performance traces | Product analytics or session replay |
| PostHog | Product analytics, funnels, behaviour and session replay | Exception tracker |
| Vercel Analytics | Lightweight traffic/Web Analytics | Detailed product behaviour |
| Vercel Speed Insights | Real-user web performance | Synthetic browser test runner |
| Playwright | Repeatable interaction, responsive and navigation verification | Production monitoring |
| Axe + Playwright | Automated WCAG regression checks | A replacement for manual accessibility review |
| Lighthouse CI | Synthetic performance/accessibility/best-practice budgets | Real-user performance data |
| Vitest | Unit and integration behaviour | Browser/visual verification |

## Environment variables

All integrations are optional at build/runtime. Missing observability credentials must never make Khonsera unavailable.

### Sentry

- `NEXT_PUBLIC_SENTRY_DSN` — project DSN; safe to expose to the browser.
- `SENTRY_ORG` — Sentry organisation slug used for source-map upload.
- `SENTRY_PROJECT` — Sentry project slug used for source-map upload.
- `SENTRY_AUTH_TOKEN` — build secret used for source-map upload. Never expose with `NEXT_PUBLIC_` and never commit it.

Sentry intentionally has session replay disabled in Khonsera. PostHog owns replay so the same user session is not recorded twice.

### PostHog

- `NEXT_PUBLIC_POSTHOG_KEY` — project key. When absent PostHog stays dormant.
- `NEXT_PUBLIC_POSTHOG_HOST` — defaults to the EU ingest endpoint.

Product events should be named around user intent rather than UI implementation, for example `plan_created`, not `green_button_clicked`.

### Browser verification

- `PLAYWRIGHT_BASE_URL` — optional deployed URL. When supplied, Playwright tests that environment instead of launching a local server.

The Playwright projects include desktop Chromium and a 390x844 mobile viewport because 390 CSS px is Khonsera's documented mobile acceptance width.

## Definition of done for product changes

A product-facing change is not complete until:

1. Typecheck and Vitest pass.
2. A production build succeeds.
3. Relevant Playwright flows pass at desktop and 390px mobile.
4. Serious/critical Axe violations are absent on touched public surfaces.
5. Browser console/page errors introduced by the change are resolved.
6. Lighthouse budgets do not materially regress.
7. A Vercel Preview is opened and exercised when the change depends on real integrations or authenticated state.
8. After release, Sentry and PostHog are checked for failures or unexpected behaviour.

## Agent workflow

When Astra/Codex changes Khonsera, prefer this loop:

1. Inspect the affected code and existing tests.
2. Run the product in a browser; do not infer UI correctness from JSX/CSS.
3. Reproduce the behaviour before editing where possible.
4. Make the smallest coherent change.
5. Run unit/type/build checks.
6. Run Playwright and inspect failure screenshots/traces rather than guessing.
7. Use the Vercel Preview for real-environment checks.
8. Check Sentry for runtime regressions and PostHog for behavioural regressions after deployment.

## Security note

The observability bootstrap exposed existing npm audit findings, including high and critical advisories. Do not run `npm audit fix --force` automatically: it can introduce breaking dependency upgrades. Treat dependency remediation as a separate reviewed task, prioritising exploitable production/runtime paths first.

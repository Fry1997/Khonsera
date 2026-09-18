# Khonsera testing

## Browser verification

The CI browser job has two responsibilities:

1. prove the application builds and renders in Chromium at desktop and 390px mobile widths;
2. exercise authenticated surfaces through real Supabase Auth without using production users or production data.

### Authenticated E2E isolation

The authenticated Playwright suite starts a local Supabase stack inside the GitHub Actions runner. It deliberately swaps the app migration directory for `tests/e2e/fixtures/0001_e2e_schema.sql` before startup.

That fixture is intentionally small. It reproduces the Auth/profile/workspace/RLS contract plus the read tables needed by the authenticated surfaces under test. Playwright creates a throwaway local Auth user, elevates only that local user to the pre-release staff gate, signs in through the real `/login` form and deletes the user after the run.

The Today test uses Khonsera's existing staff demo mode (`journies_demo_mode`) so journey data is deterministic and synthetic. Successful desktop and mobile runs retain full-page screenshots in the `browser-verification-*` GitHub Actions artifact.

No production Supabase key, production user, production itinerary or production database mutation is required by these tests.

## Production migration reproducibility

The E2E fixture must not be mistaken for a production schema baseline. During setup of authenticated CI, a clean `supabase start` against the committed application migrations failed because the remote production schema and the Git migration directory have drifted. That recovery problem is tracked separately and should eventually be resolved by reconciling the remote migration ledger/schema with Git and proving a clean `supabase db reset` succeeds.

Do not expand the E2E fixture into a second copy of the entire production schema. Add only the contract needed for a browser flow under test; repair the canonical application migration history separately.


## Production QA:UX Observatory

The deterministic CI browser suite above is not the same thing as the production passenger-experience audit.

Production `QA:UX` runs use the deployed Khonsera front end, a dedicated persistent QA traveller in live Supabase, and the GitHub Pages QA Observatory for browser evidence. They must not be silently substituted with the isolated CI fixture or demo-mode data.

`QA:UX` is adaptive exploratory QA, not a fixed selector script. The active ChatGPT conversation inspects the current browser screenshot, decides the next traveller action, and sends only mechanical commands to a long-lived Playwright relay. The relay clicks/types/scrolls, republishes the screen, and waits for the next instruction. No model API runs inside GitHub Actions.

Deterministic Playwright remains valuable for regression protection. Once exploratory QA exposes a defect or important invariant, encode that specific behaviour as a regression test rather than turning the exploratory pilot back into a brittle script.

The standing execution, safety and data-boundary rules live in [`docs/process/kqa-ux-contract.md`](./process/kqa-ux-contract.md).

# for-design.zip — Code → Design: the new public landing + waitlist

**One thing this round.** `/` has been rebuilt from a sign-in splash into the **public marketing
front door** — what Khonsera is, a waitlist to capture interest, the app gated behind login at
`/today`. It's **live and Code-built on Edition II tokens**, and the brief flags it as the **prime
brand-elevation candidate** (this is where "private jet, not Monarch" matters most), so it goes round
the loop first.

> Already designed in earlier rounds — **not in this pack, don't redo:** the app shell (top bar +
> bottom nav + desktop rail), auth (login / signup / forgot / reset), Planner, Today. This pack is
> *only* the new landing.

## The ask

- **Spec:** `screen-specs/landing-marketing.md` — the page top-to-bottom, the **8 states**, what Code
  built, and exactly what to return.
- **Design against the live page:** screenshot `/` logged-out at **390 / 744 / 1280** and elevate over
  it. Mobile (390) is the source of truth — suppliers open it on a phone.

## Ground truth (don't reinvent)

- `reference/design-tokens.md` — the Edition II token manifest (values + the iron rule).
- `reference/component-contract.md` — the named components + states.
- `reference/khonsera-edition-ii.css` (brand) · `khonsera-edition-ii-screens.css` (`.cc-*` screen
  components) · `khonsera-edition-ii-shell.css` (shell + the new `.cc-mkt-*` / `.cc-wl-*` /
  `.cc-gated-*` landing classes). **Extend these; same architecture. globals.css is untouched.**
- `reference/brand/mk-ink.png` (light) / `mk-brass.png` (dark) — the only sanctioned mark. The
  crescent is retired; it must not appear.

## Exactly what to return (`for-code.zip`)

- **All 8 states × 3 sizes** (390 / 744 / 1280).
- An **additive override CSS** styling the landing **by the existing class/`data-*` hooks**, imported
  after the current layers. **Never globals.css. Tokens only** (request a token if you need a value).
- A **class + `data-*` map** for any new hooks you introduce.
- **Redlines** — hero type + rhythm, section spacing, the prop row, the form (input/button, focus,
  error, the **joined-state inline morph + motion**), footer, the gated screen.
- The **link-preview / OG card** — Code's placeholder is live at `/opengraph-image` (wordmark on
  linen via `next/og`, 1200×630); return the elevated card (or a final flat PNG).

Copy is the brief §8 **draft** — you own final voice. Withholding, calm; one gold fill per view; no
emojis; voiced as "Khonsera". Hand it back and Code implements on live data.

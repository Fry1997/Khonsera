# SCREEN SPEC — LANDING / FIRST-TOUCH

The unauthenticated front door (route `/`). **The first thing anyone sees** — and right now it's the
**retired brand**: see `current-state/02-landing-OLD-brand.jpeg` — the old **crescent moon** emblem,
a "KHONSU · SERA" eyebrow, a decorative cross divider, a serif-italic blurb, four ring icons
(PLAN / BOOK / KEEP / GO), and "Begin · sign in" / "Create an account". It does **not** read Edition II.

## Purpose

Set the brand temperature in one screen and get the visitor to **sign in / create an account**.
Quiet, considered, premium — "private jet, not Monarch". It must feel like the same product as the
Planner/Today screens, on the same Edition II skin.

## What to design

- **Brand lockup** — the Edition II emblem (`reference/brand/mk-ink.png`, never the crescent) + the
  wordmark. Decide the hero treatment (size, with/without the tagline).
- **One-line proposition** + a short supporting line. Voiced as Khonsera; no emojis. (Keep the
  existing copy spirit — "a quiet concierge for the in-between hours" — or refine it.)
- **The value row** (the four PLAN/BOOK/KEEP/GO points) — redesign or retire. If kept, they must use
  the Edition II icon language, not the old gold rings.
- **Primary CTA** "Begin · sign in" (the one gold fill) + secondary "Create an account".
- **A footer line** (the "Calm. Considered. Precise. Premium." mark, restyled).

## States × sizes (390 / 744 / 1280)

1. **Mobile (390)** — the source of truth: single column, generous vertical rhythm, the lockup as
   hero, the proposition, CTAs reachable without scrolling past the fold where possible.
2. **Tablet/desktop** — centred, wider margins; **no** marketing-grid sprawl. Calm.

## What to return

The landing designed at all three sizes; additive CSS by class (e.g. `.cc-landing-*`); a class map;
redlines (type scale, the lockup sizing, spacing, the CTA treatment). Tokens only; gold as the single
fill on the primary CTA + the emblem.

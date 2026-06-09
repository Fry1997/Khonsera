# SCREEN SPEC — AUTH (login · signup · forgot · reset)

The four unauthenticated form screens. Current login is `current-state/03-login.png` — old emblem +
generic form; not Edition II. They share one template.

## Purpose

Get the user in (or signed up / recovered) with the least friction, in the brand. Quiet, warm,
premium — the concierge greeting you, not a SaaS gate.

## The shared template

- **Brand lockup** (Edition II emblem + wordmark), centred, modest.
- **A one-line greeting** per screen (voiced as Khonsera): e.g. login "Welcome back.", signup
  "Let's set you up.", forgot "We'll send a link." — refine as you like; no emojis.
- **The form card** — fields (`.field`), labels (`.cc-eyebrow`/uc), the primary action
  (`.cc-btn-gold`, the one gold fill), inline error state, and the cross-links (forgot / create / back).
- A **calm ground** — paper, hairlines over shadows, generous spacing.

## Screens + their fields

- **login** — email, password → "Sign in"; links: forgot · create account.
- **signup** — name, email, password → "Create account"; link: already have one.
- **forgot-password** — email → "Send reset link"; success state ("check your inbox").
- **reset-password** — new password (+ confirm) → "Set password".

## States to design (× 390 / 744 / 1280)

1. **Default** (each screen).  2. **Error** (inline, in `--danger`, calm not alarming).
3. **Success** (forgot/reset confirmation).  4. **Loading/submitting** (button state).

Mobile (390) is the source of truth: single column, the lockup + greeting + card stacked, the CTA a
≥44px target, comfortable thumb reach.

## What to return

The four screens (states × sizes) on the shared template; additive CSS by class (e.g. `.cc-auth-*`);
a class map; redlines. Tokens only.

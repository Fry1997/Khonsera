# Spec — Landing / marketing page + waitlist (`/`) · **NEW, supersedes `landing.md`**

This **replaces** the old first-touch spec. `/` is no longer a sign-in splash — it's the **public
marketing front door**: what Khonsera is, a waitlist to capture interest, the app gated behind login.
Built per `landingwaitlistbrief.md`. **This is the single most brand-forward surface in the product**
— "private jet, not Monarch" matters most here. It's live and Code-built on Edition II tokens; this
spec asks you to **elevate** it, not invent it from scratch.

> Screenshot the live page at `/` (logged out) at 390 / 744 / 1280 and design over it.

## The page, top to bottom (what Code built)

All classes are live in `reference/khonsera-edition-ii-shell.css` under the `MARKETING` block
(`.cc-mkt-*`, `.cc-wl-*`, `.cc-gated-*`).

1. **Top bar** `.cc-mkt-top` — emblem + "Khonsera" wordmark lockup left (`.cc-mkt-lockup`), a
   **discreet** "Log in" link right (`.cc-mkt-login`, mono caps, underlined). This is the only way in.
2. **Hero** `.cc-mkt-hero` — headline *"Your travel, quietly handled."* (`.cc-mkt-headline`), sub
   (`.cc-mkt-sub`), one gold primary CTA *"Join the waitlist"* (`.cc-mkt-hero-cta`, anchors to
   `#waitlist`). Lots of paper.
3. **What it is** `.cc-mkt-section` — eyebrow + editorial lede (`.cc-mkt-lede`, one Spectral italic
   clause via `<em>`).
4. **Three quiet value props** `.cc-mkt-props` — gold dot + title + line, ×3. 1-up on mobile, 3-up
   ≥720px. Not a feature grid.
5. **Who it's for** `.cc-mkt-who` — eyebrow + lede.
6. **Waitlist block** `#waitlist .cc-mkt-waitlist` — heading + sub + the form (`.cc-wl-form`): single
   email input (`.cc-wl-input`) + gold submit (`.cc-wl-submit`). **Honeypot** `.cc-wl-trap` is
   off-screen — never style it visible.
7. **Footer** `.cc-mkt-foot` — name · one line · contact · © (minimal).

## States to design (all of them)

| # | State | Class hook | Notes |
|---|---|---|---|
| 1 | **Marketing — default** (logged out, not joined) | `.cc-mkt` | The full page above. The hero is the money shot. |
| 2 | **Waitlist — idle** | `.cc-wl-form` | email + button at rest |
| 3 | **Waitlist — focus / typing** | `.cc-wl-input:focus` | gold border at present |
| 4 | **Waitlist — submitting** | `.cc-wl-submit[disabled]` | button reads "Joining…" |
| 5 | **Waitlist — error** | `.cc-wl-error` | invalid email line under the field |
| 6 | **Joined — morph** (replaces the form inline, no reload) | `.cc-wl-joined` | check mark + "You're on the list." + sub. **Design the morph/motion.** |
| 7 | **Already on the list** | `.cc-wl-joined` (`already` variant) | same block, "You're already on the list." |
| 8 | **Gated thank-you** (logged-in, not approved) | `.cc-gated` | emblem + "Thank you — your place is reserved." + sub + quiet "Sign out". A calm dead-end. |

## What I need back (`for-code.zip`)

- **All 8 states × 3 sizes** (390 / 744 / 1280). Mobile (390) is the source of truth — suppliers open
  it on a phone.
- **Additive override CSS** styling these by the existing class/`data-*` hooks above, imported after
  the current layers. **Never globals.css. Tokens only** (request a token if you need a new value).
- **Class + `data-*` map** (Round-1 style) for any new hooks you introduce.
- **Redlines:** hero type scale + rhythm, section spacing, the prop row, the form (input + button
  sizing, focus, error, the **joined morph motion**), footer, and the gated screen.
- **The link-preview / OG card** — Code's placeholder is live at `/opengraph-image` (wordmark on
  linen via `next/og`, 1200×630). Return the elevated card; Code rebuilds it in `next/og` to match,
  OR supply a final flat PNG if you'd rather it be static.
- Copy is the brief §8 **draft** — **you own final voice.** Keep it withholding; no emojis; voiced as
  "Khonsera".

## Hard constraints

- One gold fill per view (the CTA / submit). One accent. Warm linen ground. Restraint over richness.
- The retired crescent must not appear — `reference/brand/mk-ink.png` (light) is the only mark here.
- Don't break the honeypot (`.cc-wl-trap` stays off-screen) or the inline-morph behaviour.

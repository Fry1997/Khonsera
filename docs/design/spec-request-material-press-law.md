# Spec Request: The Material Press Law

*Code → Design, per the Design↔Code Handoff Protocol §4a. Paste into Claude
Design alongside `docs/design-north-star.md` (the soul + finger test) and this
file.*

Version: 2026-06-28 · Medium: **Hybrid** (Design returns the token recipes + a
visual reference; Code applies globally and purges everything else).

## Purpose — one law, then purge
Define **THE single material press law**: for **every element**, on **every
surface**, in **light and dark** — exactly how it is pressed into the cotton
(debossed text, raised/pressed cards, debossed icons, pressed buttons), as
**token-named recipes**. The point is that this law can be applied **universally
without ever looking wrong**, because a deboss is always tuned to the surface it
presses into. Once it exists, it becomes the *only* law and **everything that
doesn't conform is deleted** (see `docs/design-reconciliation.md`).

This is the keystone the whole app is rebuilt against, so it must be
**exhaustive** — no element/surface pairing left undefined.

## Why a blanket deboss fails (the problem to solve)
A letterpress deboss is a highlight + inner-shadow that simulates type pressed
*into* a surface. It only reads correctly against the right surface tone:
- cotton (light) → bright top highlight + soft dark inner shadow;
- charcoal (dark) → inverted (dark above, faint light below);
- a gold/salt chip → tuned to that colour.

So we can't apply one `text-shadow` everywhere. We need the **press recipe per
(surface × element × theme)** — the matrix below.

## Re-ground (the constraints)
From `docs/design-north-star.md`: the whole app is one cotton material; depth by
**press, not border**; **all text is debossed, none flat (Law 5)**; texture +
layers you can feel; **gold is punctuation, never a fill**; charcoal is the only
dark accent; premium by default; **no emoji**. Everything below is **token-only**
— no raw hex/px; a new value is a token request back to Code.

## The SURFACES (what things press into) — the layer stack
Each is a token + its current value; Design refines values if needed. Type and
elements sit *in* one of these.

| Surface token | Current | Role |
|---------------|---------|------|
| `--ground` | `#e4e0d6` | the desk / app ground (deepest) |
| `--screen` | `#f2efe8` | the screen the spine sits on |
| `--widget` | `#fbfaf6` | a raised card/tile face |
| `--well` | `#ebe7dd` | a pressed-in well (inset) |
| `--char` | `#1f2228` | charcoal — text on it is cream, debossed |
| salts | `--gold #93753c` · `--terra` · `--plum` · `--sage` · `--amber` · `--rust` · `--slate` | rare coloured surfaces (chips, status) |
| **dark theme** | `[data-theme="dark"]` Midnight grounds | every surface has a dark counterpart |

## Existing material atoms (refine, don't reinvent)
Already in `globals.css` — Design ratifies/extends these into the full matrix:
- **Raise**: `--lift`, `--lift-sm`, `--lift-char` (box-shadows).
- **Press**: `--sink` (inset shadow).
- **Texture**: `--fibre` (cotton tooth, an SVG noise overlay).
- **Text deboss (light)**: `.engr` = `text-shadow: 0 1px 0 rgba(255,254,250,.95),
  0 -1px 1px rgba(36,30,22,.18)`; **(dark)**: `.engr-d`; **deep**: `.engr-deep`.
- **Icon deboss**: `.engr-ico` = `drop-shadow(0 .7px 0 #fff) drop-shadow(0 -.7px
  .3px rgba(36,30,22,.4))` (+ `-d` dark).

## The ELEMENTS (what gets pressed) — define each
For **every** one of these, specify its press treatment on **each surface it can
appear on**, in **light + dark**:
1. **Text by role**: display, h1–h3, body, label/`.uc`, eyebrow, mono
   (codes/times), numerals. (Law 5 — *all* debossed.)
2. **Cards / tiles / sheets** (raised faces).
3. **Wells / insets** (pressed-in regions, inputs' troughs).
4. **Buttons**: primary (gold-punctuation), secondary, ghost — resting **and**
   `:active` (it should *press down* on tap).
5. **Inputs / fields** (the trough + the typed text deboss).
6. **Chips / pills / status (`.sb`)** — incl. on salt colours.
7. **Icons** (debossed glyphs).
8. **Dividers / hairlines** (pressed lines, not 1px borders).
9. **Badges / the active tile / pass (ticket)** — the hero keepsake surfaces.
10. **The app shell** (rail/topbar/tabbar) — its text + chrome.

## The ASK — return the press matrix
For each **(element × surface × theme)**, give the exact recipe as tokens:
- text → which `--engr*`/`text-shadow` token (or a new one) makes it read pressed
  into *that* surface;
- card/well → which `--lift`/`--sink` + whether `--fibre` applies;
- icon → which `--engr-ico*`;
- button → resting press + the `:active` pressed-down recipe;
- on `--char` and on salts → the tuned (often inverted) variants.

Plus:
- **New tokens** required (e.g. `--engr-on-char`, `--engr-on-gold`,
  `--press-active`) so nothing is a one-off.
- A short **"how to apply globally"** note: e.g. base type classes get the
  surface-appropriate `--engr` by default; components opt their surface in.
- A **visual reference** (one cotton screen showing the same elements pressed
  correctly into ground/screen/widget/well/char) so Code can verify the look.

## How Code uses the return
Code maps the recipes onto the type scale + `.cc-*` components, applies them
**universally** (so every surface and all text are pressed/debossed/textured),
registers the new tokens, and then **purges** the legacy that doesn't conform
(the Edition II stylesheets, `.brief-*/.j-*/.k-*/.btn-primary/.input-base`, the
duplicate `--paper/--sand` aliases, and the dormant components keeping them
alive — per `docs/design-reconciliation.md`). Result: one material law, one
token set, one class vocabulary; everything else gone.

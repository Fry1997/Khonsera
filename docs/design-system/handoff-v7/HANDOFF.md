# Handoff: Khonsera — Travel-Day Planner (v7 "Paper" direction)

## Overview

**Khonsera** is a premium operational assistant for business and event
travellers — *"a command layer for travel days that cannot drift."* It turns
the fixed commitments you cannot miss (meetings, rail, flights, check-ins,
venues, return journeys) into a single accountable plan with **live timing,
buffers, fallback options and next-best actions**. It is not a route planner and
not a lifestyle travel app — it is an operational layer built for days that have
to run on time.

This bundle is the **approved v7 "paper" visual direction** plus the design
system that backs it. The hero surface is the mobile **Today / Plan** planner: a
single scrolling *measured spine* where each card's vertical height is
proportional to the minutes it occupies, so the day reads as a true timeline.

## About the design files

The files in `design/` are **design references created in HTML/JSX** —
in-browser prototypes (transpiled with Babel standalone, no build step) that
show the intended look and behaviour. **They are not production code to copy
directly.** The task is to **recreate these designs in the target codebase's
environment** using its established patterns. The real product is **Next.js 15 +
React + Tailwind + `lucide-react`** (repo: `Fry1997/Khonsera`,
https://github.com/Fry1997/Khonsera) — recreate the v7 direction there, mapping
the CSS custom properties below onto the Tailwind theme.

## Fidelity

**High-fidelity.** Final colours, typography, spacing, radii, elevation and
material are all resolved. Recreate pixel-faithfully. The single most important
thing to preserve is the **material** (described under "The paper material"
below) — it is what makes the product feel premium, and it is achieved entirely
with CSS (shadows, `text-shadow`, `drop-shadow`, a noise tile), no images.

---

## The design language in one screen

Heavy **white cotton stock** laid on a warm desk. Every card is a single printed
sheet: it lifts on a tight contact shadow with a bright bevelled top lip, ink is
**letterpress-debossed** into the paper, and a fine dry tooth sits on the card
face. Charcoal blocks are the **same stock in black**. **Gold is muted brass
punctuation only** — the brand dot, one status accent; it is **never** a button
fill or a wash. Composition target: **~60% stock · 24% ink · 12% structure · 4%
gold**.

Premium comes from material, restraint, hierarchy, spacing and typography — not
from colour, gradients or decoration.

---

## Design tokens

All values are CSS custom properties. Full source: `design/tokens/`. Reference
**names**, never raw hex, in product code. There are two themes — **Stock**
(light, default) and **Dark Cotton** (`[data-theme="dark"]`); only Stock is
documented inline below (dark equivalents are in `tokens/colors.css`).

### Colour — grounds & surfaces
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#EAE6DD` | the desk the sheets rest on (app background) |
| `--sand` | `#F2EFE8` | lighter sheet the spine sits on |
| `--card` | `#FBFAF6` | **the workhorse surface** — white cotton stock |
| `--card-2` / `--well` | `#EBE7DD` | recessed well (letterpress step under the page) |
| `--char` | `#1F2228` | charcoal — the same stock in black |

### Colour — ink (text)
| Token | Hex | Use |
|---|---|---|
| `--ink` | `#20242B` | primary text — cool near-black |
| `--ink-2` | `#2A2F37` | body |
| `--ink-dim` | `#565B64` | labels, eyebrows, secondary |
| `--ink-faint` | `#9499A1` | placeholders, disabled |

### Colour — gold (punctuation only)
| Token | Hex | Use |
|---|---|---|
| `--gold` | `#93753C` | the muted moon — brand dot, single accent |
| `--gold-2` | `#8A6D38` | gold-on-light text |
| `--gold-tint` | `rgba(147,117,60,.10)` | 10% tint behind gold text / focus ring |

### Colour — status (muted families)
| Token | Hex | Meaning |
|---|---|---|
| `--sage` / `--sage-soft` | `#5F7150` / `#D9DECA` | success · "fits" |
| `--amber` / `--amber-soft` | `#9C6F24` / `#EDE0BC` | caution · "tight" |
| `--rust` / `--rust-soft` | `#97331F` / `#EED3CB` | danger · "infeasible" · disruption |
| `--slate` / `--slate-soft` | `#475569` / `#DCE1E8` | info (the only cool foil) |
| `--terra` `#BD5A3A` · `--plum` `#5A3A47` | | rare salts — one per composition, never together |

Map status to **sage / amber / rust** only. The interface should look like a
warning **only** when there is real risk.

### Type
- **Satoshi** (self-hosted, `assets/fonts/`) — display, UI, body, and its own
  italic. **JetBrains Mono** — every time, code, locator, eyebrow and status
  label, tabular (`font-variant-numeric: tabular-nums`). **Sans + mono only. No
  serif.**
- Scale: `--fs-display:56` / `--fs-h1:40` / `--fs-h2:28` / `--fs-h3:15` /
  `--fs-body:14` / `--fs-label:12` / `--fs-micro:10.5` (px).
- Headlines: Satoshi **500**, tight tracking (`-0.02 → -0.035em`). Wordmark:
  Satoshi **300**, UPPERCASE, `+0.26em`, monocolour ink, **never gold-split**.
- Eyebrows / structural labels: JetBrains Mono, uppercase, `0.22em`, `--ink-dim`
  (e.g. `LEAVE BY`, `NEXT`, `WORK · TODAY`, `TO CATCH`).

### Spacing — 4px base
`--space-1:4` … `--space-2:8` `--space-3:12` `--space-4:16` `--space-6:24`
`--space-8:32` `--space-12:48`.

### Radius — business-card stock
`--radius-xs:7` (badge) · `--radius-sm:10` (chip/button) · `--radius-md:14`
(card/tile) · `--radius-lg:18` (hero). **Pills stay fully round** (`999px`) — a
deliberate affordance. Crisp, not soft.

### Motion — calm
Durations `--dur-fast:80` / `--dur-base:120` / `--dur-slow:150` ms on
`--ease-standard cubic-bezier(.2,0,0,1)`. Buttons lift `1px` on hover, settle
(`translateY(1px)`) on press. The **only** looping animation is the live "now"
breach pulse (1.6–1.8s opacity fade), reserved for urgency.

---

## The paper material (the load-bearing detail)

This is the system's signature and must be reproduced exactly. It is three CSS
recipes (full source in `tokens/colors.css` + `primitives.css`):

1. **Sheet lift (`--lift`)** — a card lifting off the desk: a bright inset top
   lip + a hairline edge + a tight contact shadow + a soft cast.
   ```
   --lift: inset 0 1.5px 0 rgba(255,255,255,.9),
           0 0 0 .5px rgba(40,44,52,.045),
           0 18px 30px -18px rgba(34,30,24,.28),
           0 5px 12px -6px rgba(34,30,24,.15),
           0 1.5px 3px rgba(34,30,24,.09);
   ```
   `--lift-char` is the charcoal-block equivalent; `--raise-chip` /
   `--raise-chip-d` are the small-tile versions (no blur — blur reads as a
   smudge at chip size).

2. **Letterpress recess (`--sink`)** — ink/panels bitten into the stock:
   ```
   --sink: inset 0 2px 4px rgba(40,36,28,.16),
           inset 0 1px 2px rgba(40,36,28,.10),
           inset 0 -1px 0 rgba(255,255,255,.65);
   ```

3. **Debossed ink & icons** — text is pressed into the paper with a paired
   `text-shadow` (white lower highlight + dark upper shadow); SVG icons get the
   same effect via `filter: drop-shadow(...)` (they ignore `text-shadow`).
   - Light stock: `text-shadow: 0 1px 0 rgba(255,255,255,1), 0 -1px 0 rgba(36,30,22,.3)`
   - Dark stock flips direction: `text-shadow: 0 -1px 0 rgba(0,0,0,.9), 0 1px 0 rgba(255,255,255,.22)`
   - Icons: `.engr-ico` (light) / `.engr-ico-d` (dark) — same offsets as `drop-shadow`.

4. **Dry tooth (`--fibre`)** — a baked fractal-noise SVG data-URI tiled on each
   card face at `mix-blend-mode: multiply; opacity:.13` (`screen`/`.05` on dark
   stock). It is scoped to the **card face only** — the desk between cards and
   the dark blocks stay clean. Implemented as the `::after` of `.pg` / `.card`.

**In a real codebase:** these become a small set of utility classes / a
`Paper`/`Sheet` primitive (or Tailwind `@layer` utilities + plugin) — do **not**
inline these shadow stacks per component. The HTML reference centralises them as
`.card`, `.card-soft`, `.card-hero`, `.card-ink`, `.pg`, `.pg-d`, `.engr*`,
`.well`.

---

## Screens / views

The reference app is **mobile, 394px wide** (used one-handed, on a platform, in
a hurry). Entry: `design/app/index.html`. A scenario switcher across the top
swaps representative days — each exercises a different slice of the object
system:

1. **Rail commute** — home → office via two rail legs and a tight Luton change.
2. **Flight + hotel** — a Geneva day: airport mechanics, boarding pass, hotel base.
3. **Evening out** — an event day with a dinner reservation and an open gap.
4. **Field day** — a work-block *container* with a nested mini-spine (internal +
   customer meetings, travel, overtime).
5. **Gap types** — the gap/buffer taxonomy gallery.
6. **Special cards** — the full credential gallery (rail, flight, hotel, event,
   restaurant, parking, lounge, car hire).

### The four tabs (bottom nav)
The app is a complete shell — every tab is built in the paper direction, all
sharing one material vocabulary (`Chip`, `Badge`, `tile`, paper `.pg` / `.pg-d`,
debossed mono numerals). Each tab derives its content from the **active day**
(`KH_DAYS[si]`); switching scenarios re-renders all four.

1. **Today** — the measured-spine planner (the hero surface, detailed below).
2. **Prepare** — the night-before surface: a `WAKE BY` hero (computed leave-by
   −60 min) beside a dark-cotton **first-anchor** block + *Set the alarm*; a
   **go-bag** checklist (the first stop's tasks); a **documents** list (every
   credential, "saved offline"); and a dashed **"still to settle"** inbox
   (the day's `unplaced` bookings/errands).
3. **Wallet** — every credential the day carries, derived from the spine and
   grouped *Travel · Stays · Tables & seats · Passes*. Each card opens the same
   ticket sheet as Today. Showcase days with no credentials fall back to an
   empty state.
4. **Trips** — the planned days as a list of trip cards (date eyebrow, route
   arrow or title, mode glyph, leave-by); the active day carries a charcoal
   `VIEWING` tag. Tapping a trip switches the active day and returns to Today.

A floating **"Preview work view"** pill (on work-capable days, Today only)
toggles the workplace-privacy lens.

### Layout of the planner surface
- **Masthead**: brand lockup (brass dot + debossed `KHONSERA` wordmark) left;
  two round icon-buttons (compass / bell) right.
- **Day header**: a mono eyebrow (`TUE 17 JUN · PLAN`) over an `Origin → Destination`
  headline (Satoshi 500, the destination in `--ink-dim`).
- **Hero "leave-at" block** (`.card-hero`, one per screen): a `LEAVE AT` eyebrow
  over a huge letterpress mono time (`06:10`), with a dark-cotton `TO CATCH`
  sub-panel (`06:40 · to Luton · TRAIN`) inset top-right.
- **The measured spine**: a hairline vertical rail with a node per stop; each
  card's height ∝ its minutes. Node glyphs: **solid walnut dot** = Anchor (fixed
  bone), **hollow diamond** = Leg (connective), **dashed ghost ring** = Gap
  (needs input). Legs are de-boxed (transparent) so the chain stays legible.
- **Primary action**: a full-width dark-cotton `Navigate` button.

### Interactions
- Scenario switcher swaps the whole day (`KH_DAYS` data → re-render).
- Tapping a card **expands** it (special cards reveal their detail / ticket).
- Tapping a credential opens its **ticket sheet** (Aztec / PDF417 / QR — faux
  placeholder in the prototype; the real app injects codes via `bwip-js`).
- Buttons: hover `translateY(-1px)`, press `translateY(1px)`. No bounce.

---

## The travel-day object system (the product model)

Khonsera is **not** an itinerary of identical cards with different icons. A day
is built from **object classes** that behave and read differently. The single
source of "what kind of thing this is" is the **class**, carried by `Plate` —
the shared chassis every special card wraps. **Compose, don't fork**: build new
types by wrapping `Plate` with a `klass` + a bespoke body; never re-implement the
medallion / edge / spine-node chrome.

| Class | What it is | Visual signal |
|---|---|---|
| **Anchor** | a meaningful fixed point | solid ink node on the spine |
| **Movement** | connects two anchors | de-boxed, slate medallion, connective |
| **Commitment** | something you cannot miss | gold left edge + gold medallion |
| **Container** | governs a window, may nest | bracket rail / dark base panel |
| **Access** | grants entry / entitlement | perforated pass edge, gold-on-ink |
| **Action** | a light task to slot in | soft medallion, low weight |

**Time is a first-class object, not the space between cards** — three distinct
treatments, never collapsed:
- **BufferStrip** — *protected, required* time that makes a later commitment safe
  ("be on the platform 15 min before departure"). States what it protects;
  `safe → tight → lost`.
- **OpenGap** — *optional, flexible* time, shown as a usable resource (what it's
  good for, how much delay it absorbs), never as empty space.
- **Changeover** — a *transition* between modes/places (train→Tube, security→gate):
  available vs needed time + a `safe/tight/risky` verdict.

**Known ≠ placed.** An `UnplacedTray` holds booking objects the plan knows about
but hasn't positioned ("check-in available from 15:00" is a *constraint*; "check
in at 17:40" is a *placed action*).

**Wallet is contextual** — the right credential surfaces inline on the object
that needs it (each card's `ticket` prop), and also stands alone in a Wallet list.

**Data shape:** a day is a flat array of typed items (`{ t: "rail" | "meeting" |
"buffer" | … }`); the screen switches on `t` to pick the component. Reference
data: `design/app/explorations/planner-v4.js` (`KH_DAYS`). Reference renderer:
`planner-v7-app.jsx`. Times, refs and statuses are **props, not hand-placed
text**, so the same object renders identically in Today, Plan and Wallet.

---

## Voice & copy

Operational, precise, executive — premium through clarity, never mood. Speaks as
**"Khonsera"** (never a human name, never chatty). Short declarative lines: say
what happens and when. Direct second person ("Leave by 06:48"). The signature
move is the **consequence band** — cause→effect ("This return means you leave the
venue by 16:10"). Times/places/codes are exact, set in mono (`06:48`, `LEI →
STP`, `Coach B · 42`). Sentence case for body/headlines; UPPERCASE only for mono
eyebrows and status pills. **No emoji, ever.** Composed under disruption: state
it flatly and pair with the recovery ("Cancelled — next-best: 16:35 via
Leicester, arrives 18:02").

## Iconography

**Lucide** (`lucide-react` in production), 24px grid, ~1.75 stroke, round
caps/joins, no fill, `currentColor`. The prototype ships a curated travel subset
as `Icon.jsx` so it is self-contained. Icons inherit the debossed treatment via
`.engr-ico`. The **emblem** (`assets/mk-ink.png` / `mk-brass.png` — a moon over
water) is the only mark and the only element permitted to be gold: **ink** on
light, **brass** on dark, never gold-on-light.

## Assets

- `design/assets/mk-ink.png`, `mk-brass.png` — the brand emblem.
- `design/assets/fonts/` — self-hosted **Satoshi** variable + italic (`woff2`).
  JetBrains Mono loads from Google Fonts (system-mono fallback offline).
- `--fibre` paper tooth is a baked SVG data-URI in `tokens/colors.css` — no image
  file needed.

## Files in this bundle

- `design/app/index.html` — the v7 planner entry (open this first).
- `design/app/explorations/` — `planner-v4.js` (day data), `planner-v7.jsx`
  (masthead + hero + material map), `planner-v7-app.jsx` (spine + every card
  type), `planner-v7-icons.jsx` (icons + time helpers).
- `design/styles.css` — global entry (`@import`s only; fonts → tokens → type →
  primitives).
- `design/tokens/` — `colors.css`, `typography.css`, `spacing.css`, `fonts.css`,
  `base.css`.
- `design/primitives.css` — the class vocabulary the components emit.
- `design/assets/` — emblem + fonts.
- `design/DESIGN_SYSTEM.md` — the full design-system reference (deeper than this
  handoff: every component, every guideline).

## Source repo

`Fry1997/Khonsera` — https://github.com/Fry1997/Khonsera (Next.js 15 + React +
Tailwind). Explore it to build accurately against the live app; map the tokens
above onto its Tailwind theme rather than hard-coding hex.

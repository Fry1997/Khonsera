# Khonsera — Design System

> *A command layer for travel days that cannot drift.* A premium operational
> assistant for business and event travellers — it organises the fixed
> commitments you cannot miss (meetings, rail, check-ins, venues, return
> journeys) into a single accountable plan with **live timing, buffers, fallback
> options and next-best actions**. Not a route planner, not a lifestyle travel
> app: an operational layer **built for days that have to run on time.**

Named after **Khonsu** — the Egyptian god of **time** and guardian of
travellers. The mark is a moon held above a horizon line. The voice is precise,
composed and operational — premium through restraint and confidence, never mood.

This project is the single source of truth for how Khonsera looks and is built,
derived from the brand's **Edition III** brand book and shipped `globals.css`.

---

## Sources

These inputs were used to build this system. You may not have access; they are
recorded so you can explore further and do better work.

- **GitHub — application & design pack:** `Fry1997/Khonsera`
  (https://github.com/Fry1997/Khonsera) — Next.js 15 + React + Tailwind app. The
  `design-export/` pack (Timeline & Today screens, `khonsera.css`,
  `components.html`, `tokens.html`) and `for-design/reference/` (canonical
  `design-tokens.md`, `component-contract.md`, the Edition II CSS layers, brand
  marks) were the primary ground truth. Tailwind tokens proxy
  `src/app/globals.css`.
- **GitHub — resources:** `Fry1997/Khonsera-resources`
  (https://github.com/Fry1997/Khonsera-resources).
- **Uploaded:** `Khonsera 24.zip` — the curated *Khonsera Design System bundle*
  (`10-tokens.css`, `20-type.css`, `30-primitives.css`, `edition-ii.css`,
  `system.html`, the 82-page Edition II brand book HTML, `00-DECISIONS.md`). The
  token / type / primitive layers in this system are de-duplicated and ported
  directly from that bundle. The originals are kept under `source-bundle/`.

Explore the `Fry1997/Khonsera` repo to build more accurately against the live app.

---

## Content fundamentals

How Khonsera writes. The product speaks as an **operational layer** — precise,
composed, executive-friendly, decision-led. Premium comes from clarity and
confidence, never from mood or lifestyle copy.

- **Voice = "Khonsera."** Never a human name, never first-person-as-a-person,
  never chatty. It states commitments, timing and consequences — and the
  next-best action. Capable and accountable, not warm or poetic.
- **Plain, precise, executive.** Short declarative lines. Say what happens and
  when. No scene-setting, no sensory or wellness language (no "calm", "slow",
  "blue hour", "journey as an experience"). If a word doesn't carry information,
  cut it.
- **Direct second person.** Address *you* about the day's facts — "Leave by
  06:48", "You arrive St Pancras 08:34, 56-minute buffer", "How will you cross
  London?". Imperative where there's an action.
- **Consequence and accountability.** The signature move is the **consequence
  band**: *"This return means you leave the venue by 16:10."* Cause → effect, so
  every choice shows its downstream impact. The plan is answerable for the day
  running on time.
- **Times, places and codes are exact**, set in mono, tabular: `06:48`,
  `LEI → STP`, `TTBQEBVV`, `Coach B · 42`. Precise where it matters; deliberately
  ranged ("by 15:00 latest", "2–3") only where the user is still deciding.
- **Casing.** Sentence case for body and headlines. UPPERCASE only for the mono
  structural labels (eyebrows: `LEAVE BY`, `NEXT`, `WORK · TODAY`) and status
  pills (`BOOKED`, `ON TIME`, `DELAYED`).
- **Composed under disruption.** State it flatly and pair it with the recovery:
  "Cancelled — next-best: 16:35 via Leicester, arrives 18:02." "+12 min."
  "Platform 4 → 1." Only cancelled / delayed earn warmth (amber / rust), never
  alarm-red throughout. The one raised voice is a **NudgeCard** ("Leave ten
  minutes earlier to hold your buffer") — it earns prominence by being rare.
- **Proposals are provisional.** Inferred or optional items read as soft /
  dismissable, clearly distinct from committed, fixed anchors — "optional",
  "dismiss", "make it fixed".
- **No emoji. Ever.** Iconography is Lucide line glyphs only.

Example copy:
> NEXT · Henderson review, 09:30 · Leave Derby Station 07:02 — **leave by 06:48** ·
> drive home → Derby Station, 18 min, 4-min buffer
>
> *Cross London — needs input.* Tube via Piccadilly holds the 09:15 arrival; taxi
> is tight in traffic.

Example copy:
> *Cross London — needs input.* Tube via Piccadilly holds the 09:15 arrival; taxi
> is tight in traffic.

---

## Visual foundations

**The intent:** a precise operational surface with the tactility of fine
stationery. The product is built from **heavy white cotton stock** — every card
is a single printed sheet laid on a warm desk: it lifts on a tight contact
shadow with a bright bevelled top lip, ink is **letterpress-debossed** into the
paper, and a fine dry tooth sits on the card face. Charcoal blocks are the
**same stock in black**. Premium comes from material restraint, hierarchy,
spacing and typography — not from decoration. **Gold is muted brass punctuation
only** (the brand dot, one status accent). The composition rule is roughly
**60% stock · 24% ink · 12% structure · 4% gold**.

- **Colour.** Cool **Stock** palette by default — white cotton card (`--card`
  #FBFAF6) on a warm desk (`--paper` #EAE6DD), cool near-black letterpress
  **ink** (`--ink` #20242B), muted brass **gold** (`--gold` #93753C, held to
  punctuation). Status families stay muted — **sage** (success/"fits"), **amber**
  (caution/"tight"), **rust** (danger/"infeasible", also disruption). Rare salts:
  **terracotta** and **plum** — one accent per composition, never terra+plum
  together. **Slate** is the only cool foil (info). A second theme, **Dark
  Cotton** (`data-theme="dark"`), is the same stock in charcoal with warm-white
  ink and a brass moon — for overnight / Live.
- **Type.** Sans-led, sans + mono only. **Satoshi** carries display, UI and body
  (Inter retired); **JetBrains Mono** is the structural voice — every time,
  code, locator, eyebrow and status label, tabular. There is **no serif** — the
  retired Spectral/Cormorant editorial italic has been removed; emphasis now comes
  from weight, tracking and the mono layer, never a literary italic. Headlines are
  Satoshi 500 with tight optical tracking (−0.02 → −0.035em). The **wordmark** is
  Satoshi **300**, UPPERCASE, +0.26em, monocolour ink — never gold-split.
- **Spacing.** 4px base (`--space-1`…`--space-12`).
- **Corners.** v7 **business-card stock**: hero **18px**, card/tile **14px**,
  chip & button **10px**, badge **7px**. Pills stay fully round (a deliberate
  affordance). Crisp, not soft — a printed-stock edge.
- **Cards & elevation — the paper sheet system.** The workhorse `.card` is white
  cotton stock (`--card`) lifting off the desk on **`--lift`**: a tight contact
  shadow + soft cast, a bright bevelled top lip (`inset` highlight) and a
  hairline edge. `.card-soft` is a **pressed well** (`--sink`, letterpress
  recess). `.card-hero` is a deeper lift, one per screen (**no gold edge**).
  `.card-ink` is **dark cotton** (`--char` + `--lift-char`) for Live / premium
  tickets. Three reusable utilities carry the material: **`.pg`** (a light sheet
  — dry tooth on its own face + inherited letterpress on all text), **`.pg-d`**
  (the same in black), and **`.engr` / `.engr-deep`** (deeper letterpress for
  numerals). The tooth needs `--fibre` (a fractal-noise tile baked into
  `colors.css`; planner pages regenerate it at runtime for a crisper grain).
- **The spine.** The Timeline's signature: a hairline vertical rail with a node
  per stop — a **solid walnut dot** for Anchors (fixed bones), a **hollow
  diamond** for Legs (subordinate, connective), a **dashed ghost ring** for Gaps
  (needs input). Legs are de-boxed (transparent) so the chain stays legible.
- **Backgrounds.** A warm cotton desk; cards are white stock sheets laid on it,
  each carrying a fine dry tooth (`.paper-tex` / `--fibre`) scoped to the card
  face — the desk between cards and the dark blocks stay clean. Marketing /
  monograph surfaces may use soft gradients; the **app stays flat stock**.
  No loud gradients, no photography in-app (maps are the exception, via MapLibre).
- **Borders & dividers.** Hairline `--rule` everywhere; `--rule-2` for stronger
  separation and ghost nodes. 1px, never heavy.
- **Motion.** Composed by default — durations 80 / 120 / 150ms on
  `--ease-standard cubic-bezier(.2,0,0,1)`. Buttons lift 1px on hover, settle on
  press. The one looping animation is the **breach pulse** (the live "now" dot,
  1.6–1.8s opacity fade) — reserved for urgency. Marketing/hero may use the
  expressive `cubic-bezier(.22,1,.36,1)`.
- **Hover / press.** Hover: a 1px lift (`translateY(-1px)`) and a slightly deeper
  fill (gold → gold-2); ghost buttons wash with `--ink-soft`. Press:
  `translateY(1px)`. Quiet, physical, never bouncy.
- **Transparency & blur.** Sparingly — the mobile tabbar uses a paper-tinted
  blur; the comparison sheet dims the ground with a low-opacity ink scrim. Gold
  appears as a 10% tint (`--gold-tint`) behind gold text, never as a wash.
- **The two correctness exceptions.** `BarcodePresenter` and `ScanView` yield
  craft to function: white ground, max contrast, preserved quiet zone, **nothing
  overlaid on the code**. A lovely card that won't scan is a failure.

---

## Iconography

**Lucide** (the app uses `lucide-react`). 24px grid, **~1.75 stroke**, round caps
and joins, no fill, drawn in `currentColor` so an icon takes the ink of its
context. No emoji, ever; no decorative illustration; no hand-drawn SVG imagery.

- This system ships a curated travel-domain subset as the `Icon` component
  (`components/core/Icon.jsx`) so it is self-contained: `train`, `plane`, `bed`,
  `car`, `footprints` (modes); `clock`, `calendar`, `map-pin`, `navigation`,
  `arrow-right`, `chevron-*`, `x`, `check`, `wallet`, `ticket`, `scan-line`,
  `moon`, `sunrise`, `refresh-cw`, `alert-triangle`, `search`, `settings`, `user`,
  `plus`. Use `<Icon name="train" />`; in production code import from `lucide-react`.
- **The emblem** (`assets/mk-ink.png` / `assets/mk-brass.png`) is the only mark —
  a moon over water with reflection lines. **Ink** on light grounds, **brass** on
  dark; never gold-on-light. It is the only element permitted to be gold. The
  crescent variant is retired.
- Status is shown with **dots and mono words** (`StatusStrip`, `Pill`, `Tag`,
  `StatusBadge`), not coloured icons.

---

## The travel-day object system

KHONSERA is not an itinerary of identical cards with different icons. A travel
day is built from **object classes** that behave and read differently, and the
planning components encode that. The single source of "what kind of thing this
is" is the **class** — carried by `Plate`, the chassis every special card wraps:

| Class | What it is | Visual signal | Components |
|---|---|---|---|
| **Anchor** | A meaningful point in the day | Solid ink node on the spine | `AnchorCard` |
| **Movement** | Connects two anchors | De-boxed, slate medallion, connective | `RailLeg` · `FlightLeg` · `GroundLeg` |
| **Commitment** | Something you cannot miss | Gold left edge + gold medallion | `MeetingCard` · `RestaurantCard` · `EventCard` |
| **Container** | Governs a window, may nest | Bracket rail / dark base panel | `WorkBlock` · `StayCard` |
| **Access** | Grants entry / entitlement | Perforated pass edge, gold-on-ink | `WalletPass` · `ParkingCard` |
| **Action** | A light task to slot in | Soft medallion, low weight | `ActionCard` |

**Time is a first-class object, not the space between cards.** Three distinct
treatments — never collapsed into one:
- **`BufferStrip`** — *protected, required* time that makes a later commitment
  safe (be at the station 15 min early). States what it protects and whether it
  still holds: `safe → tight → lost`.
- **`OpenGap`** — *optional, flexible* time. Shown as a usable resource (what
  it's good for, how much delay it absorbs), never as empty space.
- **`Changeover`** — a *transition* between modes/places (train→Tube,
  security→gate). Available vs needed time + a `safe/tight/risky` verdict, since
  changeovers are where days fail.

**Known ≠ placed.** `UnplacedTray` holds booking objects the plan knows about
but hasn't positioned (hotel check-in, breakfast, bag drop). "Check-in available
from 15:00" is a *constraint*; "check in at 17:40" is a *placed action* — the
tray is where the first becomes the second.

**Wallet is contextual, not a silo.** `WalletPass` surfaces the ticket / boarding
pass / QR inline on the object that needs it (via each card's `ticket` prop), and
also stands alone in the Wallet list.

### Implementing this (note for Claude Code)

- **Compose, don't fork.** Build new object types by wrapping `Plate` with a
  `klass` and a bespoke body — do not re-implement the medallion/edge/spine-node
  chrome. `Plate` is the only place class encoding lives.
- **One spine.** `Spine` lays out any mix of these on the rail; each child draws
  its own node via `onSpine`. `WorkBlock` nests a `Spine` inside itself when
  expanded — containers hold a mini-spine, they don't flatten their contents.
- **State vocabulary is shared and small.** Reuse `StatusStrip` for live transit
  state and the `safe/tight/lost` (buffer) and `safe/tight/risky` (changeover)
  scales for feasibility. Don't invent new colour states; map to
  sage/amber/rust. The interface should only look like a warning when there is
  real risk.
- **Data shape.** A day is a flat array of typed items (`{ t: "rail" | "meeting"
  | "buffer" | … }`); the screen switches on `t` to pick the component
  (`ui_kits/app/PlanScreen.jsx` is the reference renderer; data in `app-data.js`).
- **Props over markup.** Times, references and statuses are props, not
  hand-placed text — so the same object renders identically in Today, Plan and
  Wallet. Every card extends `HTMLAttributes` and forwards `...rest`, so `onClick`
  / `style` / `onSpine` pass straight through.

---

## Index / manifest

Root foundations:
- `styles.css` — the global entry point (consumers link this one file; `@import`s only).
- `tokens/` — `colors.css` (Stock + Dark Cotton + paper material tokens),
  `typography.css` (scale + type classes), `spacing.css` (spacing/radius/motion),
  `fonts.css` (webfont imports), `base.css` (document grounds + paper texture).
- `primitives.css` — the de-duped class vocabulary (card, button, field, pill,
  chip, tag, `.sb` status, icon-button, segmented).
- `assets/` — `mk-ink.png`, `mk-brass.png` (the emblem).
- `source-bundle/` — the original uploaded design-system bundle + brand book, for reference.

Components (`window.KhonseraDesignSystem_019e31.*`):
- **core/** — `Button`, `IconButton`, `Field`, `Card`, `Pill`, `Tag`,
  `StatusBadge`, `Segmented`, `Icon`, `BrandLockup` / `Wordmark`.
- **concierge/** — the signature product components: `ActiveTile` (Today's hero),
  `Spine` + `AnchorCard` / `LegCard` / `GapCard` (the Timeline), `TicketCard`
  (booked documents) and `StatusStrip` (live status).
- **planning/** — the travel-day **object system** (see below): `Plate` (the
  shared chassis) + the special cards `RailLeg`, `FlightLeg`, `GroundLeg`,
  `MeetingCard`, `RestaurantCard`, `EventCard`, `StayCard`, `WorkBlock`,
  `ParkingCard`, `ActionCard`, and the time language `BufferStrip`, `OpenGap`,
  `Changeover`, `UnplacedTray`, `WalletPass`.

UI kits:
- **ui_kits/app/** — the Khonsera mobile app: Today · Plan · Wallet · ScanView,
  interactive. `index.html` is the entry. `complex-day.html` (a work-block
  container with a nested mini-spine + overtime) and `hotel-stay.html` (a known
  booking, the unplaced tray, the confirmation pass and the current-base panel)
  are standalone Plan scenarios.

Guidelines & specimen cards:
- **guidelines/** — the foundation specimen cards rendered in the Design System
  tab (Colors, Type, Spacing, Brand).

Other:
- `SKILL.md` — Agent-Skill manifest for using this system in Claude Code.

---

## Caveats

- **Satoshi is self-hosted.** The variable face (`assets/fonts/Satoshi-Variable.woff2`
  + italic) ships with the system and works offline; `@font-face` rules live in
  `tokens/fonts.css`. **JetBrains Mono** loads from Google Fonts; offline the mono
  stack falls back to system mono. No serif is loaded.
- **Barcodes are faux placeholders** in `ScanView` — the real app injects Aztec /
  PDF417 / QR via `bwip-js` at wire-up.
- **Maps, auth, settings and the desktop "desk" shell** are out of scope for the
  current UI kit.

# Khonsera · Design System

**Khonsera is a personal travel-day assistant** — an operational concierge for the
day itself. Not an itinerary app, calendar skin or route planner: it surfaces the
right instruction, reassurance, ticket, booking detail, route step or decision at
the exact moment it is needed. The promise is that *the user should not feel like
they are mentally babysitting the day.* They should always know **where they are,
what happens next, whether they are still okay, and what they need to show.**

This design system encodes that into a tactile, physical material language: every
card is a crafted travel artefact — ticket stock, a boarding pass, a station
wayfinding plate, a hotel key sleeve, a concierge note — rather than a generic SaaS
rectangle. The feeling to protect: *"I am looked after. I know what happens next.
If there is a problem, I will know what it means and what to do."*

---

## Sources

This system was distilled from an internal exploration snapshot — **Planner v7
("Paper" build)** — the candidate foundation the team landed on. No external Figma
or repo was provided; everything here is derived from that snapshot, now promoted
into a compiler-readable system:

- Original snapshot: `uploads/Khonsera Design System.zip` (extracted, refactored,
  then removed once promoted to the root token + component layout).
- The full interactive build now lives at **`ui_kits/planner/`**.

If you have access to the brand book referenced in the source ("Edition III"), the
gold composition rule (~62% paper · 24% ink · 10% charcoal · 4% gold/salt) and the
"gold is the moon / punctuation only" rule come from there.

---

## CONTENT FUNDAMENTALS — how Khonsera writes

The voice is **calm, capable, precise, reassuring, quietly premium.** It is the
voice of a capable assistant travelling with you — never playful, touristy,
wellness-y, dreamy, poetic, or airline-app corporate.

- **Second person, present tense, stating facts.** *"You're on the 11:32 to London
  St Pancras."* *"Next stop: Luton Airport Parkway."* The app narrates the day as
  it is, not as an instruction barked at the user.
- **Lead with the operational fact, then reassure.** *"Disembark at Luton and
  proceed to platform 4. Connection safe."* The next concrete action first; the
  reassurance second; never the other way round.
- **Firmness scales with risk.** Calm and quiet when safe ("Day holds · all buffers
  green"); short and firm when action is required ("The 07:11 connection is missed —
  switch to the 07:26 from platform 4"). It does not over-explain.
- **Numbers are sacred.** A gate, platform, departure time, seat, booking reference
  or QR code outranks any decorative copy. Times are written `11:32`; durations
  `6 min`, `1h 20m`; codes uppercased (`WEL → LUT`, `KH-4XQ2`).
- **No exclamation marks, no emoji, no "oops", no "pro tip", no cheerleading.**
  Sentence case for prose; UPPERCASE mono only for structural labels (eyebrows,
  field captions, status pills).
- Open/waiting time is described as *usable*, never as emptiness — "45 min spare ·
  enough to absorb a delay", not "nothing scheduled".

See the **Voice** card under the Brand group for a side-by-side of what we say vs.
what we don't.

---

## VISUAL FOUNDATIONS

**The material in one line:** every card is a single sheet of heavy white cotton
business-card stock laid on a warm desk — it lifts on a tight contact shadow with a
bright bevelled top lip, its text is letterpress-debossed into the stock, and a fine
dry tooth (grain) sits over the card face only. **Charcoal blocks are the same stock
in black** — airport signage, departure boards, premium tickets.

- **Colour.** Cool near-black ink (`--ink #20242b`) on warm cotton grounds
  (`--ground → --widget`, a warm-stone-to-near-white ramp). Charcoal `--char #1f2228`
  is the punctuation surface. **Gold (`#93753c`, "the moon") is punctuation only** —
  the brand dot and the odd status accent, never a fill field. Status reads on three
  families: sage (comfortable / fits), amber (tight), rust (risky / disruption),
  with slate as cool foil and terra/plum as rare salts (one per composition).
- **Type.** Satoshi (display + UI + body, 300–600) and JetBrains Mono (codes, times,
  eyebrows, the operational numbers). Sans + mono only — **no serif.** Emphasis comes
  from weight, tracking and the mono technical layer, never a literary italic.
  Headlines are Satoshi 500 with tight optical tracking; the wordmark is Satoshi 300,
  uppercase, +0.26em.
- **Surfaces & elevation.** Three planes plus charcoal: **page** (the calm ground) ·
  **widget/card** (a sheet raised on `--lift`) · **well** (pressed in on `--sink`) ·
  **char** (charcoal punctuation). The level story — lift vs. sink — is the primary
  way hierarchy is built; read-outs and credentials sink, cards lift.
- **Corners.** Crisp business-card geometry, never soft: hero 18 · tile 14 · inner
  11 · chip 9 · badge 7. Pills stay fully round as a deliberate affordance.
- **Backgrounds.** A warm radial desk gradient + an optional barely-there grain
  (`.paper-tex`). The dry fibre tooth (`--fibre`, a baked fractal-noise tile) shows
  on card faces via `.pg` / `.pg-d` — multiply on light, screen on dark. No
  full-bleed imagery, no decorative gradients on content.
- **Borders & shadows.** Hairlines (`--line`, `--line-soft`) over heavy borders.
  Shadows are the material itself: `--lift` (raised sheet), `--lift-sm`, `--sink`
  (pressed well), `--lift-char` (charcoal block). A bright top lip + tight contact +
  soft cast on every sheet.
- **Motion.** Calm by default (80–150ms, `--ease-standard`). Sheets slide up
  (`sheetUp`), content fades in (`fadeIn`), the live dot pulses. The expressive curve
  is hero/landing only. Press translates 1px — the stock pushing into the desk. All
  motion respects `prefers-reduced-motion`.
- **Avoid:** glassmorphism, generic neumorphism, app-store gradients, plastic
  surfaces, cartoon softness, crypto-dashboard polish, excessive blur, decorative
  luxury. This is tactile, not gimmicky.

---

## ICONOGRAPHY

- **One set, one weight.** A curated **Lucide** subset rendered at **1.75 stroke** —
  the single line weight the brand uses — inheriting `currentColor`. Shipped as the
  `Icon` React component (`components/primitives/Icon.jsx`); reference glyphs by
  `name` (`<Icon name="train" />`). `ICON_NAMES` lists the full set.
- **Domain-first.** The set is travel-led: `train · plane · walk · car · coach ·
  ferry · bed · key · ticket · scan · navigation · compass · route · luggage`, plus
  UI essentials (`bell · chevron · check · lock · user · wallet · alert · clock`).
- **No emoji, ever.** No emoji and no unicode-glyph icons in product or marketing
  surfaces — they read as touristy and break the operational tone.
- **Wayfinding numbers are not icons.** Platform / gate / seat numbers render as the
  charcoal `WayfindBadge`, not a glyph — the number IS the sign.
- If you need a glyph that isn't in the set, add it to `Icon.jsx` from Lucide at the
  same 1.75 weight rather than inlining a one-off SVG.

---

## Index / manifest

**Foundations**
- `styles.css` — the global entry point consumers link. `@import` lines only.
- `tokens/colors.css` — cool-stock palette: grounds, ink ramp, charcoal, gold,
  status families, salts, two themes (light default · Midnight dark).
- `tokens/material.css` — the tactile system: shadow atoms (`--lift`/`--sink`),
  letterpress text-shadows, the baked paper tooth (`--fibre`), and the
  `.pg` / `.pg-d` / `.engr` surface classes.
- `tokens/typography.css` — type scale + the `.h0…tiny`, `.eyebrow`, `.wordmark`
  classes. `tokens/spacing.css` — 4px spacing, radius, motion. `tokens/fonts.css` —
  Satoshi (self-hosted) + JetBrains Mono. `tokens/base.css` — document grounds.
- `primitives.css` — the base component classes (`.btn`, `.field`, `.pill`, `.sb`,
  `.card`, `.segmented`, …) the React components emit.

**Components** (`components/` — `window.DesignSystem_486fd8.<Name>`)
- `primitives/` — `Icon`, `Button`, `IconButton`, `Field`
- `surfaces/` — `PaperCard`, `Well`, `Chip`
- `artefacts/` — `WayfindBadge`, `StatePill`, `StubField`, `Perforation`

**UI kits**
- `ui_kits/planner/` — the active-day planner. Five interactive scenarios (rail
  commute, flight + hotel, evening out, field day, gap types) demonstrating every
  card family: now-hero, place container, rail/flight ticket, walk/drive leg,
  changeover, open-time gap, ticket sheet, work-lens.

**Specimen cards** (`guidelines/`) — the Design System tab: Colors, Type, Material,
Spacing, Brand groups.

**`SKILL.md`** — Agent-Skill front matter so this folder works in Claude Code.

---

## Caveats / fonts

- **Fonts are all genuine** — Satoshi is self-hosted (variable 300–900 + italic) and
  JetBrains Mono loads from Google Fonts (the brand's deliberate mono choice, not a
  substitution). Nothing was swapped.
- **No raster brand assets were provided** — the brand has no logo image; the mark is
  typographic (the KHONSERA wordmark + a single gold emblem dot). If a logomark
  exists, drop it into `assets/` and update the Brand cards.
- The dark "Midnight" theme is defined for every token but is only lightly exercised
  in the current UI kit (the planner runs in the light Dusk theme). Worth a dedicated
  overnight/Live screen.

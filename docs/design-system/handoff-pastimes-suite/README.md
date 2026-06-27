# Khonsera Pastimes — Claude Code handoff (Pastimes tab · Sudoku · Gin Rummy)

This package adds the **Pastimes** games tab and two games to the Khonsera app. **Solitaire already exists in the codebase** — it is *not* included here (it appears only as a card on the Pastimes screen, linking out to the app's existing Solitaire route).

Everything is built on the **Khonsera v7 "paper" design system**: warm cotton stock, letterpress-debossed glyphs, gold used only as punctuation, charcoal/ink felt for play surfaces.

```
design_handoff_pastimes_suite/
├── README.md
├── shared/                  ← the design system (link once; all screens use it)
│   ├── styles.css           ← entry: @imports fonts → tokens → type → base → primitives
│   ├── primitives.css       ← every base surface/control + paper-material utilities
│   ├── tokens/              ← colors.css · typography.css · spacing.css · fonts.css · base.css
│   └── assets/fonts/        ← Satoshi (variable). JetBrains Mono loads from Google Fonts.
├── pastimes/                ← the games TAB (hub screen)
│   ├── Pastimes.html        ← scaffold + page CSS; links ../shared/styles.css
│   └── pastimes.jsx         ← React tree (window render)
├── sudoku/
│   ├── Sudoku.html          ← scaffold + board/pad CSS
│   └── sudoku.jsx           ← generator + game (self-contained React)
└── gin-rummy/
    ├── GinRummy.html        ← scaffold + table/felt CSS; mounts the scripts below
    ├── gin-engine.js        ← pure game engine (no UI): deck, melds, scoring, AI
    ├── cards.jsx            ← the playing-card asset (window.KhonseraCards.Card)
    ├── gin-icons.jsx        ← line icons (window.GinIcons)
    ├── gin-flow.jsx         ← lobby / connect / players screens (window.GinFlow)
    └── gin-rummy.jsx        ← the table + app state machine (entry)
```

Open any `*.html` directly in a browser to run. React/Babel load from unpkg with pinned integrity hashes (bottom of each HTML). For production, **precompile the `.jsx`** instead of shipping the in-browser Babel transformer.

These files are **design references** — a prototype of the intended look and behaviour, not production code to copy verbatim. Recreate each screen in the target codebase's environment (React Native, SwiftUI, Flutter, web React, …) using its established components, navigation and data layer. The CSS in `shared/` **is** the real design system and is the source of truth for every token, surface and material treatment — reuse it on web, or translate its tokens into the platform theme.

---

## Material language (governs every surface)

Internalise these four rules; every component is an application of them. Lift the exact values from `shared/`.

1. **Surfaces are raised sheets of cotton stock.** Cards, tiles, chips, keys, the tab bar sit *above* the warm desk on a tight contact shadow with a bright bevelled top lip (`--lift`, `--lift-sm`, `--raise-chip`). No flat fills; no big blur halos (a blur reads as a smudge at small sizes).
2. **Ink and glyphs are debossed** (pressed *into* the stock), never grey. Light stock: `text-shadow: 0 1px 0 rgba(255,255,255,1), 0 -1px 0 rgba(36,30,22,.28)` — keep the colour, the shadow does the carving. Charcoal stock inverts: `0 -1px 0 rgba(0,0,0,.8), 0 1px 0 rgba(255,255,255,.14)`. Icons use the same as `drop-shadow()` pairs (`.engr-ico` / `.engr-ico-d`). The offset must scale with element size or small glyphs smudge.
3. **Charcoal blocks are the *same* stock in black** (`--char`, `.pg-d` / `.card-ink`) — the active tab, avatars, the dark pill. Press direction flips.
4. **Gold is punctuation only** (`--gold` `#93753c` / `--gold-2`). A 7px brand dot, a hairline, one accent stat, the "you" bar. **Never a button fill, never a large field.** Composition ≈ 60% stock · 24% ink · 12% structure · 4% gold.

Every card also carries a faint **fibre tooth** (`--fibre`, a baked fractal-noise SVG) at low opacity via an `::after` overlay — the dry cotton grain. **Type:** Satoshi (display/UI/body) + JetBrains Mono (codes, times, eyebrows, labels — uppercase, wide tracking). **No serif, no italic.**

---

## Pastimes (the games tab)

A new bottom-tab — a quiet "table" for the in-between moments of a travel day (the gate, the platform, the seat). Lists the games the app ships (Solitaire, Sudoku, Gin Rummy), keeps each player's **personal bests**, and shows the small **circle** of friends and an all-time **standings** board.

It is deliberately **not** a retention surface: **no day-streaks, no daily resets, no "come back tomorrow"** hooks. Stats are about beating your own best and your friends' all-time totals.

- **Viewport:** mobile, designed at **430 × 932**; stage centred, `max-width: 472px`, full-height column. Fixed header + scrolling body + fixed bottom tab bar.
- **Sections:** title block → recessed **stat strip** (Played / Won / Win rate) → **Games** (the workhorse card: raised icon tile with a debossed glyph, name + sub-line, a lead stat + two secondary, chevron) → **Your circle** (friend rows with tinted avatars + debossed initials; gold stat when a friend beats you; ghost "Invite someone") → **Standings** (recessed bar tracks; the "You" row golds its rank + fill) → privacy footnote → tab bar (active tab = charcoal medallion with a carved glyph).
- **Game links:** the cards link out — Solitaire → the app's **existing** Solitaire route (`../../Solitaire.html` in this prototype; wire to your router), Sudoku → `../sudoku/Sudoku.html`, Gin Rummy → `../gin-rummy/GinRummy.html`.
- **Privacy (product requirement):** scores stay on-device; the circle sees only what the user shares. Bests/aggregates are local-first; only explicitly shared results propagate. The leaderboard is opt-in shared data, not a server-owned global ranking.
- **State:** aggregates (played/won/rate); per-game bests (Solitaire & Sudoku time, Sudoku solved+avg, Gin record+rate+gins); circle `{name, initials, tint∈slate/sage/plum/terra, lastGame, lastResult, beatsYou}`; standings ranked by all-time wins. **No streaks, no resets — do not add them.**

---

## Sudoku

A full game on the warm desk. Self-contained React in `sudoku.jsx`; styling in `Sudoku.html`.

- **Generator** — full solution via randomised backtracking, then symmetric dig with a uniqueness check (`countSolutions` capped at 2). Difficulty = holes: Easy 40 / Medium 50 / Hard 56.
- **State** — givens vs entries vs pencil notes vs mistakes; selection highlights peers (row/col/box) and same-number cells; entering a value auto-clears it from peer notes. Undo stack, erase, hint, per-number remaining counts, completed-unit flash, win sheet. Keyboard: 1–9, Backspace/Delete, N (notes), arrows.
- **Material** — the board is one cotton sheet; each cell is a square **pressed into** it (`--cell-sink`). 3×3 boxes separated by widened gaps showing a 2.5px rule. **Givens** debossed ink (600); **entries** cool slate; **wrong** rust. Selected cell gets a gold inner ring; same-number cells a soft gold wash. Number keys are raised cotton; a finished number sinks.
- **Proportions** — board locked square (`aspect-ratio:1/1`, `--bs: min(100%, 440px, calc(100dvh - 326px))`) so it never squashes; digit size viewport-relative with a cap. Port as-is.

---

## Gin Rummy

Online-feel 1-v-1 on the ink felt. Real engine, a quiet AI opponent, every connection/multiplayer state drawn.

### Files & boundaries
- **`gin-engine.js`** — `window.GinEngine`. Pure, deterministic (seedable), no DOM. `createGame`, `applyMove`, `aiMove`, `meldsAndDeadwood`, `deadwoodValueOf`, `isGin`, `startNextRound`, scoring helpers, `cardId`/`cardsEqual`/`rankLabel`/`cardValue`. **Port as-is to the server** — it is the rules authority. Phases: `upcardNonDealer → upcardDealer → draw → discard → roundOver → gameOver`.
- **`cards.jsx`** — `window.KhonseraCards.Card({rank, suit, faceDown, style})`. Poker ratio (h = 1.4w); everything scales from a single `--cw` on an ancestor; injects its own stylesheet once. Reuse verbatim anywhere a card is shown.
- **`gin-rummy.jsx`** — `Table` (the felt), the round/game/left overlays, and `App` (screen machine: `players → connect/lobby → table`).

### Hand arrangement (latest behaviour)
The hand is **player-arranged, not auto-sorted**. Cards stay in *your* order; **drag** a card left/right to reposition it (others slide aside) — a tap with no movement still selects for discard. The arrangement persists across draws (drawn card lands on the right) and discards (gap closes). There is no auto-meld grouping or gold underline — spotting your own runs/sets is the player's job. The live **deadwood** number is kept (it's the rule for whether you *can* knock, not where your melds are).

### Sizing contract (reproduce on any platform)
```
landscape = vw > vh && vw >= 620
portrait : cw  = clamp(62, min((vw-24)/5.4, vh*0.165), 82)
           ccw = clamp(74, vw/4.5, 90);  ocw = ccw*0.58
landscape: ccw = clamp(56, (vh-148)/3.4, 94);  cw = ccw*0.82;  ocw = ccw*0.6
hand fan : step floored at 0.40*cw (fit-to-width otherwise)
```
Landscape is detected at `vw > vh && vw ≥ 620`; in landscape **all sizes derive from height** so opponent fan + piles + banner + hand fit a short viewport (`.felt.land` compacts vertical paddings).

### Interactions
- Tap stock or up-card to draw; tap a hand card to select (lifts 18px); **Discard** or **Knock/Gin** (knock enabled only when projected deadwood ≤ 10; the readout shows the projection live).
- The opponent's last action is narrated as a reveal line ("Took the up-card · discarded K♣").
- The connection menu (sliders icon) demonstrates every state — you reconnecting, opponent offline, no-signal (move queued), opponent left, concede. These are **demo triggers**; wire them to real socket events.

### Server notes
- `gin-engine.js` is the source of truth; never trust client-reported deadwood/knock. Run `applyMove` server-side and reconcile. The AI (`aiMove`) is a stand-in — replace with the opponent's real moves over the socket.

---

## Design tokens (in `shared/tokens/`)

**Colour (light "Stock"):** grounds `--paper #eae6dd` · `--paper-2 #e1dcd1` · `--card #fbfaf6` · `--card-2 #ebe7dd` (recessed) · `--char #1f2228`. Ink `--ink #20242b` · `--ink-2` · `--ink-dim #565b64` · `--ink-faint #9499a1`. Rules `--rule #dcd8ce` · `--rule-2 #c7c2b6`. Gold `--gold #93753c` · `--gold-2`. Avatar tints slate/sage/plum/terra. A full **dark "Dark Cotton"** theme exists under `[data-theme="dark"]` — support it if the app themes.

**Type:** Satoshi (300/400/500/600) + JetBrains Mono. No serif/italic. h1 34px, body 14px, eyebrow 10.5px, mono labels 8–8.5px. Tracking: eyebrow `.22em`, mono `.14–.18em`.

**Radii:** `--radius-xs 7 · -sm 10 · -md 14 · -lg 18 · -pill 999`. Cards/strip md; icon tiles 15px; avatars/dot round.

**Elevation/material:** `--lift` (raised sheet) · `--lift-sm` (lighter / pressed) · `--sink` & `--cell-sink` (recessed well) · `--lift-char` (charcoal block lifting) · `--raise-chip` / `--raise-chip-d` (tiny tile raise, no blur). Letterpress text + icons as in the Material section. Fibre tooth `--fibre` via `::after`, `mix-blend-mode:multiply`, opacity ≈ .1–.13.

**Fonts:** Satoshi self-hosted in `shared/assets/fonts/`; JetBrains Mono from Google Fonts. Bring these into the target app or substitute licensed equivalents.

---

## Porting checklist
- [ ] Bring `shared/` in as the design-system stylesheet (or map its tokens 1:1 — all values are in `tokens/`).
- [ ] Recreate **Pastimes** as a real tab; wire the game cards to routes (Solitaire → the **existing** Solitaire screen).
- [ ] Keep Pastimes local-first / opt-in sharing; **no streaks or resets**.
- [ ] Port `gin-engine.js` to the server as the rules authority; keep it pure. Replace `aiMove` + connection-state demo triggers with real multiplayer events.
- [ ] Reuse `cards.jsx` as the canonical card component (`--cw`-driven, self-styling). Keep the **drag-to-arrange** hand (no auto-sort).
- [ ] Port Sudoku as-is; keep the locked-square board.
- [ ] Keep the Gin sizing contract — it's what makes the hand legible in portrait and the table fit in landscape.
- [ ] Precompile JSX for production; drop the in-browser Babel `<script>`.

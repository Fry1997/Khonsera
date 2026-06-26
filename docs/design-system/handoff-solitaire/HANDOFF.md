# Handoff: Khonsera Solitaire (Klondike)

## Overview
A polished, screen-optimised single-player **Klondike Solitaire** game built in the Khonsera visual language. It pairs a deep ink-felt table with bespoke **cotton-stock playing cards** — letterpress-debossed pips, indices and court letters on a woven-linen card face. The game supports drag-and-drop and tap-to-foundation play, draw-1/draw-3 modes, undo, a move/time/score HUD, a recycle-able stock, and a quiet, premium win moment. State persists across reloads.

This is intended as the first of a potential suite of in-app card games, so the **playing-card asset module is deliberately separated** from the game logic and is reusable for other games (Spider, FreeCell, etc.).

## About the Design Files
The files in this bundle are **design references created in HTML/React-via-Babel** — a working prototype showing the intended look, proportions and interactions. They are **not** production code to ship as-is (they transpile JSX in the browser with Babel standalone and inject CSS at runtime).

The task is to **recreate this design in the target codebase's environment** using its established patterns — most naturally a real React + bundler setup (Vite/Next), React Native, or SwiftUI. Lift the exact visual values (colors, geometry, shadows, card proportions) and the game logic verbatim; re-house the styling in the project's normal styling system (CSS Modules, styled-components, Tailwind, native StyleSheet, etc.). If no environment exists yet, React + Vite + TypeScript with CSS Modules is a clean choice.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, card geometry, shadow/deboss systems, animations and interactions are all resolved. Recreate pixel-for-pixel. The card-face treatment (cotton weave + colored blind-deboss) is the signature of the design — preserve it precisely.

---

## Architecture (two layers)

### 1. `cards.jsx` — the playing-card asset module (reusable)
Self-contained IIFE that registers `window.KhonseraCards`. **No game logic lives here.** Exposes:

```js
const { Card, Face, Back, Suit, buildDeck, SUIT_KEYS, SUIT_PATH, rankLabel } = window.KhonseraCards;
```

- `<Card rank={1..13} suit="S|H|D|C" faceDown? className? style? onClick? />` — one card.
- `buildDeck()` → 52 `{rank, suit, id}` objects (id = `suit+rank`, e.g. `"S1"`).
- `SUIT_KEYS` = `["S","H","D","C"]`; `rankLabel(r)` → `"A"|"2"…"10"|"J"|"Q"|"K"`.
- Every card sizes from a single CSS custom property **`--cw`** (card width) set on the card or any ancestor. Height is always `--cw × 1.4` (poker ratio 2.5:3.5). All internal metrics (radius, font, deboss depth, weave scale) derive from `--cw`, so one number scales the whole card.

In a real codebase this becomes a `<PlayingCard>` component + a `cards.css`/module. Keep the `--cw`-driven scaling model — it is what makes the cards resolution-independent.

### 2. `solitaire.jsx` — the Klondike game (consumes the card module)
Single `<App>` React component. Pure client logic, no dependencies beyond React and `window.KhonseraCards`. Renders into `#root`.

### `Solitaire.html` — the shell
Links `styles.css` (Khonsera tokens/fonts), defines all **table/board/HUD/win** CSS in a `<style>` block, then loads React 18.3.1 + Babel standalone + the two JSX files. In production, drop Babel and compile the JSX normally; move the `<style>` block into a stylesheet/module.

---

## The card face — the signature treatment (recreate exactly)

A card face is built in stacked layers (all inside `.kc-face`, `border-radius: --cw×0.062`, `overflow:hidden`):

1. **Stock gradient** (base): `linear-gradient(150deg, #fbf9f4 0%, #f6f3ec 46%, #efe9dd 100%)`.
2. **Card body shadow** (on `.kc-face` box-shadow): top inner highlight + bottom inner warm shadow + 1px inner hairline + a drop shadow `0 (--cw×0.018) (--cw×0.05) rgba(40,30,15,0.18)`. This is what makes the card sit *on* the felt.
3. **Cotton weave** (`.kc-face::before`, `z-index:0`, **beneath the ink**): two `repeating-linear-gradient`s at **+45° and −45°**, each a fine cell `--wv = --cw×0.0235` wide with a bright thread `rgba(255,255,255,0.72)` and a shadow thread `rgba(122,104,74,0.17)`. `opacity:.5`. Real stock is woven *then* printed, so this must sit below the pips or it chews the glyph edges. **Do not use random `fractalNoise`** — it reads as sandpaper. The regular diagonal cross-hatch is the correct linen model.
4. **Inner frame** (`.kc-face::after`): inset `--cw×0.04`, radius `--cw×0.03`, a subtle inset highlight + `rgba(150,134,104,0.16)` hairline. A debossed bezel, not a drawn border.
5. **Ink (pips / indices / court letters / ace)** on top, `z-index:2`.

### Colored blind-deboss (the carve)
Glyphs are the suit color but appear *pressed into* the stock. Achieved with **zero-blur-ish twin drop-shadows** (offset scales with `--db = --cw×0.011`):
- SVG suits (`.kc-face .kc-suit`): `drop-shadow(0 (−db×0.45) (db×0.9) <suit-edge>) drop-shadow(0 (db×0.5) (db×1.1) rgba(255,255,255,0.85))` — dark bite on the **top** edge, bright rim on the **lower** edge.
- Text (rank `.kc-r`, court letter): same idea via `text-shadow` (bright below, dark above).

Suit colors:
- Red suits (`.red`): fill `#a8503c`, edge `rgba(96,33,22,0.55)`.
- Black suits: fill `#3a332a`, edge `rgba(22,16,9,0.6)`.

(These are warm, ink-on-paper tones — **not** pure `#ff0000`/`#000000`. Keep them.)

### Suit SVG paths (viewBox `0 0 100 100`)
Use the exact paths in `cards.jsx` `SUIT_PATH` (S/H/D/C). They were hand-tuned to avoid a known artifact where tight concavities (spade/club stems) rendered with a "ghost"/double-tail under the deboss filter. **Don't substitute generic glyph fonts or other SVG suits** without re-checking the deboss render — blur on the drop-shadows reintroduces the split-stem ghosting. Keep drop-shadow blur small.

### Card anatomy by rank
- **Number cards 2–10**: pip grid. `PIPS` table gives `[x, y]` as fractions of the pip field (`.kc-pips` inset `top/bottom:12%`, `left/right:24%`). Any pip with `y > 0.5` is rotated 180°. Pip size `1.42em` (`em` = `--cw×0.1`).
- **Ace**: single large central suit (`46%`), spade ace gets a faint ornamental oval ring `.kc-ace-ring`.
- **Court (J/Q/K)**: an open, ornamental rank **letter** (Satoshi, weight 400, `3.5em`, debossed) flanked by a mirrored suit pair top and bottom. No portrait art, no framed medallion — restraint is the point.
- **Corner index** (`.kc-corner` tl/br, br rotated 180°): rank label (Satoshi 600, `1.18em`) above a small suit (`0.82em`). Positioned `top/left: --cw×0.092 / --cw×0.10` so it sits cleanly **inside** the inner frame (earlier versions touched it — keep this clearance).

### Card back (optional, `faceDown`)
Cotton stock + a **debossed diamond lattice** (`.kc-back-field`: crossed ±45° repeating gradients) inside a debossed frame. The game currently uses it for the stock pile. (Note: an earlier "nipple in the middle" back was rejected — the lattice is the approved back.)

---

## The table / board (in `Solitaire.html`)

### Felt table (`.felt`)
- Background: `radial-gradient(130% 100% at 50% -8%, #25303a 0%, #1a232c 38%, #141a21 70%, #0e1318 100%)` — deep ink/charcoal, lighter at top.
- `::before` woven felt tooth: monochrome `fractalNoise` SVG, `opacity:.12`, `mix-blend-mode:overlay`, `180px` tile. (Subtle — earlier louder values looked like graph paper; keep it at .12.)
- `::after`: bottom vignette + soft top sheen.
- Text color `#e8e2d6`.

### Top bar (`.bar`)
- **Brand** (left): a 7px radial-gradient gold `dot` (`#c8ab6e → #93753c → #6f5827`) + "KHONSERA" wordmark (weight 300, `letter-spacing:0.22em`, uppercase, 12px, `#c3bdb0`).
- **Stats** (`.stat` ×3 — Moves / Time / Score): small sunken plaques, `linear-gradient(180deg, rgba(255,255,255,.045), rgba(0,0,0,.12))` with inset shadows. Label `.k` (JetBrains Mono, 8.5px, 0.14em, uppercase, `#7c8590`), value `.v` (Satoshi 500, 15px, `#ece6da`, tabular-nums). Score stat hides under 468px.
- **Tools** (`.tool`): raised pill buttons, `linear-gradient(180deg, #313c46, #232c34)`, inset top highlight + dark hairline + drop shadow. `:active` presses in (translateY 1px + inset shadow). 34px tall, radius 9px. The **Draw 1/3 toggle** is a segmented control; the active segment `.seg.on` is gold `linear-gradient(180deg,#d8c089,#b9985a)` with dark text. Tool labels hide under 480px (icons remain).

### Board layout (`.board`)
- Flex column: a **top row** (`.toprow`) then the **tableau** (`.tableau`).
- **Top row**: stock + waste on the left, four **foundations** pushed right (`margin-left:auto`). Bottom margin `--cw×0.34`.
- **Tableau**: 7 columns, `gap = --cw×0.16`.
- Card width `--cw` is computed responsively (see below); `--gap` follows.

### Piles & cards
- **Slot** (empty target, `.slot`): `--cw × (--cw×1.4)`, radius `--cw×0.075`, **inset** shadow (a pressed well) + faint dark fill `rgba(0,0,0,0.14)`. A lit drop target (`.slot.lit`) gets a gold inset ring + outer glow. Foundations show a ghost suit (`SUIT_KEYS[f]`) when empty; an empty stock shows a recycle icon.
- **Positioned card** (`.pc`): absolutely placed in its pile, `transition: top .18s cubic-bezier(.2,.7,.3,1)`.
- **Lift** (`.pc.lift` — movable face-up tops & dragged cards): adds a stronger drop shadow so the playable card floats above the stack.
- **Fan offsets**: face-down tableau cards fan by `--cw×0.20`, face-up by `--cw×0.34`. Draw-3 waste fans by `--cw×0.26`.

---

## Interactions & behavior

### Dealing
`freshGame()`: shuffle (Fisher–Yates), deal 7 tableau columns (col *n* gets *n+1* cards, only the last face-up), remainder → stock (face-down). Foundations empty. `dealIn` keyframe (`opacity 0 + translateY(-14px) scale(.96)` → none, `.34s`) can animate cards in.

### Stock / waste
- Tap stock → draw `draw3 ? 3 : 1` card(s) to waste, face-up.
- Stock empty + tap → recycle waste back to stock (face-down, reversed).
- Only the **top** waste card is grabbable/playable.

### Moving cards
- **Pointer drag** (mouse + touch via Pointer Events): `pointerdown` on a face-up card arms a grab; movement >5px starts a drag. A fixed-position **drag layer** (`.draglayer`, `z-index:50`) renders the moving stack following the pointer; the source cards are hidden (`opacity:0`). On `pointerup`, `hitTest` finds the nearest pile under the pointer (with a forgiving hit box, esp. +80px below for tall columns) and `applyMove` validates + commits.
- **Tap (no drag)** on a top card → `flyHome`: auto-send to the first legal foundation.
- Dragging a **sequence** from the tableau is supported (grab a face-up card mid-column, all cards below come with it).

### Move rules
- **Foundation**: empty accepts an Ace; otherwise same suit, rank +1. (`foundationOk`)
- **Tableau**: empty accepts a King; otherwise alternating color, rank −1. (`tableauOk`)
- After moving from a tableau column, a newly exposed face-down card flips up (+5 score).

### Scoring (Klondike-ish)
- To foundation: **+10**. Waste→tableau: **+5**. Flip a tableau card: **+5**. Score floored at 0. Moves increment on every committed action.

### Undo / new game
- **Undo**: history stack (last 60 states, deep-cloned) — restores previous state, clears win.
- **New game**: fresh deal, resets history/timer/win.

### Timer
Counts up once the first move is made (`running` ref); stops on win. Format `m:ss`.

### Win
When all 4 foundations reach 13 (52 cards home): `.win` overlay fades in (`opacity .5s`) over a radial scrim; a cream **plate** (`linear-gradient(155deg,#fbf9f4,#efe9dd 60%,#e7e0d2)`, radius 16px, big soft drop shadow) slides up (`translateY(10px) scale(.97)` → none). Content: KHONSERA mark, "Day complete." (Satoshi 500, 25px, `#2a241c`), "Every card home, in order.", a Time/Moves/Score result row, and a gold **New game** button. Deliberately quiet — no confetti.

### Persistence
On every state/draw-mode/elapsed change, `localStorage["khonsera_solitaire_v2"] = JSON.stringify({ g, draw3, elapsed })`. Restored on load. (Use the same key only if you want to preserve in-progress games across the rebuild; otherwise namespace per the app.)

### Responsive card sizing (`--cw`)
`useLayoutEffect` + `ResizeObserver` on the board: `--cw` = `floor(min((boardW-28)/7.96, boardH/6.14, 104))`, min 40px. So 7 columns + 6 gaps (`0.16cw`) always fit the width, and a full column fits the height. **Both portrait and landscape work** — this single calc is what makes it screen-optimised. Preserve it.

---

## State model (for the rebuild)
Top-level game object `g`:
```
{
  stock:       Card[],        // face-down draw pile
  waste:       Card[],        // dealt cards (top playable)
  foundations: Card[][],      // 4 piles, build up by suit A→K
  tableau:     Card[][],      // 7 columns, build down alt-color
  moves:       number,
  score:       number,
}
// Card = { rank: 1..13, suit: "S"|"H"|"D"|"C", id: "S1", up: boolean }
```
Plus UI state: `draw3`, `elapsed`, `hist` (undo stack), `won`, `drag`, `flash` (foundation index to flash on land). Deep-clone helper `clone(g)` is used before every mutation so undo/history stay immutable.

---

## Design Tokens

### Card stock
| Token | Value |
|---|---|
| paper (top) | `#fbf9f4` |
| paper (mid) | `#f6f3ec` |
| paper (low) | `#efe9dd` |
| ink (default) | `#26211a` |
| red suit fill | `#a8503c` · edge `rgba(96,33,22,0.55)` |
| black suit fill | `#3a332a` · edge `rgba(22,16,9,0.6)` |
| weave bright thread | `rgba(255,255,255,0.72)` |
| weave shadow thread | `rgba(122,104,74,0.17)` |
| card radius | `--cw × 0.062` |
| card ratio | h = `--cw × 1.4` |
| deboss depth `--db` | `--cw × 0.011` |
| weave cell `--wv` | `--cw × 0.0235` |

### Table & chrome
| Token | Value |
|---|---|
| felt gradient | `#25303a → #1a232c → #141a21 → #0e1318` |
| felt text | `#e8e2d6` |
| gold (accent) | `#d8c089 → #b9985a` (button) · `#c8ab6e/#93753c/#6f5827` (dot) |
| tool button | `#313c46 → #232c34` |
| stat plaque | `rgba(255,255,255,.045) → rgba(0,0,0,.12)` |
| slot fill | `rgba(0,0,0,0.14)`, inset well shadow |
| lit/flash accent | `rgba(201,171,110,…)` (gold) |
| win plate | `#fbf9f4 → #efe9dd → #e7e0d2` |

### Typography
- **Satoshi** — ranks, court letters, stat values, headings, button labels (weights 300/400/500/600). Loaded via Khonsera `styles.css`.
- **JetBrains Mono** — stat/result micro-labels and the draw 1/3 segments (the `.k` caps + segments).
- Fallbacks: `"Satoshi","Inter",system-ui,sans-serif`.

### Timing / easing
- Card slide: `.18s cubic-bezier(.2,.7,.3,1)`.
- Deal-in: `.34s cubic-bezier(.2,.8,.3,1)`.
- Win fade: `.5s ease`; plate rise `.5s cubic-bezier(.2,.8,.3,1)`.
- Foundation land flash: `.5s ease`.
- Button press: `transform .08s`, `filter .12s`.

---

## Assets
- **No external image assets** — every card, pip and texture is pure CSS/SVG (this is intentional and keeps the cards crisp at any size). The suit SVG paths live in `cards.jsx`.
- **Fonts**: Satoshi (bundled in the Khonsera design system under `tokens/` / `assets/`, loaded by `styles.css`) and JetBrains Mono. In the target codebase, use the project's existing Satoshi setup or self-host the same files.
- `styles.css` + `primitives.css` are included for the Khonsera tokens/`@font-face`; the game only actually depends on the **fonts** and a couple of color sensibilities — it does not need the full design system to run.

## Files in this bundle (`design/`)
- `Solitaire.html` — shell: table/board/HUD/win CSS + script loading. **Start here.**
- `cards.jsx` — reusable playing-card asset module (`window.KhonseraCards`). The signature card treatment.
- `solitaire.jsx` — the Klondike game (`<App>`): deal, rules, drag/tap, undo, scoring, timer, win, persistence, responsive sizing.
- `styles.css` / `primitives.css` — Khonsera global tokens + `@font-face` (Satoshi). Provides fonts/tokens.
- `tokens/`, `assets/` — supporting token CSS and font/brand assets referenced by `styles.css`.

## Rebuild checklist
1. Port `cards.jsx` → a `<PlayingCard>` component + stylesheet, preserving the `--cw` scaling, the weave-beneath-ink layering, and the colored blind-deboss shadows. Verify pips/suits render solid (no ghost stems, no glyphs chewed by the weave).
2. Port `solitaire.jsx` game logic verbatim (rules, scoring, undo, drag via Pointer Events, responsive `--cw` calc).
3. Recreate the felt table, HUD and win overlay from the `Solitaire.html` `<style>` block.
4. Wire Satoshi + JetBrains Mono from the project's font system.
5. Decide on the localStorage key / persistence strategy for your app.
6. Confirm portrait **and** landscape both fit (the `--cw` calc handles this — don't hardcode card sizes).

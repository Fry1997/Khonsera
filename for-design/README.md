# for-code.zip — Code → Design: the booked-document family + the Wallet

**One family this round.** The planner's travel-document layer (master brief §6–§7): the cards the
user actually presents at the barrier, and the Wallet where they live. Four new components —
`TicketCard`, `StatusStrip`, `BarcodePresenter`, `ScanView` — plus the Wallet surface that reuses
them. Code has built them as **live, token-styled placeholders**; you elevate the finish.

> Already designed, **not in this pack:** the planner spine cards (`AnchorCard`, `LegCard`,
> `GapCard`, `IntentionCard`, `ComparisonMatrix`) — Round 1. The app shell, auth, Today, landing.
> This round is *only* the document family + Wallet.

## The ask
- **Spec:** `screen-specs/documents-and-wallet.md` — every member, its data, its states, and the two
  hard-line correctness surfaces (`BarcodePresenter` frame + `ScanView`).
- **See it live:** `/wallet?demo=1` (staff) renders the whole family from fixtures — compact
  TicketCards grouped by day, StatusStrips, and ScanView opens from a card. Screenshot **390 / 744 /
  1280** and elevate over it. Mobile (390) is the source of truth — these are used one-handed, on a
  platform, in a hurry.

## Ground truth (don't reinvent)
- `handoff/class-data-map.md` — the exact DOM + `data-*` to style by.
- `reference/document-cards.reference.tsx` · `fixtures.reference.ts` — the components + sample data.
- `reference/design-tokens.md` · `component-contract.md` (the family is now registered).
- `reference/khonsera-edition-ii-*.css` — the brand + screen + shell + landing layers. The document
  family's functional floor is the `BOOKED-DOCUMENT FAMILY` + `.cc-wallet-*` blocks in `…-shell.css`.
  **Extend; never globals.css. Tokens only.**
- `reference/brand/mk-ink.png` (light) / `mk-brass.png` (dark) — the only mark. Crescent retired.

## Two places craft yields to correctness (hold the line)
- **BarcodePresenter** — preserved quiet zone, maximum contrast, **nothing overlaid on the code**. No
  gold tint, no texture, no mask biting the matrix. A lovely card that won't scan is a failure.
- **ScanView** — white ground, brightness maxed, big centred code, minimal chrome. **Function over
  finish (§6.3).** No dark mode, no low-contrast linen. Restraint here = getting out of the scanner's
  way.

## What to return (`for-code.zip`)
- All members × their states × **390 / 744 / 1280** (list in the spec).
- An **additive override CSS** by the existing classes/`data-*`, imported last. **Never globals.css.**
- A **class + `data-*` map** for any new hooks; **token requests** for any new value.
- **Redlines** — rail-card hierarchy, the consequence band, change/tight-connection treatment,
  StatusStrip palette discipline, the barcode frame rules, the ScanView function-first layout.

Calm by default; one accent; no emoji; copy voiced as "Khonsera". Hand it back and Code wires it to
the real booked-document data (the §6 materialise + offline cache).

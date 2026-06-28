# Design reconciliation — CURRENT vs LEGACY, and the path to one aesthetic

Companion to `docs/design-north-star.md` (the soul + the finger test). This is
the evidence-based map that resolves the "everything reads half-old, half-new"
rut, and the plan to strip the codebase down to the cotton-paper material.

## The good news (the verdict)
The new aesthetic is **not a vibe scattered everywhere — it's a real, isolated
system**, and the live app already uses it almost exclusively. The mess is two
separable problems, not one tangle:

1. **Legacy cruft physically coexists** — both the Edition II *and* Edition III
   stylesheets load at once (15 `@import`s in `layout.tsx`, ~4,000 lines), kept
   alive only by a handful of **dormant components** still in the tree.
2. **The current shell isn't *fully* material yet** — it uses the cotton tokens
   but most surfaces (and ~90% of **text**) are still flat, so even the "new"
   pages don't fully pass the finger test.

Fix both and the rut is gone: strip (1), deepen (2).

## CURRENT — the cotton-paper material (keep + deepen)
- **Material atoms** (`globals.css`): `--lift`, `--lift-sm`, `--lift-char`,
  `--sink`, `--hi`, `--sh-1/2/3`, `--fibre`. The whole pressed/textured kit.
- **Ground tokens**: `--ground / --screen / --widget / --well / --char`
  (+ `--ink*`, `--gold*` punctuation, the rare salts `--terra/--plum/--sage/...`).
- **Letterpress classes**: `.engr`, `.engr-d`, `.engr-deep`, `.pg`, `.engr-ico`.
- **The live shell vocabulary**: `.cc-*` (1,667 hits across 44+ files) — the
  exclusive system on every live page (`/plan`, `/today`, `/wallet`, `/tasks`,
  `/navigate`). **Zero** legacy `.btn-*`/`.j-card`/`.k-card` in any live page.
- **CSS files**: `globals.css` + `khonsera-edition-iii*.css`
  (`.css`, `-live`, `-nav`, `-connections`, `-sharing`, `-round13`).
- **Themes**: `dusk` (light default), `midnight` (dark). `cotton` map theme.

## LEGACY — flat/older, kept alive only by dormant code (strip)
- **Edition II stylesheets** (8 files, ~1,870 lines): `khonsera-edition-ii.css`
  + `-screens/-shell/-landing/-landing-shot/-documents/-wallet`. Pure legacy —
  imported only because dormant components reference them.
- **Legacy `globals.css` classes**: `.brief-*` (24), `.j-*`, `.k-*`,
  `.btn-primary/.btn-terra/.btn-destructive`, `.input-base` — all 0 hits on live
  pages; direct duplicates of `.cc-btn*`, `.cc-*-card`, `.cc-field`.
- **Duplicate ground aliases**: `--paper`/`--paper-2`/`--sand`/`--sand-2`
  (diverge in value from the canonical `--ground/--screen` — kill, alias, or
  delete).
- **Dormant components** keeping the above alive: `itinerary-editor.tsx`,
  `new-itinerary-form.tsx` (Brief), `capture/*` (benched parser UI),
  `cotton-map.tsx` (the abstract SVG — superseded), `mode-switch-control.tsx`,
  `static-map.tsx`, `route-map.tsx`.
- **Retired theme**: `sahara` (already a no-op alias).

## AMBIGUOUS — your calls
- **Settings/Admin pages** still use legacy `.btn-primary`/`.input-base` and are
  *mounted*. So they're not fully dormant — they need migrating to `.cc-*`
  before the legacy buttons/inputs can be deleted. (Small surface; do it as part
  of the strip.)
- **`.sb` status pills** are used by *both* eras (hybrid) — keep, it's current.
- **`cotton` vs `dusk`** as the map's direction is settled elsewhere
  (`native-map-strategy.md`); not part of this shell reconciliation.

## The gap that makes it still feel half-done
Even on the current `.cc-*` pages, the material treatment is **applied to only a
few classes** (`.cc-anchor-card`, `.cc-pass`, `.cc-doc-card` + ~5 others get
`--lift` + a text-shadow). Everything else is cotton-*coloured* but **flat**:

- **~90% of text is flat** — the base type scale (`.h0`–`.h3`, `.body`, `.small`,
  `.tiny`, `.uc`, `.eyebrow`, `.display`) and all UI labels/buttons have **no
  deboss**. This directly violates North Star **Law 5 (all text debossed)**.
- Most surfaces don't carry `--lift`/`--sink`/`--fibre` — they read as flat
  cards, not pressed cotton.

This — not the legacy cruft — is what you *feel* as "not my aesthetic yet."

## Convergence plan (two workstreams)

### A. DEEPEN — make it pass the finger test (the felt work; do first)
1. **All text debossed (Law 5).** Apply the letterpress `text-shadow` as a
   theme-aware default on the type scale + UI text (light → `.engr` recipe,
   dark → `.engr-d`). This is the single biggest, most-visible step toward the
   vision and is mostly a handful of global rules. *(Care: tune per theme; verify
   on real surfaces — it can muddy if over-applied to tiny/low-contrast text.)*
2. **Universal press + texture.** Give every card/sheet/well surface
   `--lift`/`--sink` + the `--fibre` tooth (not just the ~8 classes). Buttons,
   chips, inputs get a pressed treatment.

### B. STRIP — remove the old so neither tool can reach for it (safe cleanup)
1. Migrate the few mounted legacy users (Settings/Admin) to `.cc-*`.
2. Delete the dormant components (or their legacy class usage).
3. Drop the 8 Edition II `@import`s from `layout.tsx`; delete those files.
4. Remove the legacy `globals.css` classes (`.brief-*/.j-*/.k-*/.btn-primary/
   .input-base`) and the duplicate `--paper/--sand` aliases.
5. Result: one stylesheet family (`globals.css` + `edition-iii*`), one class
   vocabulary (`.cc-*`), one token set — the single source of truth Design and
   Code re-ground on.

## Sequence + verification
- **Deepen first** (you *see* progress); **strip in parallel** (invisible but
  ends the muddle). Each strip step is verified by: app builds, live pages
  unchanged (they don't use the deleted classes), and the deleted CSS isn't
  referenced (grep before delete).
- Definition of done: every live surface passes the **finger test** (pressed,
  textured, *debossed text*), and `layout.tsx` imports only the Edition III +
  globals stylesheets.

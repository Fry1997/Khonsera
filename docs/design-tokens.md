# Khonsera — Design Tokens (canonical manifest)

**This file + `docs/component-contract.md` are the two artifacts to re-ground every Design and
Code session on** (per the Design↔Code Handoff Protocol). The source of truth is the CSS custom
properties in `src/app/globals.css` (base) **re-pointed by `src/app/khonsera-edition-ii.css`** (the
**Edition II** brand layer, imported after globals.css); `tailwind.config.ts` proxies them. This doc
is the human-readable mirror.

> **Edition II is live** (Design handback, drop-in override). `globals.css` is left **untouched** and
> reversible; the override re-points tokens (all three palettes) and crisps the product surfaces.
> Values below reflect the **effective Edition II** result.

## Iron rule
Nothing references raw values. Both Code and Design speak **token names**, never `#hex` or `16px`.
If Design needs a value with no token, that's a **token request** → Code adds it to `globals.css`
**and this file** → both re-ground. Tokens never fork.

## Fonts — Design System 2 (sans-only)
| Token | Family | Role |
|-------|--------|------|
| `--font-display` / `--display` | **Satoshi** (self-hosted woff2) | Headlines, wordmark |
| `--font-ui` / `--sans` | **Satoshi** | UI **and** body — one sans across the app |
| `--font-editorial` / `--serif` | **Satoshi** (serif retired) | No editorial serif — Satoshi (its own italic) where italic is used |
| `--font-technical` / `--mono` | JetBrains Mono | Codes, times, eyebrows |

> DS2 is **sans-only**: Satoshi carries display + UI + body, **self-hosted** via `@font-face`
> (offline-safe; Fontshare link kept for first paint). **Inter retired** earlier; now the **serif is
> retired too** (Cormorant/Spectral gone — `--serif` aliased to Satoshi). The voice is operational —
> emphasis comes from weight, tracking and the mono technical layer, never a literary italic.

## Colour — brand (per palette: dusk default, sahara, midnight)
`--paper --paper-2 --sand --sand-2 --card --card-2` (grounds) · `--ink --ink-2 --ink-dim --ink-faint`
(text) · `--rule --rule-2` (dividers) · gold ramp `--gold-100 --gold-200 --gold(400) --gold-2(600)
--gold-800 --gold-soft --gold-tint` · rare salts `--terra(-2/-deep) --plum --plum-soft` · cool foil
`--slate --slate-2 --slate-soft`. Each palette redefines these; reference the name, never the hex.

> **Design System 2 — cotton-paper (canonical, in `globals.css`):** the warm walnut Dusk is RETIRED.
> Cool heavy white cotton stock — card face `--widget`/`--card` #fbfaf6 on a warm desk `--ground`
> #e4e0d6; cool near-black letterpress `--ink` #20242b, `--ink-dim` rgba(32,36,43,.56); muted "moon"
> gold `--gold` #93753c / `--gold-2` #8a6d38, **punctuation only — never a fill** (the lead action is
> the charcoal block `--char` #1f2228 with `--cream` text). New **material tokens**: grounds
> `--ground --screen --widget --well --char`, atoms `--lift --lift-sm --sink --lift-char --fibre`
> (paper tooth), plus `--cream --line --elevation-card --elevation-raised`. Classes: `.pg/.pg-d`
> (paper + deboss), `.engr/.eyb` (letterpress), `.perf` (ticket perforation), `.well`. Themes:
> **Light** + **Midnight** (`[data-theme=dark]` — charcoal field, cream ink, brass moon); **Sahara
> retired** (no-op alias → inherits Light).

## Colour — semantic (aliases over the brand ramp; follow the active palette)
| Token | Maps to | Use |
|-------|---------|-----|
| `--success` / `--success-soft` | sage | confirmations, "fits" |
| `--warning` / `--warning-soft` | amber | caution, "tight" |
| `--danger` / `--danger-soft` | rust | errors, "infeasible" |
| `--disruption` | rust | disruption/alert state |
| `--info` / `--info-soft` | slate | neutral info chips/links |

## Elevation
`--shadow-sm --shadow --shadow-lg` (+ `--ink-soft`, `--gold-soft-alpha`, `--gold-tint` for tinted layers).

## Type scale (size / line-height / letter-spacing / weight)
| Step | Size | LH | LS | Weight | Class |
|------|------|----|----|--------|-------|
| display | `--fs-display` 56 | `--lh-display` 1.02 | `--ls-display` -0.035em | `--fw-medium` | `.h0` |
| h1 | `--fs-h1` 40 | `--lh-h1` 1.05 | `--ls-h1` -0.03em | medium | `.h1` |
| h2 | `--fs-h2` 28 | `--lh-h2` 1.1 | `--ls-h2` -0.025em | medium | `.h2` |
| h3 | `--fs-h3` 15 | (inherit) | `--ls-h3` -0.005em | `--fw-semibold` | `.h3` |
| body | `--fs-body` 14 | `--lh-body` 1.5 | — | regular | `.body` |
| label | `--fs-label` 12 | `--lh-label` 1.45 | — | — | `.small` |
| micro | `--fs-micro` 10.5 | — | — | — | `.tiny` / `.uc` / `.eyebrow` |

Weights: `--fw-regular` 400 · `--fw-medium` 500 · `--fw-semibold` 600. Tracking: `--ls-uc` 0.12em ·
`--ls-eyebrow` 0.22em. Tailwind: `text-display/h1/h2/h3/body/label/micro`.

## Spacing scale (4px base)
`--space-0` 0 · `--space-0-5` 2 · `--space-1` 4 · `--space-1-5` 6 · `--space-2` 8 · `--space-2-5` 10
· `--space-3` 12 · `--space-3-5` 14 · `--space-4` 16 · `--space-4-5` 18 · `--space-5` 20 · `--space-6` 24 · `--space-8`
32 · `--space-12` 48. (Tailwind's numeric `gap-2`/`p-3`… already resolve to these px values.)

## Radius scale
Base tokens (globals.css, unchanged): `--radius-xs` 3 · `--radius-sm` 4 · `--radius-md` 6 ·
`--radius-lg` 12 · `--radius-xl` 18 · `--radius-pill` 999.

> **Edition II — crisp, near-square.** The override pulls **product surfaces** down to a 4–7px scale
> directly on the atom classes (`.card`/`.btn`/`.field`/`.kpi`/`.trip-row`/`.icon-button`/`.chip`),
> not via the tokens. Pills stay fully round (a deliberate affordance). NOTE: the concierge contract
> components use `rounded-card`(`--radius-xl` 18)/`rounded-field`(12) — **the override does not yet
> reach those tokens**, so the newer concierge screens (today/timeline/tasks/contacts/compare/
> workspace) inherit Edition II *colour + type* but keep the rounder corners until a follow-up pass.

## Motion
Durations `--dur-fast` 80ms · `--dur-base` 120ms · `--dur-slow` 150ms. Easings `--ease-standard`
`cubic-bezier(.2,0,0,1)` · `--ease-out` (entrance) · `--ease-in` (exit). Calm by default. Tailwind:
`duration-fast/base/slow`, `ease-standard/entrance/exit`.

## Brand utility classes (reusable, in `globals.css`)
Buttons `.btn .btn-gold .btn-ink .btn-ghost .btn-primary .btn-terra .btn-destructive` · cards
`.card .card-soft .card-hero .card-ink .k-card .j-card` · pills/chips `.pill .pill-{gold,sage,amber,
rust,slate,soft,ink} .chip` · status `.sb .sb-*` · type `.h0–.tiny .display .serif .mono .uc
.eyebrow` · inputs `.field` · layout `.desk-* .brief-* .editor-grid .stat-grid .trip-feed` · timeline
`.tl .tl-*` · nav `.nav-tab .tabbar`.

## Known exceptions (intentional raw values — not token violations)
- `src/components/journey-map/themes/*` + `map-style/` — MapLibre rendering needs literal colours/
  geometry; a separate, intentional values-holder. Not synced to the app palette.
- `src/components/place-picker.tsx` — Google logo brand hex (third-party).

## Token-request flow
Design flags a missing value → Code adds the `--token` to `globals.css` (+ Tailwind proxy if a
utility is wanted) → records it here → both re-ground. Never hardcode a one-off.

## Migration status
Colours + fonts: tokenised (~100%). Type scale: tokenised; the `.h0–.tiny`/`.uc`/`.eyebrow` classes
consume the tokens. Radius/motion: tokenised; canonical surfaces (`.card*`, `.field`, `.pill`,
`.btn`) consume them. **Deferred:** ~613 inline `style={{…}}` blocks still hold raw px for
spacing/size — migrated incrementally per component during relay round-trips, not in one sweep.

# Khonsera — Design Tokens (canonical manifest)

**This file + `docs/component-contract.md` are the two artifacts to re-ground every Design and
Code session on** (per the Design↔Code Handoff Protocol). The source of truth is the CSS custom
properties in `src/app/globals.css`; `tailwind.config.ts` proxies them. This doc is the
human-readable mirror.

## Iron rule
Nothing references raw values. Both Code and Design speak **token names**, never `#hex` or `16px`.
If Design needs a value with no token, that's a **token request** → Code adds it to `globals.css`
**and this file** → both re-ground. Tokens never fork.

## Fonts — Edition II (sans-led)
| Token | Family | Role |
|-------|--------|------|
| `--font-display` / `--display` | Satoshi (Fontshare) | Headlines, wordmark |
| `--font-ui` / `--sans` | **Satoshi** (Inter = fallback) | UI + body — one sans across the app |
| `--font-editorial` / `--serif` | **Spectral** (next/font) | Rare editorial serif italic accent |
| `--font-technical` / `--mono` | JetBrains Mono (next/font) | Codes, times, eyebrows |

> **Edition II (Design handback):** the stack is now **sans-led** — Satoshi carries UI + body;
> Inter is retired to a graceful fallback; the serif accent moved **Cormorant → Spectral** (rare use
> only). Supersedes the earlier code-canonical D4 (Inter/Cormorant) per Design's brand-book authority.

## Colour — brand (per palette: dusk default, sahara, midnight)
`--paper --paper-2 --sand --sand-2 --card --card-2` (grounds) · `--ink --ink-2 --ink-dim --ink-faint`
(text) · `--rule --rule-2` (dividers) · gold ramp `--gold-100 --gold-200 --gold(400) --gold-2(600)
--gold-800 --gold-deep --gold-soft --gold-tint` · rare salts `--terra(-2/-deep) --plum --plum-soft` ·
cool foil `--slate --slate-2 --slate-soft`. Each palette redefines these; reference the name, never the hex.

> **Edition II additions/changes (dusk):** new `--label` (legible eyebrow/uc/mono micro-text, replaces
> faint `--ink-soft`/`--ink-faint` for labels) · new `--rail` (timeline rail, aliases `--rule-2`) · new
> `--gold-deep`. Gold ramp re-tuned (`--gold` #a97f33 / `--gold-2` #8a6418). The dusk **colours** were
> restyled; sahara/midnight keep their colours but inherit the new scales below. `--disruption` now → `--terra`.

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
| display | `--fs-display` 52 | `--lh-display` 1.0 | `--ls-display` -0.035em | `--fw-medium` | `.h0` |
| h1 | `--fs-h1` 34 | `--lh-h1` 1.06 | `--ls-h1` -0.03em | medium | `.h1` |
| h2 | `--fs-h2` 27 | `--lh-h2` 1.1 | `--ls-h2` -0.022em | medium | `.h2` |
| h3 | `--fs-h3` 17 | `--lh-h3` 1.28 | `--ls-h3` -0.012em | `--fw-semibold` | `.h3` |
| body | `--fs-body` 15 | `--lh-body` 1.55 | — | regular | `.body` |
| label | `--fs-label` 12.5 | `--lh-label` 1.45 | — | — | `.small` |
| micro | `--fs-micro` 10.5 | — | — | — | `.tiny` / `.uc` / `.eyebrow` |

Weights: `--fw-regular` 400 · `--fw-medium` 500 · `--fw-semibold` 600. Tracking: `--ls-uc` 0.14em ·
`--ls-eyebrow` 0.22em. Tailwind: `text-display/h1/h2/h3/body/label/micro`. (Edition II: sizes
re-set sans-led — smaller headlines, larger h3/body.)

## Spacing scale (4px base)
`--space-0` 0 · `--space-0-5` 2 · `--space-1` 4 · `--space-1-5` 6 · `--space-2` 8 · `--space-2-5` 10
· `--space-3` 12 · `--space-4` 16 · `--space-4-5` 18 · `--space-5` 20 · `--space-6` 24 · `--space-8`
32 · `--space-12` 48. (Tailwind's numeric `gap-2`/`p-3`… already resolve to these px values.)

## Radius scale — Edition II (crisp, near-square)
`--radius-xs` 2 · `--radius-sm` 3 · `--radius-md` 4 · `--radius-lg` 5 · `--radius-xl` 6 ·
`--radius-pill` 999. Tailwind: `rounded-sm/DEFAULT/md` + `rounded-card` (xl/6) `rounded-field`
(md/4) `rounded-pill`. (Edition II calmed every corner toward print stock — was 3/4/6/12/18.)

## Motion — Edition II (curated curve)
New `--ease` `cubic-bezier(.22,1,.36,1)` is the house curve. Durations re-tuned calmer:
`--dur-fast` 220ms · `--dur-base` 280ms · `--dur-slow` 420ms (were 80/120/150). Legacy easings
`--ease-standard` / `--ease-out` / `--ease-in` retained. Tailwind: `duration-fast/base/slow`.

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

# Edition III · Sharing / safety — class & `data-*` map (P18)

Additive skin of existing Code classes. Keep every class name, markup, JS. Import
`khonsera-edition-iii-sharing.css` **last** (after the ledger layer).

| Area | Class root | `data-*` Design styles |
|---|---|---|
| ShareControl shell | `.cc-share` (+ `-head`) | — |
| Compose buttons | `.cc-share-tell button` | `button[data-tone="safe"]` (sage) |
| Employer guarantee | `.cc-share-employer` (+ `strong`, `.never`) | — |
| Live gift | `.cc-share-live` (+ `-live-eyebrow/-live-note/-live-form`, `.cc-share-dur button`, `.cc-share-go`) | duration `button[data-active="true\|false"]` |
| Broadcasting | `.cc-share-live[data-broadcasting="true"]` (+ `.cc-share-broadcast` `-status/.who/.until`, `.cc-share-sendlink`, `.cc-share-stop`) | `data-broadcasting="true"` |
| Active shares | `.cc-share-list` / `.cc-share-row` (+ `-row-who/-row-meta/.cc-share-link/.cc-share-revoke`) | — |
| Error | `.cc-share-error` (`<strong>`) | — |
| **Public page** | `.cc-shared` (+ `-mark/-eyebrow/-title em/-updated/-map/-view/-foot/-ended-note`) | `.cc-shared[data-ended="true"]` |

## Notes
- **The guarantee line** (`.cc-share-employer`) is the trust anchor — keep it visible near the top of
  ShareControl, never collapsed. Emphasis (`<strong>` + `.never`) carries the meaning; the rest is ink.
- **Off-switch discipline**: rust appears only on `.cc-share-stop`, `.cc-share-revoke:hover`, and
  `.cc-share-error`. Broadcasting itself is gold (active, not alarming).
- **The public page is chrome-free** — render `.cc-shared` as the whole document body on `/share/[token]`,
  no app shell. The `.cc-shared-map` is a placeholder ground; drop the real MapLibre view inside it
  (it already themes via the map tokens). `data-ended` swaps to the calm closure state.
- **Pulse** on the broadcasting status is the only motion, reduced-motion gated.

## Token requests
None. `color-mix()` used against existing `--success`/`--rust`/`--gold-100`; flat tokens if preferred.

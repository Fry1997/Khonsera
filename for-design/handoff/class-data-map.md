# Booked-document family + Wallet — class & `data-*` map

The exact DOM Code emits (`reference/document-cards.reference.tsx`). Style **by these hooks**; don't
rename. The base CSS in `reference/khonsera-edition-ii-shell.css` (the `BOOKED-DOCUMENT FAMILY` +
`.cc-wallet-*` blocks) is Code's functional floor — your elevation layer, imported last, overrides it.

## TicketCard — `.cc-ticket`
Root attrs: `data-kind="rail|air|stay|ground"` · `data-variant="compact|full"` · `data-source="…"`.

| Class | Element | Notes |
|---|---|---|
| `.cc-ticket-head` | header row | operator + reference |
| `.cc-ticket-operator` / `.cc-ticket-ref` | spans | operator(s) · 8-char ref |
| `.cc-ticket-pair` | row | shown only when 2 legs (return) |
| `.cc-ticket-chev` | buttons | ‹ › step outbound/return; `:disabled` at ends |
| `.cc-ticket-pair-label` | span | "Outbound" / "Return" |
| `.cc-ticket-journey` | wrapper | the shown leg |
| `.cc-ticket-endpoints` | grid | origin · `.cc-ticket-arrow` · destination |
| `.cc-ticket-endpoint` | `data-role="origin\|destination"` | right-aligns destination |
| `.cc-ticket-time` / `.cc-ticket-place` / `.cc-ticket-code` / `.cc-ticket-platform` | spans | time pair + CRS/IATA + platform/gate |
| `.cc-ticket-changes` > `.cc-ticket-change` | list | `data-tight` on a tight connection |
| `.cc-ticket-change-place / -transfer / -platform` | spans | the connection detail |
| `.cc-ticket-detail` > `.cc-ticket-detail-row` | dl/grid | seat · class · ticket · boarding · zone · baggage · restrictions |
| `.cc-ticket-detail-label / -value` | dt/dd | mono label + value |
| `.cc-ticket-address` | p | stay only |
| `.cc-ticket-consequence` | p | **the live band** — "this return → leave the museum by 16:10" |
| `.cc-ticket-actions` | footer | full variant only |
| `.cc-ticket-action` | button | "Show ticket" → opens ScanView (`.cc-btn.cc-btn-gold`) |
| `.cc-ticket-price` | span | mono money |

Stay variant: same root, `data-kind="stay"`, endpoints use `data-stay`, no barcode/actions.

## StatusStrip — `.cc-status-strip`
Attrs: `data-status="on_time|delayed|platform_change|gate_change|boarding|cancelled|stale"` ·
`data-offline`.

| Class | Notes |
|---|---|
| `.cc-status-dot` | the status colour dot |
| `.cc-status-label` | derived label (overridable) |
| `.cc-status-detail` | "+18 min" · "Platform 4 → 1" (mono) |
| `.cc-status-stale` | the offline "offline" marker |

Palette discipline: only `delayed`/`cancelled` warm the label; `gate/platform_change` warm the dot
only; `stale`/offline → faint. Never alarm-red across the whole card.

## BarcodePresenter — `.cc-barcode`
Attrs: `data-format="aztec|pdf417|qr"` · `data-size="inline|scan"`.

| Class | Notes |
|---|---|
| `.cc-barcode-quiet` | **the quiet zone — keep it; white; never encroach** |
| `.cc-barcode-code` | the matrix surface (Code injects real pixels here; placeholder hatch now). Size differs per format/size — see base CSS. **No overlay, max contrast.** |
| `.cc-barcode-pending` | placeholder label (gone at wire-up) |
| `.cc-barcode-passenger` | "Adult 1" |

## ScanView — `.cc-scanview` · FUNCTION OVER FINISH
Attrs: `data-format`. White ground, brightness maxed, big centred code.

| Class | Notes |
|---|---|
| `.cc-scanview-bar` | top chrome: summary + close |
| `.cc-scanview-summary` | one-line journey for the guard |
| `.cc-scanview-close` | × |
| `.cc-scanview-pager` | shown for multiple passengers |
| `.cc-scanview-step` | ‹ › (`:disabled` at ends) |
| `.cc-scanview-dots` > `.cc-scanview-dot` | `data-active` on current |

## Wallet — `.cc-wallet`
| Class | Notes |
|---|---|
| `.cc-wallet-group` > `.cc-wallet-group-head` | "Today" / "Tomorrow" / dated header (mono caps) |
| `.cc-wallet-list` | stack of compact `.cc-ticket[data-variant="compact"]` |
| `.cc-wallet-empty` / `-lead` / `-sub` | the calm empty invitation |

## New hooks you introduce
List any wrappers/spans you add (Round-3 style). Base classes render without them; add the thin ones
you need and Code wires them.

## Token requests
List any value you need that isn't in `reference/design-tokens.md`; Code adds it to globals +
manifest before you rely on it. (Code added none building the floor.)

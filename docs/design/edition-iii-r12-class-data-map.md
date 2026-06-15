# Edition III · Connections — class & `data-*` map (P14 · ED-Flight · ED-Stay · Manage)

**Supersedes the Round-9 map.** Additive skin of existing Code classes; keep every class name, markup,
JS. Import `khonsera-edition-iii-connections.css` **last** (it replaces the R9 file).

| Area | Class root | `data-*` Design styles |
|---|---|---|
| Shell | `.cc-conn` (+ `-head/-title/-sample/-close`) | — |
| Trip type | `.cc-conn-triptype` / `.cc-conn-tab` | `[data-active="true\|false"]` (string) |
| Search form | `.cc-conn-form` / `-field` / `-lbl` (`--airport`, `--num`, `.cc-conn-near`) | — |
| Autocomplete | `.cc-conn-suggest` / `-suggest-item` / `-suggest-iata` / `-suggest-name` (`.city`) | `-item[data-type="city\|airport"]`, `[data-active]` |
| List controls | `.cc-conn-list-head` / `.cc-conn-controls` / `.cc-conn-control` | — |
| Offer | `.cc-conn-offer` (+ `-main/-title/-op/-summary/-right/-price/.per/-total/-action`) | `.stops[data-direct="true"]`; `-action[data-variant="quiet"]` |
| Depth chips | `.cc-conn-offer-chips` / `.cc-conn-chip` | `[data-tone="good\|dim"]` |
| Seat picker | `.cc-conn-seats` (+ `-lead`, `.cc-conn-seatgrid` `.aisle`, `-seats-legend`) | `.cc-conn-seat[data-state="free\|paid\|taken\|selected"]` |
| Passenger | `.cc-conn-pax` (+ `-lead/-note/-grid/.span-2/-actions`, `.cc-conn-confirm/.price/-back/-secure`) | — |
| Confirmed | `.cc-conn-confirmed` (+ `-mark/-title/-detail/.ref/-tail`), `.cc-conn-checkin` | — |
| Error / pending / empty | `.cc-conn-error` / `.cc-conn-pending`(`.sample`) / `.cc-conn-empty`(`.hint`) | — |
| Stay result | `.cc-stay-card` (a `.cc-conn-offer`; `.rating`/`.board` in summary, `.per`/`-total`) | — |
| Stay property | `.cc-stay-detail` (+ `-gallery .shot`, `-detail-meta` `.name/.rating/.score/.n/.addr`, `-amenities`) | — |
| Stay rates | `.cc-stay-rate` (+ `-name/-chips/-right/-price/.per/-book`), `.cc-stay-limit` | — |
| Manage | `.cc-manage` (+ `-head/-row/-kind/-label/-ref/-action`) | — |
| Manage refund | `.cc-manage-refund` (+ `-line/.amt/-actions`), `.cc-manage-cancel`/`-keep` | — |
| Manage outcome | `.cc-manage-done` / `.cc-manage-error` (`<strong>`) | — |

## Notes
- **`data-active` is a string** ("true"/"false") on tabs/suggest — not a boolean attr toggle.
- **Direct = sage** is the one place the fare list earns colour; wrap stops in `.stops` + `data-direct`.
- **Depth chips** carry the edge — set `data-tone="good"` on generous baggage / Refundable / Changeable
  (sage), `data-tone="dim"` on carbon and weak-baggage; leave fare-brand neutral.
- **Seat states** drive the four looks; honest "assigned at check-in" copy replaces the grid when a
  carrier returns no map (no style needed — just render the note in `.cc-conn-seats-lead .note`).
- **Severity** matches Edition III: rust only on `.cc-conn-error` + `.cc-manage-cancel` (the commit) +
  `.cc-manage-error`; pending is gold; confirmed/free/refundable are sage.

## Token requests
None. `color-mix()` used against existing `--success`; flat `--success-line` if you prefer.

## Replaces
This pack's CSS + maps **supersede `for-code-r9`** (the toggle-based Connections). Drop the old
`khonsera-edition-iii-connections.css` and import this one in its place — same filename, same import slot.

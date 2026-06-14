# Edition III · Connections / booking — class & `data-*` map (P14)

Additive skin of the existing `ConnectionsFinder` classes. Keep every class name, markup, JS. Import
`khonsera-edition-iii-connections.css` **last** (after the round-8 care layer).

| Area | Class root | `data-*` Design styles |
|---|---|---|
| Shell | `.cc-conn` (+ `-head`) | — |
| Tabs | `.cc-conn-tabs` / `.cc-conn-tab` | `.cc-conn-tab[data-active="true\|false"]` |
| Honesty cue | `.cc-conn-sample` | — (present while provider mocked) |
| Close | `.cc-conn-close` | — |
| Search form | `.cc-conn-form` / `-field` / `-lbl` / `-near` (`.cc-conn-field--iata`) | — |
| Compare list | `.cc-conn-list` (+ `-list-head/-list-count/-list-sort`) | — |
| Offer row | `.cc-conn-offer` (+ `-main/-title/-op/-summary/-fare/-right/-price/-action`) | `.stops[data-direct="true"]` (sage); `.cc-conn-offer-action[data-variant="quiet"]` |
| Passenger | `.cc-conn-pax` (+ `-lead/-note/-grid/-actions/-confirm/-back/-secure`) | grid `.span-2` |
| Error | `.cc-conn-error` (rust, `<strong>`) | — |
| Pending | `.cc-conn-pending` (gold, `.sample`) | — |
| Confirmed | `.cc-conn-confirmed` (+ `-mark/-title/-detail/.ref/-tail`) | — |
| Empty | `.cc-conn-empty` (+ `.hint`) | — |

## Notes
- **Direct = sage** is the one place the fare list earns colour. Wrap the direct/stops token in
  `.stops` and set `data-direct="true"` on direct; stops/layovers stay neutral. If your component
  emits stops differently, tell me and I'll repoint.
- **Price is always mono + the dominant figure** in `-price`; the `/ night` suffix is `.per`. Keep
  the action button to one primary per row (`data-variant="quiet"` for a secondary/pricier pick).
- **Severity discipline** matches the rest of Edition III: rust only on `.cc-conn-error`; `pending`
  (not-live-yet) is gold, not rust; `confirmed` is sage. The reassurance sentence in an error stays
  ink — colour rides the dot + the `<strong>` cause only.
- **IATA fields** use `.cc-conn-field--iata` for the mono/uppercase/narrow treatment; the "Near"
  stay field uses `.cc-conn-near` to flex wide.

## Token requests
None. All values resolve against the Edition II manifest (gold/sage/rust ramps, `--sand` hover,
`--card`/`--card-2` surfaces).

# Edition III · Live spine — class & `data-*` map (P8–P10)

Additive skin of existing Code classes. Keep every class name, markup, JS. Import
`khonsera-edition-iii-live.css` **last**.

| Phase | Component · file | Class root | `data-*` Design styles |
|---|---|---|---|
| P8 | TflLineStatus · tfl-line-status.tsx | `.cc-tfl` (+ `-head/-eyebrow/-line/-dot/-name/-status/-reason/-rest/-allgood`) | `.cc-tfl-line[data-state="good\|minor\|severe\|suspended\|info"]`; "· sample" eyebrow |
| P8 | TflLegPlan · tfl-leg-plan.tsx | `.cc-tflleg` (+ `-eyebrow/-route/-step/-sep/-arrivals/-arr`) | route + arrivals; "· sample" |
| P9 | TfL disruption + consequence | `.cc-tflleg[data-disrupted]` + `.cc-tflleg-alert[data-state]` (+ `-status/-conseq`), `.cc-tflleg-reroute` | `data-disrupted="minor\|severe\|suspended"`, alert `data-state` |
| P9 | Decision-clock · /plan/[id] | `.cc-decision-clock` (`.label/.figure/.for`) | — |
| P9 | Rail live-alert | `.cc-live-alert[data-state]` (+ `-title/-conseq`, `.actby`) | `data-state="minor\|severe"` |
| P10 | Fragility line · /plan/[id] | `.cc-fragility` (`strong`, action `a`/`button`) | — |
| P10 | Day ripple · /plan/[id] | `.cc-day-ripple` (`.text/.mins`, `strong`) | — |
| P10 | Today disruption · today-disruption.tsx | `.cc-today-disruption[data-severe]` (+ `-eyebrow/-title/-item/-actions`), page `.cc-screen[data-disrupted]` | `data-severe`; item `.when/.what` |

## Notes
- **`.cc-screen[data-disrupted]` recede rule** — the skin fades siblings of the banner to 0.62,
  *excluding* `.cc-today-disruption`, `.cc-appbar`, `.cc-tabbar`. If your app shell uses different
  chrome class names, tell me and I'll widen the exclusion list so nav never dims.
- **Tone mapping confirmation** — per the handoff: rail/leg alerts use `minor`=gold / `severe`=rust;
  the today banner uses `late`=gold / `severe`=rust; TfL dots add `good`=sage and `info`=neutral. All
  resolve to the one ramp; no new tokens.
- **Consequence stays ink** — if Code emits the consequence inside a coloured wrapper, the skin still
  forces it to ink (`.cc-*-conseq`); keep the colour on the small status chip only.

## Token requests
None. `color-mix()` is used once (the day-ripple border) against existing `--rust`; if you'd rather a
flat token, add `--rust-line` and I'll point to it.

# Edition III · Deviation & care — class & `data-*` map (P11–P13)

Additive skin of existing Code classes. Keep every class name, markup, JS. Import
`khonsera-edition-iii-care.css` **last** (after the round-7 live layer).

| Phase | Component · file | Class root | `data-*` Design styles |
|---|---|---|---|
| P11 | RecoveryCard · plan/recovery-card.tsx | `.cc-recovery` (+ `-head/-eyebrow/-sample/-note/-list/-opt/-label/-conseq`) | `.cc-recovery-opt[data-makes="true\|false"]` |
| P11 | Return-pairing line | `.cc-recovery-return` (inside `-opt`, `<strong>`) | `.cc-recovery-opt[data-return="at-risk"]` |
| P11 | Detour route note | `.cc-recovery-via` (inside `-opt`) | — (present only with OTP live) |
| P12 | PlanNudges wrapper · plan/plan-nudges.tsx | `.cc-nudges` | — |
| P12 | NudgeCard open (foresight) · concierge | `.cc-nudge` / `.NudgeCard` (+ `-foresight/-msg/-actions/-sample`) | `.cc-nudge[data-urgency="now"]` flips to reaction (filled mark, 2px edge); button `[data-busy]`/`[disabled]` |
| P12 | NudgeCard accepted · plan/plan-nudges.tsx | `.cc-nudge-done` (+ `-mark/-text/-tail`) | `data-rule="weather\|fasttrack\|lounge\|parking\|gate\|…"` (copy only; no per-rule style needed) |

## Notes
- **Foresight vs reaction is driven by `data-urgency`.** Default (absent / not `now`) = foresight: hollow
  "Looking ahead" mark, gold-tint, 1px edge. `data-urgency="now"` (gate-change) = reaction: filled "Now"
  mark, 2px gold left-edge. If your `NudgeCard` exposes urgency under a different attr name, tell me and
  I'll repoint the selector.
- **The `-foresight` mark label is copy** ("Looking ahead" / "Now") emitted by the component; the skin
  styles the dot + colour. If Code would rather the skin inject the label, say so and I'll move it to a
  `::before` keyed on `data-urgency`.
- **`.cc-nudge-msg .where`** — wrap place names in `.where` (or `<strong>`) for the medium weight; purely
  optional, the message reads fine without it.
- **Severity stays in the chip/edge, never the sentence** — if Code emits a consequence inside a coloured
  wrapper, the skin forces it to ink. Keep colour on the eyebrow/edge/label only.

## Token requests
None. `color-mix()` is used twice (recovery sage-makes border, nudge gold border) against existing
`--success`/`--gold`; if you'd prefer flat tokens, add `--success-line` / `--gold-line` and I'll point
to them.

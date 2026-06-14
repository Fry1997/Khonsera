# Edition III — class & `data-*` map (P0–P6)

Additive skin of existing Code classes. Keep every class name, markup, JS. Import
`khonsera-edition-iii.css` **last**.

| Phase | Component · file | Class root | `data-*` Design styles |
|---|---|---|---|
| P0 | PlanMap · plan-map.tsx | `.cc-plan-map` | (theme already wired) |
| P0 | Home base node · plan-spine.tsx | `.cc-base-node` (+ `-eyebrow/-title/-time`) | start vs end (presence of trailing leg / `by HH:MM`) |
| P1 | ModeTag · mode-tag.tsx | `.cc-mode-tag` | `[data-mode="work\|personal"]` |
| P1 | PlanModeFlip · plan-mode-flip.tsx | `.cc-mode-flip` | active seg (`[data-active]`/`[aria-selected]`), `[data-pending]` |
| P2 | PlanCalendarImport · plan-calendar-import.tsx | `.cc-pick-row` (in `.cc-sheet`) | `[data-checked]`; `.cc-pick-empty`/`-loading` |
| P2 | Stay fields · plan-add.tsx | `.cc-stay-expand` / `.cc-stay-detail` | `[aria-expanded]` |
| ED1 | AccommodationCard · accommodation-card.tsx | `.cc-acc-card` (+ `-head/-eyebrow/-name/-board/-channel/-body/-row/-label/-value/-mono/-link`) | `.cc-acc-row[data-kind="cancellation\|price"]`; rows render only when present |
| P3 | NotesPanel · notes-panel.tsx | `.cc-notes` (+ `-toggle/-title/-count/-body`, `.cc-note`, `-head/-body/-form/-input`) | `[data-open]`; `.cc-note-kind[data-kind="prep\|outcome"]`; `.cc-note-shared` |
| P4 | ReadinessPanel · readiness-panel.tsx | `.cc-readiness` (+ `-head/-title/-cat/-item/-dot/-text/-label/-detail/-actions`) | `[data-clear]`; `.cc-readiness-item[data-sev="info\|advise\|warn"]` |
| P5 | DayReviewCard · day-review.tsx | `.cc-review` (+ `-eyebrow/-title/-leaveby/-list/-row/-flag/-foot/-verdict`) | `[data-clear]`; `.cc-review-flag` shown when fragile |
| P6 | Leg buffer badge · timeline-cards.tsx LegCard | `.cc-leg-buffer` in `.cc-leg-head-right` | `[data-buffer="ok\|tight\|late"]` |

## Notes
- **ReadinessPanel scoping** — the Round 1 ActiveTile carried a `.cc-readiness` *readiness prompt*;
  this P4 panel is the same class root used as a standalone panel. The skin scopes panel-only rules to
  `.cc-readiness[data-panel]` / `.cc-readiness-panel` so the two don't collide. Add `data-panel` (or the
  `-panel` class) on the P4 instance, or tell me the distinguishing hook and I'll re-scope.
- **`.cc-leg-pattern` hardcoded "Direct"** — noted as a deferred Phase 6 inference item; the skin styles
  whatever string is emitted, so nothing to do design-side until the real Direct/Drop-and-go/Hub-to-hub
  classification lands.

## Token requests
None. Everything resolved against the Edition II manifest (`design-tokens.md`). No new tokens, no
hardcodes.

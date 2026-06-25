---
name: khonsera-design
description: Use this skill to generate well-branded interfaces and assets for KHONSERA, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping. KHONSERA is a personal travel-day assistant with a tactile "heavy cotton paper / travel artefact" material language — cards feel like real ticket stock, boarding passes and wayfinding plates, never generic SaaS panels.
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets
out and create static HTML files for the user to view. Link `styles.css` for the full
token + material system; the paper tooth (`--fibre`) is baked in, so no runtime
generator is needed. If working on production code, you can copy assets and read the
rules here to become an expert in designing with this brand.

Key things to honour:
- **Material first.** Every card is a sheet of heavy cotton stock that lifts off the
  desk (`.pg` + `--lift`), or the same stock in charcoal (`.pg-d`). Read-outs and
  credentials SINK into pressed wells (`--sink`). Never flat SaaS rectangles.
- **Gold is punctuation only** — the brand dot and the odd status accent, never a fill.
- **Numbers outrank copy.** Platform/gate/seat/time/reference render in mono, the most
  important one as a charcoal `WayfindBadge`.
- **Voice:** calm, capable, present-tense, second-person. State the next thing, reassure
  when safe, firm up when action is needed. No emoji, no exclamation marks.
- **Type:** Satoshi + JetBrains Mono, sans + mono only, no serif. **Icons:** Lucide at
  1.75 stroke via the `Icon` component, no emoji.

The reusable React components are exposed on `window.DesignSystem_486fd8` once
`_ds_bundle.js` is loaded (Button, IconButton, Field, Icon, PaperCard, Well, Chip,
WayfindBadge, StatePill, StubField, Perforation). The full active-day app lives in
`ui_kits/planner/`.

If the user invokes this skill without any other guidance, ask them what they want to
build or design, ask some questions, and act as an expert designer who outputs HTML
artifacts _or_ production code, depending on the need.

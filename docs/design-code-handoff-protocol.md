# Khonsera — Design ↔ Code Handoff Protocol

**Purpose.** Claude Code (builds the app) and Claude Design (designs the UI) don’t share memory and don’t talk to each other yet. A human (Connor) relays between them. This document is the **shared contract both sides operate against**, so the relay carries *deltas against a known spec* rather than re-explaining the app every time. Give this file to **both** tools, and re-ground each session on the two source-of-truth artifacts below.

-----

## 0. The two artifacts that must be re-grounded every session

Because neither tool remembers, paste/link these at the **start of every Code session and every Design session**. They are the lingua franca; everything else is a delta against them.

1. **Design tokens** — the `theme` object (the single source of truth for all visual values). Already exists.
1. **Component contract** — Section 3 below (the shared inventory of components/screens, by name).

**Iron rule:** nothing references raw values. Both tools speak **token names**, never `#hex` or `16px`. The relay carries *decisions*, not pixels — which is what keeps the build and the design convergent. If Design needs a value that has no token, that’s a **token request** back to Code to add it to the `theme` object (Section 5), never a one-off hardcode.

-----

## 1. Source of truth: design tokens

The `theme` object in the codebase is canonical. Do **not** re-invent it in Design; extract from it. Known token set (confirm exact names/values against the live `theme`):

|Category                     |Tokens (names to standardise in `theme`)                                               |
|-----------------------------|---------------------------------------------------------------------------------------|
|Color — brand                |terracotta, warm-cream / “dusk” (background), walnut-ink (text), khonsera-gold (accent)|
|Color — semantic             |success, warning, disruption/alert, info (map onto the brand palette)                  |
|Typography — brand/editorial |Playfair Display, Lora                                                                 |
|Typography — UI/display      |Satoshi                                                                                |
|Typography — technical labels|JetBrains Mono                                                                         |
|Type scale                   |display, h1–h3, body, label, mono-label (define sizes/weights/line-heights as tokens)  |
|Spacing                      |a single spacing scale (e.g. spacing-xs … spacing-xl)                                  |
|Radius / borders             |radius scale; border widths                                                            |
|Elevation                    |shadow/elevation levels                                                                |
|Motion                       |durations + easings (calm by default — see §3 active tile)                             |

**Workflow for tokens:** Code holds the `theme`. Design references token names only. New token → Design flags it → Code adds it to `theme` → both re-ground. Tokens never fork.

-----

## 2. Brand book

Connor’s brand book is the visual seed for Design and the extraction source for any tokens not yet codified. Feed it to Design alongside the `theme`. Anything in the brand book that isn’t yet a token should be **promoted into the `theme`** so it becomes shareable (don’t leave brand decisions stranded in a PDF).

-----

## 3. Component & screen contract (the shared inventory)

Both tools refer to these by the **same names**. This is the spine: Code requests against it, Design produces against it, and it’s where new components get registered. Each entry lists the states that matter — **states are where handoffs fail**, so they’re called out. (Full per-component specs are produced during the round-trip using the templates in §4.)

### Screens / surfaces

|Surface                                            |Key states / notes                                                                                                                               |
|---------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
|**Welcome / first-run**                            |Concierge intro; two-path fork (“need something now” / “find me later”). Brand voice = Khonsera.                                                 |
|**Journey list / home**                            |Empty (Khonsera present, unobtrusive); has-journeys (next imminent surfaced largest); incomplete-journey card vs complete.                       |
|**Timeline** (core surface)                        |The display+input surface. Anchors/legs solid; gaps ghosted/“needs input”; inline question cards at the gap.                                     |
|**Today / Live view**                              |The active tile morphing through **calm → imminent → live → disruption**, across the size set (per the existing four-states × three-sizes brief).|
|**Comparison view**                                |Transport options with trade-offs (see component below).                                                                                         |
|**Mode switch surface**                            |Global Work ⇄ Personal toggle; Work mode may show workspace context.                                                                             |
|**Settings**                                       |Notification-channel preference (+ verified phone), home address, morning routine (for readiness).                                               |
|**Contacts / Tasks / Expenses**                    |List + add/edit; receipt thumbnail; per-journey expense total.                                                                                   |
|**Workspace / admin** (later, build foundation now)|Roles (admin/manager/traveller); approvals; allowance/per-diem; **Work-mode-only visibility** (never Personal).                                  |

### Components

|Component                      |Variants / states                                                                                                                                                                           |
|-------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|**Active tile**                |States: calm, imminent, live, disruption. Sizes per brief. Live data (platform/gate/countdown/status).                                                                                      |
|**Anchor card**                |Types: appointment, reservation, check-in, check-out, transport-arrival, flight. States: confirmed, has-constraint.                                                                         |
|**Intention card**             |States: active, toggled-off. Shows back-calculated leave-by nudge; affordance to **promote to anchor**.                                                                                     |
|**Gap / question card**        |Inline on timeline. States: needs-input (ghosted), binary-reveal (“anywhere between A and B?”).                                                                                             |
|**Leg card**                   |Mode, departure/arrival, cost, changes. Booking status: synced / booked-in-app / manual / unbooked-stub.                                                                                    |
|**Comparison matrix**          |Scheduled = two bracketing options (flip); flexible/owned = single leave-by; taxi = single + cost; flight = arrival-time options. Show delta-vs-intention, changes, cost, gotchas (parking).|
|**Journey list card**          |Incomplete (visible gaps) vs complete.                                                                                                                                                      |
|**Mode switch**                |Work / Personal.                                                                                                                                                                            |
|**Contact chip**               |With “send update” affordance (running-late / heading-home).                                                                                                                                |
|**Task row**                   |Done state; date badge; surfaces on the due day.                                                                                                                                            |
|**Expense row**                |Amount/category/currency; receipt thumbnail; (workspace) allowance-deduction indicator.                                                                                                     |
|**Map / journey visualisation**|**Already built** (MapLibre + Protomaps; great-circle arcs for flights). Treat as existing; Design themes, doesn’t rebuild.                                                                 |
|**Notification / nudge**       |Dismissible; severity (calm vs urgent vs breach).                                                                                                                                           |
|**Readiness prompt**           |Single orchestrated “out by X → up by Y”.                                                                                                                                                   |

When Design introduces a **new** component, it gets registered here (via the relay) so Code knows it exists and both stay in sync.

-----

## 4. The two-way handoff formats

### 4a. Code → Design — “Spec Request”

What Claude Code produces for Connor to paste into Design. Code states what it needs *built*, with the real data and states, so Design isn’t guessing.

```markdown
## Spec Request: [Screen/Component name from §3]

### Purpose & user context
[What this is for, the moment in the journey it serves]

### Data it must display
[Real field names / shapes — e.g. anchor.title, leg.departure, intention.leaveBy]

### States to cover
[All of them — default, empty, loading, error, plus domain states from §3]

### Tokens to use
[Reference the theme; note any expected new tokens]

### Constraints
[Mobile-first; brand voice = Khonsera; calm motion; accessibility expectations]

### Return format
[Per the chosen medium — see §6 — plus the Handoff Spec in 4b]
```

### 4b. Design → Code — “Handoff Spec”

What Claude Design returns for Connor to paste into Code. (Format adapted from the standard design-handoff spec.)

```markdown
## Handoff Spec: [Screen/Component name]

### Overview
[What it does, user context]

### Layout
[Structure, responsive behavior]

### Design Tokens Used
| Token | Usage |
|-------|-------|
| khonsera-gold | [where] |
| spacing-md | [where] |

### Components
| Component | Variant | Data/props | Notes |
|-----------|---------|------------|-------|

### States & Interactions
| Element | State | Behavior |
|---------|-------|----------|

### Responsive
| Breakpoint | Changes |
|------------|---------|
| Mobile | [primary — design mobile-first] |
| Larger | [what changes] |

### Edge cases
- Empty / long text / loading / error / missing data

### Motion
| Element | Trigger | Animation | Duration | Easing |
|---------|---------|-----------|----------|--------|

### Accessibility
- Focus order / ARIA / keyboard / screen-reader

### New tokens or components introduced
[Anything to register back in §1 / §3]
```

-----

## 5. Handoff Definition of Done

A round-trip isn’t complete until:

- [ ] **Tokens only** — no raw hex/px anywhere; new values promoted to `theme`.
- [ ] **All states shown** — default, empty, loading, error + the domain states from §3.
- [ ] **Data fields named** — Design knows the real shapes, not lorem placeholders.
- [ ] **Responsive specified** — mobile-first; what changes at larger sizes.
- [ ] **Interactions + motion specified** — calm by default; durations/easings as tokens.
- [ ] **Accessibility noted** — focus order, ARIA, keyboard, screen-reader.
- [ ] **New tokens/components registered** back into §1/§3 so both sides stay synced.
- [ ] **The “why” captured** where a non-obvious choice was made (helps Code make good judgment calls).

-----

## 6. The medium decision (what physically crosses the gap)

Pick one (default = **Hybrid**):

- **Spec only** — Design returns the §4b spec; Code implements to its own architecture. Cleanest codebase; Code re-builds visuals (drift risk).
- **Code transfer** — Design returns React/HTML using the tokens; Code integrates + wires data. High fidelity, fast; Design’s code may not match Code’s conventions (compounding drift).
- **Hybrid (recommended for a solo build):** Design returns **code as a visual reference + the §4b spec**; Code owns the **production implementation** against its own architecture, treating Design’s output as the visual contract. One coherent codebase; Design still drives the look. Use Design’s code literally only for self-contained pieces.

-----

## 7. The relay loop (Connor as courier)

1. **Code** emits a **Spec Request** (§4a) for the next screen/component in build order.
1. **Connor** pastes it into **Design** — alongside the `theme` + the relevant §3 entry (re-grounding).
1. **Design** produces the design and returns it in the chosen medium (§6) + a **Handoff Spec** (§4b).
1. **Connor** pastes that back into **Code** — which implements it.
1. **Code** flags any new tokens/components; Connor updates §1/§3 so the contract stays current. Repeat.

**Sequence by build order**, not by screen prettiness — follow the dependency spine in the Technical Handover (foundation → timeline → capture → decisions → day-of → nav → orchestration → people/expenses → teams). Design the surfaces in roughly that order so Design effort tracks what Code can actually wire next.

-----

## 8. Practical relay tips

- **Keep this file + the `theme` + §3 in the repo.** Code sees them automatically; start each Design session by pasting them in.
- **Re-paste the contract every session.** The tools don’t remember — treat re-grounding as step zero, every time.
- **Route every shared-value change through the contract.** A token or shared-component change is never a local edit; it updates §1/§3 so both sides converge.
- **Version it.** Note the date/version at the top when the contract changes, so you can tell Design “you’re on v3” and know what’s current.
- **Design mobile-first** (the app is a phone-first concierge); specify larger breakpoints as deltas.
- **One screen/component per round-trip** keeps the relay clean and the deltas small.

-----

*Companion to the Technical Handover (the build spec) and the Feature List (living scope). This is the interface contract between Code and Design.*
# Codex implementation brief: Instrument foundations and Today pilot

Status: ready for implementation

Branch: `agent/instrument-overhaul-handoff`

Dependency: this branch is based on takeover PR #28 (`agent/takeover-consolidation`). Rebase onto the repository default branch after #28 merges.

## Objective

Move Khonsera from the inherited cotton/letterpress design era to the new **Instrument** era, while improving the page hierarchy where the new visual direction exposes structural problems.

This is not a palette swap. The target is:

> A modern travel instrument that carries printed documents.

The app chrome is neutral, precise and operational. Warm paper appears only where the object is genuinely a ticket, pass, receipt or printable document.

The first implementation slice must establish the new visual foundations and prove them on the current Today experience. Structural changes are expected where required to achieve a decisive hierarchy, but product logic and data contracts should be preserved unless the brief explicitly says otherwise.

## Product principle

Khonsera should answer five questions throughout a travel day:

1. What do I need to do?
2. Where do I need to be?
3. When do I leave?
4. How do I get there?
5. What do I need with me?

Today must surface one authoritative next movement or recovery action, with context underneath rather than competing primary actions.

## First PR scope

### 1. Add the Instrument design foundation

Create an isolated style layer rather than editing every historical stylesheet in place.

Suggested structure:

```text
src/styles/instrument/
  tokens.css
  base.css
  typography.css
  primitives.css
  shell.css
  compatibility.css
```

Add a preview boundary such as `data-design="instrument"` at the app root or authenticated shell. The new design must be switchable without visually breaking unmigrated screens.

Do not paste the supplied design-pack CSS wholesale. Port the principles into the live app's component vocabulary and remove inherited/conflicting terminology as it is touched.

### 2. Canonical visual grammar

#### Colour

- application ground: `#F7F7F4`
- raised surface: `#FFFFFF`
- secondary surface: approximately `#F6F6F4`
- primary ink: `#15171C`
- secondary ink: `#2E333C`
- signal green: `#178A58`
- live dot only: `#00B57E`
- rail identity orange: `#D95327`
- warning amber: `#A9762A`
- disruption rust: `#B34A34`
- information slate: `#4D5A6B`

Accent rules:

- signal green = live, current, selected, leave-by and confirmed next action;
- rail orange = rail/operator identity, route seams and line chips only;
- charcoal = high-confidence action or instrument readout;
- amber/rust = real changed states only;
- avoid screens with green, orange and rust all competing for dominance.

#### Typography

- Satoshi for display, body and interface;
- JetBrains Mono only for precise transit data: times, platforms, station codes, references and seats;
- no serif or editorial italic in migrated screens;
- sentence case for normal labels and statuses;
- uppercase survives only for the KHONSERA wordmark and deliberate transit codes;
- use tabular numerals for time and platform data.

#### Shape and elevation

- sheet/hero radius: 20px;
- standard card/tile: 14px;
- chip/button: 10px;
- badge: 7px;
- cards use soft, single-direction layered elevation;
- recessed plates use a flat inset hairline, never pressed/debossed shadows;
- no grain, fibre texture, letterpress or engraved-number treatments;
- no decorative gradients except a restrained dark instrument block where needed.

#### Instrument versus document

- ordinary application surfaces remain neutral white/stone;
- warm or visually distinct stock means an actual document only;
- tickets and passes may use perforation geometry;
- barcode and scan views remain plain white, high contrast and unoverlaid.

#### Brand

Replace the pictorial moon image in migrated shell surfaces with:

- a small signal-green status dot;
- `KHONSERA` in Satoshi 300, uppercase, approximately `0.26em` tracking;
- monochrome ink wordmark;
- no split-colour lettering and no decorative emblem.

### 3. Build or migrate reusable primitives

Create typed React primitives or migrate existing `cc-*` components for:

- `BrandLockup`
- `Button`: ink primary, signal, ghost, destructive
- `Card`
- `CardHero`
- `CardInk`
- `Plate`
- `Document`
- `Status`
- `LineChip`
- `Field`
- `Sheet`
- `AppScreen`

Prefer component variants and classes over inline visual styles. Preserve accessibility, keyboard behaviour, focus states and existing functional props.

### 4. Migrate the authenticated shell in preview mode

Update the preview shell only:

- desktop rail;
- mobile app bar;
- mobile tab bar;
- page ground and content width;
- brand lockup;
- shared buttons, sheets and headers.

Do not change the current navigation information architecture in this PR. Today, Plan, Tasks, Wallet and Navigate must remain one tap away on mobile.

### 5. Today structural pilot

Use the current Today page and `LiveDay` component as the functional source of truth.

`LiveDay` already calculates the next commitment, leave-by timing, current route and Navigate action. Do not add a second generic `TodayActionSummary` above it.

The migrated Today page should:

- make the current next movement or recovery state the first dominant content;
- render leave-by time as crisp mono numerals, not embossed/engraved paper;
- keep weather and day purpose secondary;
- remove or demote duplicate `Wallet`, `Navigate` and `Open the plan` CTA rows surrounding `LiveDay`;
- preserve the route map, journey spine, inline passes and trip tools as supporting context;
- place required tickets at the point in the spine where they are used;
- use one visual accent family at a time;
- remain useful at 390px and 430px widths before desktop enhancement.

Do not rewrite the live timing or navigation engine merely to restyle it.

### 6. Add a staff-only disruption recovery fixture

Add a representative demo state based on this real scenario:

- traveller begins Harpenden to Wellingborough;
- first train reaches Luton;
- booked 17:42 Luton to Wellingborough/Corby leg is cancelled;
- a later viable 18:15 Corby service exists;
- the current journey app reports cancellation and refund information but does not solve the onward journey.

The fixture should demonstrate the structural slot for a future recovery engine:

1. state plainly what broke;
2. preserve the user's intention: get to Wellingborough;
3. recommend the best available onward option;
4. explain why it is best: departure, arrival, changes, wait and confidence;
5. provide one primary action such as `Use this route`;
6. keep `Other options`, ticket-validity uncertainty, notify/share and refund/compensation as secondary actions;
7. update the remaining Today spine after acceptance in demo state.

Do not fake live alternatives for real users. This PR is the UI/state architecture and staff fixture only unless an existing provider adapter can supply truthful data.

Core rule:

> Disruption is not a status. It is a new planning event.

## Explicitly out of scope for the first PR

- full production recovery-search engine;
- automatic ticket-validity decisions without an authoritative source;
- migration of every secondary screen;
- changing navigation labels or product information architecture;
- deleting every historical CSS file before consumers have migrated;
- broad database schema work;
- importing the design pack as a runtime dependency;
- fake live data outside staff/demo mode.

## Implementation constraints

- build from the current branch, preserving PR #28 changes;
- keep existing Supabase RLS and workspace scoping intact;
- no secrets or service credentials;
- use `lucide-react` line icons; no emoji;
- support `prefers-reduced-motion`;
- minimum interactive target 44px on mobile;
- no horizontal scrolling at 390px;
- avoid `as Route` casts where a typed route can be represented properly;
- preserve scan-code quiet zones and contrast;
- do not add another global stylesheet layer without an explicit retirement path.

## Acceptance criteria

### Visual

- Today at 390px reads in this order: next movement/recovery, consequence, supporting journey, documents/tools;
- migrated chrome contains no visible paper grain, letterpress or deboss treatment;
- ordinary cards are white/neutral; only real documents read as documents;
- Satoshi and mono roles are visually distinct and correctly applied;
- brand lockup uses the signal dot and wordmark, not the old pictorial mark;
- light and dark preview themes remain legible.

### Structural

- `LiveDay` remains the single authoritative active-movement surface;
- duplicate top-level Today CTA rows are removed or demoted;
- the disruption fixture recommends a next-best route rather than ending at `Cancelled`;
- acceptance of the fixture route visibly updates the remaining demo journey;
- unmigrated pages remain usable outside the preview boundary.

### Engineering

Run and pass:

```bash
npm run typecheck
npm test
npm run build
```

Add focused tests for any pure state selector introduced for disruption/recovery presentation.

### Review evidence

Attach screenshots to the PR for:

- Today normal state at 390px;
- Today disruption recovery at 390px;
- Today at 1440px;
- mobile shell/tab bar;
- dark/night instrument state if implemented in this slice.

## Reference files

- `docs/design/references/instrument-direction.jpg` — visual direction and representative screen hierarchy;
- `docs/design/references/disruption-recovery.jpg` — proposed disruption-to-recovery flow;
- the live app remains the source of truth for behaviour and data contracts.

The supplied visual references are directional, not pixel-perfect specifications. Correct typography, route data and app behaviour take precedence over any generated text or placeholder detail in an image.

## Recommended follow-on PRs

1. Plan and Wallet migration;
2. Navigate/map migration;
3. Tasks, People/Clients, Expenses and Mileage;
4. auth, welcome, settings and marketing;
5. activate Instrument by default and remove historical CSS/assets;
6. production disruption recovery engine and provider-confidence model.

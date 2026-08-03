# Today screen design audit

Date: 4 August 2026
Scope: shared live Today and isolated staff demo
Reference viewport: 390 CSS px mobile

## 1. What the production screenshot exposed

The page was not failing because one margin was wrong. It was failing because several visual systems were active at once.

The shared system, component layer, primary-flow layer, layout layer, two legacy Today files, two feedback files and a final corrective file all addressed overlapping selectors. The same element could therefore receive different values for grid columns, marker width, rail offset, padding, radius, colour and position. The visible symptoms were:

- the rail, marker centres and card edges followed different horizontal coordinates;
- some markers inherited large circular shells while others used the newer compact icon treatment;
- movement labels were positioned against the card accent rather than within the card content box;
- the transfer row collapsed into a thin strip because legacy and replacement grid definitions were both active;
- operational cards inherited warm document styling, reducing hierarchy between ordinary itinerary information and issued tickets;
- each corrective pass increased specificity and made the next pass less predictable;
- the mobile page became longer without gaining useful information density.

## 2. Architectural correction

Today now has one route-specific stylesheet: `src/app/khonsera-today.css`.

The following files remain in the repository for history but are no longer imported by the application layout:

- `khonsera-today-direction.css`
- `khonsera-screen-one.css`
- `khonsera-today-polish.css`
- `khonsera-today-feedback.css`
- `khonsera-today-spine-fix.css`

`TodaySpine` now uses a route-owned `kh-*` class contract. It no longer depends on the legacy `.cc-node`, `.cc-node-dot`, `.cc-walk` or `.cc-transfer` geometry. Live Today and the staff demo still call the same `TodaySpine`, `LiveDay`, `LivePass`, routing and ticket components.

## 3. Design rules

### Spacing

A six-step scale is used throughout the screen:

- 4 px: optical adjustment and tiny internal separation
- 8 px: related label/value spacing
- 12 px: ordinary component and row gap
- 16 px: card padding and page gutter
- 24 px: desktop section and column separation
- 32 px: major separation only

No component introduces an unrelated spacing value unless it is an optical line or icon correction.

### Colour responsibility

- Neutral cool ground: application chrome and page background
- White: operational cards and controls
- Warm paper: issued passes and tickets only
- Signal green: live, current, safe and confirmed state
- Burnt orange: rail, movement, direction and transfer identity
- Red: genuine late or unsafe state only

### Geometry

- Main cards: 16 / 16 / 16 / 5 px corner profile
- Compact cards and utilities: 12 / 12 / 12 / 4 px
- Controls: 10 / 10 / 10 / 4 px
- Status pills remain fully rounded where their semantics require a pill
- Spine markers use one compact angular container rather than a mixture of circles and rounded squares

### Typography

- Satoshi/display face: page titles, primary decision figure, destination codes and commitment names
- JetBrains Mono: times, codes, eyebrows and technical labels
- Ordinary sans: descriptions, guidance and action labels
- Uppercase mono labels are restricted to short technical categories; they are not used for body copy

## 4. Component-by-component review

### App bar

- Height reduced to a deliberate 62 px plus safe area
- Brand lockup remains quiet and compact
- Add and overflow controls remain 44 px touch targets
- Border and blur are retained without a heavy floating shadow

### Today header

- One 16 px mobile page gutter
- Three-pixel directional seam aligns with the title block
- Title and weather card share a bottom baseline
- Weather is a fixed 112 px utility, not a competing dashboard tile
- Location detail is hidden on narrow mobile and restored at tablet width

### Demo banner

- Demo status remains unmistakable without dominating the page
- The orange status tag is content-width rather than stretching across the row
- Settings remains a clear secondary action
- Explanation and build stamp occupy their own rows
- Warm tint is permitted because this is an exceptional system boundary, not an operational card

### Scenario clock

- Reduced to a 56 px utility strip
- Label and explanation remain on the left
- Current scenario time is the only dominant value
- The strip no longer competes visually with the next-move card

### Next move

- This remains the strongest surface on Today
- Left directional seam is retained
- Status and priority sit on one 24 px row
- The decision figure is large but no longer forces excessive card height
- Facts use 29 px chips with consistent icon/label spacing
- Primary route action is full width
- Share, reroute and ticket actions are equal-width labelled controls beneath it
- No duplicate Wallet or Navigate action is introduced elsewhere in the card

### Itinerary heading

- The heading is a 46 px transition between command and detail
- Title and timed-point count share a baseline
- One subtle divider establishes the start of the spine

### Spine

- Marker column: 29 px mobile
- Rail x-position: 14 px, exactly through marker centre
- Card gap from marker column: 10 px
- Node gap: 12 px
- Current-time marker is a compact 12 px signal rather than a full empty node
- All marker SVGs share one size, stroke treatment and container geometry

### Movement card

- Mode and duration sit fully inside the card
- Accent line has 12 px-plus clearance from all text
- Departure and arrival times share a single rule
- Destination and spare-time state share a wrap-safe footer row
- Active movement gains a green border signal but never inverts into a dark block
- Late state uses red only when the calculated buffer is negative

### Station arrival

- Arrival is a real commitment card, not an unlabelled gap
- Arrival time, station name and dwell are visible
- Dwell is calculated from the anchor arrival and end times
- The demo therefore exposes the full eight minutes at Wellingborough before departure

### Transfer

- The connection is a full card rather than a thin floating row
- Place and connection duration occupy the first row
- Arrival and departure occupy a dedicated tinted timing band
- Labels, values and accent line have independent padding
- Nothing is positioned over the card border

### Rail pass

- The compact Today face is explicitly requested from `LivePass`
- Warm paper differentiates an issued document from ordinary itinerary cards
- Header, status, route, boarding callout, stub, consequence and ticket action use one internal padding rhythm
- Codes remain prominent without forcing the card wider
- Consequence copy is non-italic and high contrast

### Appointment

- Green accent marks the final commitment rather than movement
- Title and place remain visually primary
- Start and end times use equal cells after a single divider
- Card padding and marker alignment match every prior node

### Bottom navigation

- Five equal-width controls
- Active Today item uses green with an orange orientation tick
- Active item does not become wider than its siblings
- Safe-area padding is built into the navigation wrapper
- Main content already reserves sufficient bottom space

## 5. Responsive behaviour

### Under 375 px

- Page gutter reduces from 16 to 14 px
- Weather utility reduces from 112 to 104 px
- Spine column reduces from 29 to 27 px
- Marker reduces from 28 to 26 px
- Destination codes reduce slightly

### 760 px and above

- Page gutter increases to 24 px
- Weather detail returns
- Marker and rail dimensions increase by two pixels
- Card padding increases without changing component hierarchy

### 1100 px and above

- Primary Today flow remains 744 px
- Context column is 300–336 px
- Context becomes sticky
- Demo controls, next move and itinerary retain a single vertical primary narrative

## 6. Acceptance criteria

At 390 px:

- every operational card begins on the same x-coordinate;
- the rail passes through every marker centre;
- no marker renders as a blank circle;
- no mode badge touches a border or accent line;
- transfer labels and times are fully contained;
- Wellingborough dwell is visible;
- only passes use warm paper;
- no element causes horizontal overflow;
- no adjacent cards collide;
- the final appointment clears the fixed navigation and safe area.

## 7. Guardrails

Regression coverage now fails when:

- a retired Today stylesheet is re-imported;
- the canonical Today stylesheet does not load after shared layout;
- `TodaySpine` returns to legacy node classes;
- the canonical rail/marker geometry is removed;
- operational and document surfaces lose their semantic separation.

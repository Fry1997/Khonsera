# Tell Khonsera — Smart capture (entity badges, live autosuggest, proximity, people)

The capture screen (`/capture`) turns free text into a live multi-fact draft. This doc covers the
"smart" layer added on top of the base capture flow: entity badges, ambiguity resolution, live
mid-sentence autosuggest, proximity ranking, and inline contact create.

## The core decision: no persisted bindings store
Entity state is **derived from the live `ParsedPayload`**, never stored separately:
- A place/person/station slot is **bound** (gold) when its `value` is an object carrying a resolved
  id — `hub_id` / `location_id` / `customer_site_id` / `contact_id`.
- It is **ambiguous** (grey) when `slot.ambiguous` is set (resolution found >1 candidate).
- It is **unknown** (grey) when it's a bare verbatim string with no match.

`slotEntityStatus(slot, dataType)` (in `draft-model.ts`) computes this; it returns `null` for
non-entity slots (dates, times, numbers, text).

When the user **picks** an autosuggestion, we rewrite the typed fragment to the entity's **canonical
name** in the textarea (`replaceRange`); the next debounced parse then resolves it to a bound slot
deterministically. This keeps the parser contract (plain text in) and avoids offset-remapping a
binding table. Card-slot edits still use the existing `corrections` model (user-authoritative,
high-confidence, never re-parsed).

## Inline badges — the annotated read-back mirror
The inline-badge surface is the **read-back line beneath the textarea** (`capture-screen.tsx`
`renderedText`), not a transparent-textarea overlay. It paints `buildOverlaySegments(text, spans)`
output — plain text + gold/grey entity spans — from each entity slot's `source_range`. Chosen over
a behind-textarea overlay for robustness: no pixel-alignment maths (which can't be verified without
a browser). The hovered card slot's span is highlighted here too.

Components: `entity-badge.tsx` (`EntityBadge` gold/grey, `CandidateDropdown`). The candidate chooser
lists `slot.candidates` sorted by `sortCandidatesByProximity` against the fact's anchor
(`factAnchor`), each row showing name · code · miles, plus a "Leave as typed" row.

## Live mid-sentence autosuggest
- `use-active-token.ts` — `activeTokenAt(text, caret)` finds the entity fragment under the caret and
  its **role** from the preceding operator (`from`/`to`→station, `at`/`in`/`near`→place,
  `meet`/`with`/`see`→person; airport when the clause mentions flying), mirroring `place.ts`
  `roleFromOperator` so UI + parser agree. `replaceRange` rewrites the fragment on pick.
- `suggest-popover.tsx` — debounced (250ms), proximity-seeded suggestions from
  `searchTransportHubs` / `searchPlaces` / `searchContacts`. Keyboard (↑↓/Enter) via a control ref
  the textarea drives; tap to pick; "Keep as typed" / Escape / blur dismiss.
- Wired in `capture-screen.tsx`: tracks the caret (`onSelect`/`onClick`/`onChange`), shows the
  popover under the field, rewrites text on pick, re-opens on the next keystroke.

## Proximity
`src/lib/geo.ts` is the single source: `haversineMeters`, `formatMiles` ("0.4 mi"/"12 mi"/"here"),
`rankByProximity`. Coordinates live on `transport_hubs`/`locations`/`customer_sites` and are carried
through onto resolved slot values by the parser (`ResolvedHub`/`ResolvedLocation` + `makeResolver`).
- `searchTransportHubs({query, kind, near?})` — `near` re-sorts matches by distance and attaches
  `distance_m`; empty-query + `near` does a ~0.7° bbox "nearest station" lookup.
- `searchPlaces({query, near?})` — workspace locations + customer_sites, proximity-aware.
- Cards show a "Find nearest station" affordance on unset/unknown hub slots when a nearby anchor
  exists (the draft's first bound entity with coords).

## Inline contact create
- Migration `0029_contacts_optional_customer.sql` made `contacts.customer_id` nullable so personal
  contacts (e.g. "meet Derek") need no customer.
- `createContactQuick({name, relation?, company?})` (`contact-search.ts`): `relation`→`role`,
  `company`→`notes` (no dedicated company column yet).
- `PersonEditor` (`slot-editor.tsx`): existing contacts first, then "+ New contact" → a compact
  inline form (name / relation / company) → on save binds the slot to the new contact (gold).

## Event-day linking
The parser's `link.ts` adds an `event_day` link: a dated fact within a multi-day `business_event`'s
`{start,end}` span links to it with a 1-based `day_index`, rendered as "Day N of <event>".

## Known gap
`materialise.ts` does not yet persist a bound person's `contact_id` to `stops.contact_id` on
confirm. The contact is created and bound in the capture UI, but the link isn't written through —
the next step when people are wired into the timeline.

## Tests (pure, no DOM)
`draft-model.test.ts` (slotEntityStatus, factAnchor, sortCandidatesByProximity, buildOverlaySegments),
`use-active-token.test.ts` (role/fragment detection, replaceRange), `geo.test.ts` (haversine, miles,
rankByProximity), `parser/__tests__/link.test.ts` (event_day). Visual polish for the popover +
read-back mirror needs a real device (no browser in CI/container).

# Landing page & waitlist (`/`)

The public front door. `/` is the brand marketing page, not the login wall; the authed app lives
behind login and enters at `/today`. Built per `landingwaitlistbrief.md`. Code-authored on Edition II
tokens — a flagged Design elevation candidate (screenshot it live and run it round the loop).

## Routing & visitor states

`src/app/page.tsx` (server component) decides between three states:

| Visitor | Branch | Result |
|---|---|---|
| Logged out | `getSessionUser()` is null | Marketing page + waitlist form + discreet "Log in" link |
| Logged in, **approved** | `isApproved(profile)` true | `redirect("/today")` |
| Logged in, **not approved** | else | Gated "thank you — place reserved" screen |

- **Public-route boundary** is enforced in `src/middleware.ts` — `PUBLIC_PATHS` = `/`, `/login`,
  `/signup`, `/forgot-password`, `/auth/callback`. Everything else redirects to `/login`. No app
  route is reachable while logged out.
- **App-route gate** is `src/app/(app)/layout.tsx`: `if (!isApproved(ctx)) redirect("/")`. A single
  chokepoint guarding every app route, so a non-approved account that lands on `/today` (e.g. login's
  default `next`) is bounced to `/` → the gated screen. No loop: approved at `/` → `/today`;
  non-approved at any app route → `/` (gated).

## The access gate — `src/lib/access.ts`

`isApproved(ctx) = ctx.isStaff || ctx.isAdmin`. While access is closed this is the honest signal
(signup auto-grants an owner membership, so `membership_role` can't distinguish approved from not).
**Widen this one predicate** when opening the doors — it's the only place the decision is made.

## Waitlist

- **Table** `waitlist` (migration `0033_waitlist.sql`): `id`, `email` (unique on `lower(email)`),
  `name?`, `source?`, `created_at`. RLS ON, **INSERT-only for anon+authenticated, no SELECT** — the
  list is private; duplicate detection rides the unique-index 23505 conflict, not a read.
- **Action** `src/lib/actions/waitlist.ts` → `joinWaitlist(formData)`:
  - honeypot `company` field (filled → silent success, no write);
  - validates email shape; lowercases; inserts; on 23505 → `{ status: "already" }`;
  - sets cookie `khonsera_waitlist=joined` (1 year) on join/already.
- **Form** `src/components/landing/waitlist-form.tsx` (client): single email + submit, morphs inline
  to the joined / already-on-list state (no reload). `initialJoined` is seeded server-side from the
  cookie so a return visit opens straight in the joined state.

## Link preview (metadata)

- `src/app/page.tsx` `export const metadata` — title, description, OpenGraph + Twitter.
- `src/app/opengraph-image.tsx` (`next/og`, 1200×630) — wordmark on linen + tagline. Token values are
  inlined as literals there because `next/og` renders in isolation and can't read CSS custom props.
  **Design deliverable:** elevate this card.

## Styling

Two layers, both additive (never `globals.css`):
- **Base** in `src/app/khonsera-edition-ii-shell.css` — the `.cc-mkt-*` / `.cc-wl-*` / `.cc-gated-*`
  structure Code authored.
- **Elevation** in `src/app/khonsera-edition-ii-landing.css` (**Round 3, Design**, imported **last**
  in `layout.tsx`) — the brand pass over those exact classes: the "slow blue hour" radial wash, 58px
  hero, gold-hairline section dividers, the bone-panel waitlist frame, the joined-morph motion, and
  the gated dead-end. No markup/class renames — purely token-driven restyle.

### Markup hooks the elevation expects (added in Round 3)
- Hero: `.cc-mkt-hero-eyebrow` (mono kicker) + `.cc-mkt-hero-meta` (scarcity line) — `src/app/page.tsx`.
- Waitlist: `.cc-mkt-waitlist-inner` (bone panel wrapper); `.cc-wl-note` (mono reassurance, idle/error-free).
- Joined block: `.cc-wl-joined-check` / `-h` / `-sub` — `src/components/landing/waitlist-form.tsx`.
- Gated: `.cc-gated-h` / `-sub` (Spectral `<em>`) / `-signout`.

### Joined-state morph
Driven by `data-*` the form toggles: on success the form sets `[data-leaving]` (sinks out ~200ms),
then after `SINK_MS` swaps to `.cc-wl-joined[data-enter]` (rises in ~360ms). The CSS gates both
animations behind `prefers-reduced-motion: no-preference` → reduced motion gets a straight cross-fade.

Copy is **Design's Round-3 final voice** (withholding, "by invitation · opening slowly"), adopted
from the for-code pack. Tunable by Connor.

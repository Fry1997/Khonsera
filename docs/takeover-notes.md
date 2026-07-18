# Takeover notes

## Baseline

Khonsera is a functioning product codebase, not a Phase 0 scaffold. The previous README and build-phase description were materially behind the implementation.

## Decisions from the first pass

- The product centre is the end-to-end travel day.
- `LiveDay` is the authoritative day-of next-move surface: it already calculates leave-by timing, live route state and the primary Navigate action.
- Today should support `LiveDay` with disruption, ticket and timeline context rather than adding a second competing next-action card.
- Plan remains the preparation and correction surface.
- Wallet, Navigate and day-linked Tasks are part of the core loop.
- People/clients, expenses, mileage and workspace administration are supporting capabilities.
- Shared `cc-*` primitives should replace page-specific empty-state and action markup.
- The cotton/letterpress design documents remain historical input, not an automatic instruction for new global styling. A representative-screen review is required before changing global tokens.

## Stale pull requests reconstructed

- PR #21 identified the right problem on Today but proposed an additional action card on an older page structure. Its useful principle is retained; its implementation is not copied.
- PR #24 introduced a useful actionable empty-state pattern. That pattern has been rebuilt on the current head while preserving newer onboarding and Wallet behaviour.

## Next engineering sequence

1. Remove the duplicate Wallet, Navigate and Open Plan button rows surrounding `LiveDay` on Today.
2. Make disruption and missing-document states clearly modify or precede the existing `LiveDay` action rather than competing with it.
3. Review Today, Plan, Wallet and Navigate together on a representative mobile viewport.
4. Add focused tests around leave-by, disruption priority and imported-plan edge cases.
5. Resolve or close PRs #21 and #24 after the replacement work is validated.

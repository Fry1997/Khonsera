# Khonsera product roadmap

Status: current takeover baseline, July 2026.

## North-star outcome

A user should be able to open Khonsera on a travel day and understand, without assembling information from other apps:

- what they are doing next;
- when they need to leave;
- how they are getting there;
- whether the journey has changed;
- which ticket, document or task they need;
- what comes after the current movement.

The product is successful when the user can operate the whole day from Today, while Plan remains the place where the day is prepared and corrected.

## Core loop

1. **Capture the day** from calendar, email or manual entry.
2. **Resolve the chain** of places, commitments, bookings and travel between them.
3. **Prepare the user** with leave-by times, gaps, missing documents and night-before review.
4. **Run the day** from one decisive Today surface.
5. **Close the loop** with expenses, mileage, completed tasks and reusable recurring patterns.

## Now: reliability and convergence

The immediate objective is not to add another large feature family. It is to make the existing end-to-end journey coherent and dependable.

### Product

- Give Today one authoritative next action for every meaningful state.
- Remove duplicated and competing calls to action across Today.
- Make empty states action-led and consistent.
- Clarify onboarding around three starts: manual plan, calendar import and booking-email import.
- Audit navigation so supporting tools do not compete with the core travel-day loop.

### Engineering

- Keep typecheck, unit tests and production build as pull-request gates.
- Add tests around Today state selection, leave-by derivation and imported-plan edge cases.
- Continue consolidating repeated sheet, page-shell and empty-state markup.
- Document live, partial and unavailable provider integrations accurately.
- Resolve or retire stale pull requests after their useful work has been reconstructed.

### Design

- Establish one current visual direction and mark older design eras as historical.
- Review the current cotton/letterpress documents against the newer bright, ultra-modern, restrained mid-century travel direction before changing global tokens.
- Do not perform a broad visual rewrite without representative mobile Today, Plan, Wallet and Navigate screens approved together.

## Next: complete the travel day

- Improve first-leg and between-stop leave-by confidence.
- Show the consequence of delays against later commitments, not just the raw delay.
- Make tickets appear at the exact point of use and remain available without signal.
- Strengthen multi-plan composition when work and personal events overlap.
- Complete calendar round-tripping rules and duplicate handling.
- Improve booking-email matching, provenance and correction flows.
- Add dependable partner/traveller status sharing for meaningful changes.

## Later: supporting depth

These capabilities are valuable only after the core day is reliable:

- expense export and reporting;
- richer mileage workflows;
- organisation administration and shared workspaces;
- rail, flight, stay and parking booking partnerships;
- packing lists and reusable trip templates;
- group travel and shared itineraries;
- destination and downtime recommendations.

## Deferred or experimental

The following should not drive the main navigation or roadmap until validated:

- a general-purpose CRM;
- a general-purpose task manager;
- broad lifestyle or pastime discovery;
- building a full booking marketplace before the day-of experience is trustworthy;
- features that do not improve planning, readiness, movement or recovery on a travel day.

## Decision test

Before adding or expanding a feature, answer:

1. Does this help the user plan the day, become ready, move, recover from a change or close out the trip?
2. Is Khonsera the natural place for it, or are we recreating another specialist app?
3. Can the benefit be surfaced through Today or Plan without another top-level destination?
4. What happens when the provider is unavailable or the user has no signal?
5. Which existing surface or concept can be simplified as a result?

A feature that cannot answer those questions should remain deferred.

# Khonsera — Design Export Pack

A self-contained pack for designing the two hero screens, **Timeline** and **Today**.
Everything renders the real component structure and the live theme — open any HTML
file in a browser (no build step, no server). Share the whole folder as-is.

## What's in here

| File | What it is |
|------|------------|
| `tokens.html` | The theme: every colour (name + value), the fonts and what each is for, the type scale, the spacing scale, corner radii, and the styling class vocabulary. |
| `components.html` | The named contract components on these screens — ActiveTile, AnchorCard, IntentionCard, GapCard, LegCard, ComparisonMatrix — each with a live example, what data it shows, and its states. |
| `timeline-full-day.html` | **Timeline** — a full, booked work day (Intention + Anchors + Legs). |
| `timeline-with-gaps.html` | **Timeline** — the same day with unresolved gaps (ghosted GapCards in place of missing Legs). |
| `timeline-new-day.html` | **Timeline** — a near-empty new day (one appointment, one open gap). |
| `today-calm.html` | **Today** — calm / comfortable (plenty of slack, sage status). |
| `today-imminent.html` | **Today** — imminent / urgent (leave-by close, amber status). |
| `today-live.html` | **Today** — live / in transit (mid-journey, no leave-by). |
| `today-disruption.html` | **Today** — disruption / breach (cancellation + pre-computed next-best, rust status). |
| `assets/khonsera.css` | The stylesheet: the real Dusk theme tokens + the real component classes. |

## How to read it

- **Structure, not pixels.** These are placeholders — structurally correct, token-styled. The job is
  to restyle them *by swapping the look, not the structure*, so the rebuilt components drop straight
  back into the app. Component names are contracts; please keep them.
- **Tokens only.** Every value traces to a `--token` (see `tokens.html`). New shared values are token
  requests, not one-off hex/px. Colour decisions follow the active palette automatically (Dusk shown;
  Sahara and Midnight redefine the same names).
- **No emojis, anywhere.** The concierge is voiced as "Khonsera" — never a human name.

## The two screens

- **Timeline** — the primary surface (display *and* input). Anchors render solid; a missing connection
  between two Anchors renders as a ghosted **Gap** ("needs input"). Intentions sit above the chain.
- **Today** — the day-of hero. One **ActiveTile** carries the moment; its urgency (comfortable → urgent
  → breach) is expressed purely through the status token, with the layout unchanged.

## Fonts

Loaded from CDNs (Satoshi via Fontshare; Inter, JetBrains Mono, Cormorant Garamond via Google Fonts),
so an internet connection makes them render exactly. Offline, the stacks fall back gracefully.

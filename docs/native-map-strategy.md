# Native map strategy — Mapbox on iOS (Swift) + Android (Kotlin)

Last updated: 2026-06-28 · Decision: DECISIONS.md **D104** · Stack note: `CLAUDE.md` (Maps).

This is the spec the **native** apps inherit. It is NOT built in this Next.js
web repo — it's a separate future workstream. The web app keeps MapLibre +
self-hosted Protomaps (see below for the platform split).

## Why Mapbox on native (and not on web)
- The app is going **true-native** (Swift iOS, Kotlin Android) + web desktop.
- **Offline** and **first-class turn-by-turn** are product pillars ("the day
  survives no-signal").
- Mapbox provides both as **native-SDK** features, and its **Standard style**
  gives realtime lighting / shadows / ambient occlusion — i.e. the "clay/cotton"
  3D look — natively, with a high free tier and a richer library than the
  current DIY stack (Protomaps + Valhalla + OTP + Google geocoding).
- Mapbox offline is **native-only**. On **web (GL JS)** there's no offline
  download API and caching tiles is against ToS — so web cannot use Mapbox for
  the offline promise. Web therefore **stays MapLibre + self-hosted Protomaps**
  (free, self-hostable, offline-capable via the `khnav://` IndexedDB cache).
- **Do not build the flagship map twice.** No deck.gl / Three.js / clay engine
  on web; the clay look is a native-Mapbox concern.

## What the native build does

### Style — the cotton/clay look
- Base: Mapbox **Standard** style.
- Theme it to the **cotton** palette (mirror `src/components/journey-map/themes/cotton.ts`):
  cotton land, no-blue tonal water, sand roads, cotton buildings, charcoal route
  + stops.
- Use the Standard **3D lighting** (`lightPreset` / dynamic light) so extruded
  buildings cast soft shadows + AO — the matte clay depth. A leant-back pitch
  for the posed/clay feel; flat for the wide overview.

### Offline — "survive no-signal"
- Mapbox **`OfflineManager` / `TileStore`**: download the day's **region**
  (style + tiles for the journey's bbox + zoom range) when the plan is opened on
  signal — mirrors today's web `khnav://` corridor cache intent.
- Download **offline routing tiles** so a *planned* journey can navigate with no
  connection.
- Respect per-platform offline caps (tile/region limits) — scope downloads to
  the journey corridor, not arbitrary areas.

### Navigation — the marketable, first-class layer
- Mapbox **Navigation SDK** (Swift + Kotlin): traffic-aware turn-by-turn, lane
  guidance, voice, live ETAs — the polished nav the open Valhalla/OTP stack
  can't match. This is a headline product differentiator.

### Data — reuse the existing model
- Journeys / stops / transitions / bookings come from the **same Supabase**
  schema the web app uses. Only **rendering + routing** move to Mapbox on native;
  the domain model, identity/RLS, capture and decision layers are shared.

## Before committing — verify
- Current Mapbox free-tier limits: web map loads, **Nav SDK MAU**, Directions
  request allowances; and the per-platform **offline** tile/region caps.
- Token/secret management for native builds; Mapbox account + billing posture at
  expected scale.
- Whether any web surface should also adopt Mapbox GL JS for visual consistency
  (online desktop only — offline never applies there). Default: leave web on
  MapLibre unless a consistency case is made.

## Web (this repo) — unchanged
- Day map = MapLibre cotton vector theme via `JourneyMap` (`PlanMap` →
  `themeName="cotton"`), real Protomaps basemap when `NEXT_PUBLIC_PMTILES_URL`
  is set. Calm, on-brand, online + offline-capable. No 3D/clay engine.
- The abstract `src/components/cotton-map/cotton-map.tsx` is **dormant** (kept,
  not wired).

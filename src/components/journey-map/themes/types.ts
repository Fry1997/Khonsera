// Theme interface for JourneyMap — every visual decision reads from here.
// Themes are plain JS objects; the component receives one as a prop.

export interface MapThemeColors {
  water: string;
  land: string;
  landEdge: string;
  rail: string;
  road: string;
  roadStroke: string;
  cityLabel: string;
  countryLabel: string;
  boundary: string;
  sky: string; // upper-sky colour revealed when the guidance camera tilts
  skyHorizon: string; // warm haze band where the sky meets the ground
  // Optional explicit values for slots brandVectorTheme() otherwise DERIVES
  // from the palette. Design (handoff 2026-06-27) pins these on `dusk`; unset
  // on a theme → the derived maths still applies (midnight/sahara untouched).
  park?: string; // greens / open land (warm muted sage)
  building?: string; // building fill (low contrast, just above land)
  highway?: string; // major roads — warm sand, NEVER gold (gold = route only)
}

export interface JourneyTheme {
  name: "dusk" | "midnight" | "sahara" | "cotton";
  colors: {
    paper: string;
    paperInner: string;
    ink: string;
    inkDim: string;
    gold: string;
    goldGlow: string;
    goldMuted: string;
    // Outbound route = gold; the return leg gets routeReturn so the two directions
    // read as distinct lines. routeCasing is the crisp outline drawn UNDER the route
    // so it stands clear of similarly-toned basemap roads.
    routeReturn: string;
    routeCasing: string;
    water: string;
    markerFill: string;
    // Two-tier markers (Design 2026-06-27): the ends (origin/destination) use
    // markerFill (gold); changeover/intermediate dots use markerFillMid (ink),
    // so only the ends carry gold. markerStroke is the paper halo ring.
    markerFillMid: string;
    markerStroke: string;
    // Label badge (station code / appointment / place) — styled independently of the
    // marker dots so it reads above basemap town names (Design D84: dark ground +
    // light text on all themes, not inverted).
    labelBadge: string;
    labelBadgeText: string;
    labelText: string;
    labelHalo: string;
  };
  fonts: {
    display: string;
    body: string;
    mono: string;
  };
  geom: {
    railWidth: number;
    railGlowWidth: number;
    casingWidth: number;
    walkWidth: number;
    walkDash: string;
    markerRadius: number;
    originRadius: number;
  };
  mapStyle: MapThemeColors;
}

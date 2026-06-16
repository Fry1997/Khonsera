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
}

export interface JourneyTheme {
  name: "dusk" | "midnight" | "sahara";
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

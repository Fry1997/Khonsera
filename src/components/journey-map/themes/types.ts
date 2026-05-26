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
    water: string;
    markerFill: string;
    markerStroke: string;
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
    walkWidth: number;
    walkDash: string;
    markerRadius: number;
    originRadius: number;
  };
  mapStyle: MapThemeColors;
}

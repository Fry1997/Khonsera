import type { JourneyTheme } from "./types";

// Cotton — the v8 material world applied to a REAL vector basemap (not the
// abstract SVG). Everything is the one cool cotton stock; at street zoom the
// real building footprints extrude and catch MapLibre's viewport light (the
// "clay" look Connor wants). Monochrome: the route is charcoal ink, charcoal is
// reserved for the route/stops/you. Water is a flat cooler press, never blue.
// Values lifted from the v8 cotton reference (ui_kits/app palette).
export const cotton: JourneyTheme = {
  name: "cotton",
  colors: {
    paper: "#e8e3d8",
    paperInner: "#efeae0",
    ink: "#20242b",
    inkDim: "#6a6e76",
    // The route/markers are monochrome charcoal on cotton (Connor: "pure
    // cotton"). NavMap reads `gold` for the route line, FOV cone and puck — so
    // the gold slot holds the route INK here; true brand-gold stays off the map.
    gold: "#2b2f36",
    goldGlow: "rgba(31,34,40,0.14)",
    goldMuted: "#4a4e56",
    routeReturn: "#2b2f36",
    // A soft light lip under the route → reads slightly raised on the cotton.
    routeCasing: "rgba(255,255,250,0.7)",
    water: "#dcdbd2",
    markerFill: "#1f2228",
    markerFillMid: "#1f2228",
    markerStroke: "#fbfaf6",
    labelBadge: "#1f2228",
    labelBadgeText: "#fbf8f1",
    labelText: "#4a4e56",
    labelHalo: "#f3efe6",
  },
  fonts: {
    display: "Satoshi Variable, Satoshi, sans-serif",
    body: "Inter Variable, Inter, sans-serif",
    mono: "JetBrains Mono, monospace",
  },
  geom: {
    railWidth: 3,
    railGlowWidth: 7,
    casingWidth: 6.5,
    walkWidth: 2,
    walkDash: "1 5",
    markerRadius: 5,
    originRadius: 7,
  },
  mapStyle: {
    water: "#dcdbd2",
    land: "#e8e3d8",
    landEdge: "#ddd8cb",
    rail: "#cabfa8",
    road: "#f2efe7",
    roadStroke: "#ddd6c6",
    cityLabel: "#4a4e56",
    countryLabel: "#6a6e76",
    boundary: "#c3bba9",
    sky: "#e8e3d8",
    skyHorizon: "#efeae0",
    // Explicit cotton tones for the derived slots (greens, buildings, highways).
    park: "#dfe0d2",
    building: "#ece7db",
    highway: "#ece6d8",
  },
};

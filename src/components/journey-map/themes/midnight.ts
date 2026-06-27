import type { JourneyTheme } from "./types";

export const midnight: JourneyTheme = {
  name: "midnight",
  colors: {
    paper: "#1f1825",
    paperInner: "#2a2030",
    ink: "#f4e8cf",
    inkDim: "#9a8e7a",
    gold: "#e2ab52",
    goldGlow: "rgba(212, 160, 77, 0.22)",
    goldMuted: "#b8893f",
    // Return leg = a bright cyan, clearly apart from gold on the dark ground.
    routeReturn: "#5cc2cf",
    // Near-black casing separates the route from the slightly-lighter dark roads.
    routeCasing: "rgba(0, 0, 0, 0.60)",
    water: "#1a2a28",
    markerFill: "#d4a04d",
    // Untuned (Design tuned dusk only) — a calm mid tone for changeover dots,
    // distinct from the gold ends and visible on the dark basemap.
    markerFillMid: "#9a8f7d",
    markerStroke: "#f4e8cf",
    labelBadge: "#0e0b14",
    labelBadgeText: "#f4e8cf",
    labelText: "#e0d4bc",
    labelHalo: "#2a2030",
  },
  fonts: {
    display: "Satoshi Variable, Satoshi, sans-serif",
    body: "Inter Variable, Inter, sans-serif",
    mono: "JetBrains Mono, monospace",
  },
  geom: {
    railWidth: 2.8,
    railGlowWidth: 9,
    casingWidth: 5.5,
    walkWidth: 1.6,
    walkDash: "2 5",
    markerRadius: 5,
    originRadius: 7,
  },
  mapStyle: {
    // After-dark is "aubergine-to-ink", not black — streets/water/rail stay visible
    // UNDER the route (Design lift, else the route floated in a void).
    water: "#1b2f2a",
    land: "#302640",
    landEdge: "#3a2e4c",
    rail: "#564a68",
    road: "#473a58",
    roadStroke: "#372b47",
    cityLabel: "#e8dcc6",
    countryLabel: "#9a8e7a",
    boundary: "#6a5e7e",
    sky: "#161126",
    skyHorizon: "#2a2138",
  },
};

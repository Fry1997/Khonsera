import type { JourneyTheme } from "./types";

export const dusk: JourneyTheme = {
  name: "dusk",
  colors: {
    paper: "#efe6d0",
    paperInner: "#f4f0e7",
    ink: "#1a1612",
    inkDim: "#6e6557",
    gold: "#9c6714",
    goldGlow: "rgba(160, 117, 32, 0.16)",
    goldMuted: "#b8893f",
    // Return leg = a cool teal that reads clearly apart from the warm gold + roads.
    routeReturn: "#1d6f73",
    // Dark casing lifts both route colours off the pale roads on this light theme.
    routeCasing: "rgba(20, 16, 10, 0.62)",
    water: "#b8c2a8",
    markerFill: "#a07520",
    markerStroke: "#1a1612",
    labelBadge: "#1a1612",
    labelBadgeText: "#fbf8f1",
    labelText: "#3a342c",
    labelHalo: "#fbf8f1",
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
    water: "#b8c2a8",
    land: "#efe9da",
    landEdge: "#e7e1d0",
    rail: "#d6cdb8",
    road: "#fffefb",
    roadStroke: "#dcd2bb",
    cityLabel: "#3a342c",
    countryLabel: "#6e6557",
    boundary: "#9c917f",
    sky: "#aebccf",
    skyHorizon: "#ecdfca",
  },
};

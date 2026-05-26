import type { JourneyTheme } from "./types";

export const dusk: JourneyTheme = {
  name: "dusk",
  colors: {
    paper: "#efe6d0",
    paperInner: "#f4f0e7",
    ink: "#1a1612",
    inkDim: "#6e6557",
    gold: "#a07520",
    goldGlow: "rgba(160, 117, 32, 0.18)",
    goldMuted: "#b8893f",
    water: "#b8c2a8",
    markerFill: "#a07520",
    markerStroke: "#1a1612",
    labelText: "#3a342c",
    labelHalo: "#fbf8f1",
  },
  fonts: {
    display: "Satoshi Variable, Satoshi, sans-serif",
    body: "Inter Variable, Inter, sans-serif",
    mono: "JetBrains Mono, monospace",
  },
  geom: {
    railWidth: 2.5,
    railGlowWidth: 9,
    walkWidth: 1.5,
    walkDash: "2 5",
    markerRadius: 5,
    originRadius: 7,
  },
  mapStyle: {
    water: "#b8c2a8",
    land: "#f4f0e7",
    landEdge: "#ede7d8",
    rail: "#d6cdb8",
    road: "#fbf8f1",
    roadStroke: "#e4ddcd",
    cityLabel: "#3a342c",
    countryLabel: "#6e6557",
    boundary: "#9c917f",
  },
};

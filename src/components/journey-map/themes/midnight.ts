import type { JourneyTheme } from "./types";

export const midnight: JourneyTheme = {
  name: "midnight",
  colors: {
    paper: "#1f1825",
    paperInner: "#2a2030",
    ink: "#f4e8cf",
    inkDim: "#9a8e7a",
    gold: "#d4a04d",
    goldGlow: "rgba(212, 160, 77, 0.22)",
    goldMuted: "#b8893f",
    water: "#1a2a28",
    markerFill: "#d4a04d",
    markerStroke: "#f4e8cf",
    labelText: "#e0d4bc",
    labelHalo: "#2a2030",
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
    water: "#1a2a28",
    land: "#2a2030",
    landEdge: "#352b3e",
    rail: "#4a3f55",
    road: "#332940",
    roadStroke: "#3e3448",
    cityLabel: "#e0d4bc",
    countryLabel: "#9a8e7a",
    boundary: "#5a4f65",
  },
};

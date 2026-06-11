import type { JourneyTheme } from "./types";

export const sahara: JourneyTheme = {
  name: "sahara",
  colors: {
    paper: "#f3e8c8",
    paperInner: "#f7f0db",
    ink: "#20180e",
    inkDim: "#7a6c52",
    gold: "#a87826",
    goldGlow: "rgba(168, 120, 38, 0.20)",
    goldMuted: "#c49432",
    water: "#c2ccb0",
    markerFill: "#a87826",
    markerStroke: "#20180e",
    labelText: "#3a2e1c",
    labelHalo: "#f7f0db",
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
    water: "#c2ccb0",
    land: "#f1ead0",
    landEdge: "#ede4c8",
    rail: "#ddd4b8",
    road: "#fffdf4",
    roadStroke: "#ddd2b2",
    cityLabel: "#3a2e1c",
    countryLabel: "#7a6c52",
    boundary: "#a49878",
  },
};

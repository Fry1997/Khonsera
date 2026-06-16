import type { JourneyTheme } from "./types";

export const sahara: JourneyTheme = {
  name: "sahara",
  colors: {
    paper: "#f3e8c8",
    paperInner: "#f7f0db",
    ink: "#20180e",
    inkDim: "#7a6c52",
    gold: "#9a6815",
    goldGlow: "rgba(168, 120, 38, 0.20)",
    goldMuted: "#c49432",
    // Return leg = a deep teal apart from the warm gold + ochre roads.
    routeReturn: "#1b6566",
    // Dark casing lifts the route off the pale daylight roads.
    routeCasing: "rgba(32, 24, 14, 0.55)",
    water: "#c2ccb0",
    markerFill: "#a87826",
    markerStroke: "#20180e",
    labelBadge: "#20180e",
    labelBadgeText: "#f7f0db",
    labelText: "#3a2e1c",
    labelHalo: "#f7f0db",
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
    water: "#c2ccb0",
    land: "#f1ead0",
    landEdge: "#ede4c8",
    rail: "#ddd4b8",
    road: "#fffdf6",
    roadStroke: "#e2d6b4",
    cityLabel: "#3a2e1c",
    countryLabel: "#7a6c52",
    boundary: "#a49878",
  },
};

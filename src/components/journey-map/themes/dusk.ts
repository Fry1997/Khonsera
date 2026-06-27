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
    // Casing lifts both route colours off the pale roads on this light theme —
    // lighter than before so the line reads editorial, not heavy (Design).
    routeCasing: "rgba(20, 16, 10, 0.46)",
    water: "#c4cfd4",
    // Ends are gold; changeover dots are ink; the ring is the paper halo.
    markerFill: "#9c6714",
    markerFillMid: "#1a1612",
    markerStroke: "#fbf8f1",
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
    railWidth: 2.2,
    railGlowWidth: 6,
    casingWidth: 4,
    walkWidth: 1.6,
    walkDash: "1 4",
    markerRadius: 4.5,
    originRadius: 6.5,
  },
  mapStyle: {
    water: "#c4cfd4",
    land: "#efe9da",
    landEdge: "#e8e2d1",
    rail: "#cdc2ab",
    road: "#fdfcf8",
    roadStroke: "#e1d9c7",
    cityLabel: "#33302a",
    countryLabel: "#6e6557",
    boundary: "#b4a995",
    sky: "#aebccf",
    skyHorizon: "#ecdfca",
    // Explicit derived-slot values (Design): greens warm muted sage, buildings
    // low-contrast, highways warm sand (never gold).
    park: "#dde2cd",
    building: "#e7e0ce",
    highway: "#efe4cf",
  },
};

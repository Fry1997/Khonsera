/**
 * Build a MapLibre style JSON object from a JourneyTheme.
 *
 * Uses OpenStreetMap raster tiles with a desaturated, warm-tinted
 * treatment to match the Khonsera aesthetic. The basemap exists to
 * orient — the journey SVG overlay is the hero.
 *
 * Upgrade path: switch to Protomaps or MapTiler vector tiles for
 * full brand control (custom colours, hidden POIs, etc.). Requires
 * an API key — see §4 of the JourneyMap handover doc.
 */
import type { JourneyTheme } from "../themes/types";

export function buildMapStyle(
  theme: JourneyTheme,
  // Optional tile URL override — the nav map routes tiles through a custom
  // MapLibre protocol (IndexedDB-first for saved routes); default is OSM.
  tileUrls?: string[],
): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: tileUrls ?? [
          "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxzoom: 18,
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: {
          "background-color": theme.mapStyle.land,
        },
      },
      {
        id: "osm-tiles",
        type: "raster",
        source: "osm",
        paint: {
          "raster-saturation": theme.name === "midnight" ? -0.8 : -0.6,
          "raster-brightness-min": theme.name === "midnight" ? 0.0 : 0.15,
          "raster-brightness-max": theme.name === "midnight" ? 0.3 : 0.92,
          "raster-contrast": theme.name === "midnight" ? 0.1 : -0.15,
          "raster-opacity": 0.85,
        },
      },
    ],
  } as maplibregl.StyleSpecification;
}

/**
 * Build a MapLibre style JSON object from a JourneyTheme.
 *
 * Uses Protomaps basemap tiles via the pmtiles protocol. The style
 * kills ~90% of default OSM layers and recolours the rest to match
 * the Khonsera brand: warm cream paper, sage water, ink labels,
 * faint rail lines, and very little else.
 *
 * The basemap exists to orient — the journey overlay is the hero.
 */
import type { JourneyTheme } from "../themes/types";

const TILE_URL = "pmtiles://https://build.protomaps.com/20250101.pmtiles";

export function buildMapStyle(theme: JourneyTheme): maplibregl.StyleSpecification {
  const ms = theme.mapStyle;
  const c = theme.colors;

  return {
    version: 8,
    glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sources: {
      protomaps: {
        type: "vector",
        url: TILE_URL,
        attribution: '<a href="https://protomaps.com">Protomaps</a> <a href="https://openstreetmap.org">OpenStreetMap</a>',
      },
    },
    layers: [
      // Background — warm paper
      {
        id: "background",
        type: "background",
        paint: {
          "background-color": ms.land,
        },
      },

      // Earth / landmass — single tone
      {
        id: "earth",
        type: "fill",
        source: "protomaps",
        "source-layer": "earth",
        paint: {
          "fill-color": ms.land,
        },
      },

      // Landcover — very faint sage/cream, no forest/farmland distinction
      {
        id: "landcover",
        type: "fill",
        source: "protomaps",
        "source-layer": "landcover",
        paint: {
          "fill-color": ms.landEdge,
          "fill-opacity": 0.3,
        },
      },

      // Landuse — faint parkland, kill everything else
      {
        id: "landuse-park",
        type: "fill",
        source: "protomaps",
        "source-layer": "landuse",
        filter: ["in", "pmap:kind", "park", "nature_reserve", "protected_area"],
        paint: {
          "fill-color": ms.water,
          "fill-opacity": 0.08,
        },
      },

      // Water — the one cool note in the palette
      {
        id: "water",
        type: "fill",
        source: "protomaps",
        "source-layer": "water",
        paint: {
          "fill-color": ms.water,
        },
      },

      // Country boundaries — hairline, faint ink
      {
        id: "boundary-country",
        type: "line",
        source: "protomaps",
        "source-layer": "boundaries",
        filter: ["==", "pmap:kind", "country"],
        paint: {
          "line-color": ms.boundary,
          "line-width": 0.7,
          "line-opacity": 0.5,
        },
      },

      // Rail lines — faint, the background network
      {
        id: "rail",
        type: "line",
        source: "protomaps",
        "source-layer": "transit",
        filter: ["==", "pmap:kind", "rail"],
        paint: {
          "line-color": ms.rail,
          "line-width": 0.6,
          "line-opacity": 0.5,
        },
      },

      // Major roads — very faint, only at city zoom
      {
        id: "roads-major",
        type: "line",
        source: "protomaps",
        "source-layer": "roads",
        filter: ["in", "pmap:kind", "highway", "major_road"],
        minzoom: 8,
        paint: {
          "line-color": ms.road,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8, 0.3,
            12, 1.2,
            16, 3,
          ],
          "line-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8, 0.15,
            12, 0.3,
            16, 0.5,
          ],
        },
      },

      // Road casings (strokes) — hairline at high zoom
      {
        id: "roads-major-casing",
        type: "line",
        source: "protomaps",
        "source-layer": "roads",
        filter: ["in", "pmap:kind", "highway"],
        minzoom: 10,
        paint: {
          "line-color": ms.roadStroke,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 0.5,
            14, 2,
          ],
          "line-gap-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 0.3,
            14, 1.5,
          ],
          "line-opacity": 0.2,
        },
      },

      // Minor roads — only at high zoom
      {
        id: "roads-minor",
        type: "line",
        source: "protomaps",
        "source-layer": "roads",
        filter: ["in", "pmap:kind", "minor_road", "medium_road"],
        minzoom: 12,
        paint: {
          "line-color": ms.road,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12, 0.2,
            16, 1.5,
          ],
          "line-opacity": 0.25,
        },
      },

      // Country labels — mono, positioned
      {
        id: "label-country",
        type: "symbol",
        source: "protomaps",
        "source-layer": "places",
        filter: ["==", "pmap:kind", "country"],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Medium"],
          "text-size": 11,
          "text-transform": "uppercase",
          "text-letter-spacing": 0.15,
          "text-max-width": 8,
        },
        paint: {
          "text-color": ms.countryLabel,
          "text-halo-color": c.labelHalo,
          "text-halo-width": 1.5,
          "text-opacity": 0.7,
        },
      },

      // City labels
      {
        id: "label-city",
        type: "symbol",
        source: "protomaps",
        "source-layer": "places",
        filter: ["in", "pmap:kind", "city", "town"],
        minzoom: 5,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Medium"],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5, 10,
            10, 13,
          ],
          "text-max-width": 8,
        },
        paint: {
          "text-color": ms.cityLabel,
          "text-halo-color": c.labelHalo,
          "text-halo-width": 1.5,
        },
      },

      // Water labels — very subtle
      {
        id: "label-water",
        type: "symbol",
        source: "protomaps",
        "source-layer": "water",
        filter: ["has", "name"],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Italic"],
          "text-size": 10,
          "text-letter-spacing": 0.1,
        },
        paint: {
          "text-color": ms.countryLabel,
          "text-halo-color": ms.water,
          "text-halo-width": 1,
          "text-opacity": 0.5,
        },
      },
    ],
  } as maplibregl.StyleSpecification;
}

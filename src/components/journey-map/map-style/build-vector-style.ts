import { layersWithCustomTheme } from "protomaps-themes-base";
import type { JourneyTheme } from "../themes/types";
import { brandVectorTheme, shade } from "./brand-vector-theme";
import { basemapProtocolUrl, VECTOR_MAXZOOM } from "../pmtiles-source";

// The premium basemap: Protomaps v4 vector tiles, branded to the Khonsera theme,
// with 3D buildings and (optional) terrain. Tiles flow through the cache-aware
// `khnav://` protocol so saved routes render offline. Everything open-source.

// Terrain is opt-in: set NEXT_PUBLIC_TERRAIN_URL to a terrarium DEM (e.g. the
// free AWS one: https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png).
// Off by default so a flaky DEM can't compromise the basemap.
function terrainUrl(): string | null {
  const v = process.env.NEXT_PUBLIC_TERRAIN_URL;
  return v && v.length > 0 && v !== "off" ? v : null;
}

export function buildVectorStyle(theme: JourneyTheme): maplibregl.StyleSpecification {
  const t = brandVectorTheme(theme);
  // Full Protomaps layer set (water/land/roads/buildings/boundaries/labels),
  // coloured by the brand theme, English labels.
  const layers = layersWithCustomTheme("protomaps", t, "en") as maplibregl.LayerSpecification[];

  // 3D buildings — extrude the footprints near the ground. Protomaps carries
  // `height`/`min_height` (metres) where OSM has them; a small default lifts the
  // rest so the city still has texture. Inserted beneath the labels.
  // Premium touch: the fill is HEIGHT-GRADUATED — low blocks sit recessive and
  // warm, towers tint lighter as if catching the sky — and MapLibre's vertical
  // gradient shades each face base→top, so the skyline has real depth instead of
  // a single flat grey. Tones derive from the land token (no raw hex).
  const land = theme.mapStyle.land;
  const dark = theme.name === "midnight";
  const extrusion: maplibregl.LayerSpecification = {
    id: "buildings-3d",
    type: "fill-extrusion",
    source: "protomaps",
    "source-layer": "buildings",
    minzoom: 15,
    filter: ["in", "kind", "building", "building_part"],
    paint: {
      "fill-extrusion-color": [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "height"], 6],
        0, shade(land, dark ? 6 : -20),
        14, t.buildings,
        45, shade(land, dark ? 28 : 12),
      ],
      "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 15, 0, 16, ["coalesce", ["get", "height"], 6]],
      "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
      "fill-extrusion-vertical-gradient": true,
      "fill-extrusion-opacity": 0.92,
    },
  };
  const firstSymbol = layers.findIndex((l) => l.type === "symbol");
  if (firstSymbol >= 0) layers.splice(firstSymbol, 0, extrusion);
  else layers.push(extrusion);

  const sources: Record<string, maplibregl.SourceSpecification> = {
    protomaps: {
      type: "vector",
      tiles: [basemapProtocolUrl()],
      maxzoom: VECTOR_MAXZOOM,
      attribution: '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
    },
  };

  const style: maplibregl.StyleSpecification = {
    version: 8,
    glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sprite: "https://protomaps.github.io/basemaps-assets/sprites/v4/light",
    sources,
    // Protomaps' layer list already starts with a `background` layer (themed via
    // brandVectorTheme.background) — don't add a second or MapLibre rejects the
    // whole style for a duplicate id.
    layers,
  };

  // Terrain / hillshade — subtle relief, free DEM. Degrades to flat offline (the
  // DEM isn't corridor-cached). Opt out with NEXT_PUBLIC_TERRAIN_URL=off.
  const dem = terrainUrl();
  if (dem) {
    sources.terrain = {
      type: "raster-dem",
      tiles: [dem],
      encoding: "terrarium",
      tileSize: 256,
      maxzoom: 13,
      attribution: "© AWS Terrain Tiles",
    } as maplibregl.SourceSpecification;
    style.layers.push({
      id: "hillshade",
      type: "hillshade",
      source: "terrain",
      paint: { "hillshade-exaggeration": 0.3, "hillshade-shadow-color": theme.colors.inkDim },
    } as maplibregl.LayerSpecification);
    style.terrain = { source: "terrain", exaggeration: 1.0 };
  }

  return style;
}

import { namedTheme, type Theme } from "protomaps-themes-base";
import type { JourneyTheme } from "../themes/types";

// Brand the Protomaps v4 vector basemap to a Khonsera JourneyTheme. We start
// from Protomaps' "light"/"dark" named theme (so every one of its ~80 colour
// slots has a sane value) and override the ones that carry the brand —
// background/land, water, roads, buildings, rail, boundaries, labels — with the
// same palette the raster overlay + JourneyMap already use. One source of
// colour truth; the map just renders it as vectors now.

// A touch lighter/darker than a base, for casings and tonal steps. Works on
// #rrggbb; passes through anything else (rgba()) unchanged.
function shade(hex: string, amt: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const f = (h: string) => Math.max(0, Math.min(255, Math.round(parseInt(h, 16) + amt)));
  const to = (n: number) => n.toString(16).padStart(2, "0");
  return `#${to(f(m[1]))}${to(f(m[2]))}${to(f(m[3]))}`;
}

export function brandVectorTheme(jt: JourneyTheme): Theme {
  const base = namedTheme(jt.name === "midnight" ? "dark" : "light");
  const c = jt.colors;
  const ms = jt.mapStyle;

  const land = ms.land;
  const landB = shade(ms.land, jt.name === "midnight" ? 10 : -8);
  const road = ms.road;
  const roadCasing = ms.roadStroke;
  const building = shade(ms.land, jt.name === "midnight" ? 18 : -14);
  const green = jt.name === "midnight" ? shade(ms.land, 14) : shade(ms.water, 6);

  return {
    ...base,
    background: c.paper,
    earth: land,
    // Greens / open land — keep them quiet, warm, on-palette.
    park_a: green,
    park_b: shade(green, -6),
    wood_a: green,
    wood_b: shade(green, -6),
    scrub_a: green,
    scrub_b: shade(green, -6),
    sand: shade(land, 6),
    beach: shade(land, 6),
    hospital: landB,
    industrial: landB,
    school: landB,
    zoo: landB,
    military: landB,
    aerodrome: landB,
    runway: roadCasing,
    pedestrian: shade(land, jt.name === "midnight" ? 6 : -4),
    glacier: c.paperInner,

    water: ms.water,
    waterway_label: c.inkDim,
    ocean_label: c.inkDim,

    buildings: building,

    // Roads — fill from the road colour, casings from the stroke. Highways read
    // a touch warmer (gold-muted) so the network has a gentle hierarchy.
    other: road,
    minor_service: road,
    minor_a: road,
    minor_b: shade(road, -4),
    link: road,
    major: shade(road, jt.name === "midnight" ? 8 : -4),
    highway: c.goldMuted,
    minor_service_casing: roadCasing,
    minor_casing: roadCasing,
    link_casing: roadCasing,
    major_casing_early: roadCasing,
    major_casing_late: roadCasing,
    highway_casing_early: shade(c.goldMuted, -30),
    highway_casing_late: shade(c.goldMuted, -30),
    railway: ms.rail,

    boundaries: ms.boundary,

    // Labels — ink for places, gold-muted nothing; halos are paper.
    city_label: ms.cityLabel,
    city_label_halo: c.labelHalo,
    state_label: ms.countryLabel,
    state_label_halo: c.labelHalo,
    country_label: ms.countryLabel,
    subplace_label: ms.cityLabel,
    subplace_label_halo: c.labelHalo,
    roads_label_minor: c.inkDim,
    roads_label_minor_halo: c.labelHalo,
    roads_label_major: ms.cityLabel,
    roads_label_major_halo: c.labelHalo,
    peak_label: c.inkDim,
    address_label: c.inkDim,
    address_label_halo: c.labelHalo,
  };
}

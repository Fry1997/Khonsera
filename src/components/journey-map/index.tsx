/**
 * Public export for the JourneyMap component.
 *
 * The component uses MapLibre GL (browser-only) so it must be
 * dynamically imported with `ssr: false` at the page level:
 *
 *   const JourneyMap = dynamic(
 *     () => import("@/components/journey-map").then((m) => m.JourneyMap),
 *     { ssr: false },
 *   );
 */

export { JourneyMap } from "./journey-map";
export type {
  Journey,
  Leg,
  Station,
  LatLng,
  LegMode,
  JourneyMapProps,
} from "./types";
export type { JourneyTheme } from "./themes/types";
export { dusk, midnight, sahara, THEMES } from "./themes";
export { decodePolyline } from "./utils/decode-polyline";

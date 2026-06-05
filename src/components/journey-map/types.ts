/**
 * Core data types for the JourneyMap component.
 *
 * These are the component's own domain types — they're constructed
 * from the DB data in the wiring layer (the planning view / data
 * composer), not imported from the DB schema.
 */

export type LatLng = [number, number]; // [lat, lng] — lat first internally

export type LegMode = "walk" | "rail" | "road" | "flight" | "transit" | "ferry";

export interface Station {
  code?: string;       // e.g. 'KGX', 'EDB', 'LHR'
  name: string;
  lat: number;
  lng: number;
}

export interface Leg {
  mode: LegMode;
  from: Station;
  to: Station;
  track: LatLng[];         // polyline in [lat, lng] order
  durationLabel: string;   // human-readable: '4h 13m', '11 min'
  durationMinutes?: number;
  service?: string;        // 'LNER / KX 218', 'BA 287', etc.
  waypoints?: Station[];   // intermediate stops worth labelling
}

export interface Journey {
  id: string;
  eyebrow: string;            // e.g. 'A TUESDAY / DOOR TO DOOR'
  totalDistanceMi: number;
  totalDurationLabel: string;
  legs: Leg[];
}

export interface JourneyMapProps {
  journey: Journey;
  themeName?: "dusk" | "midnight" | "sahara";
  mode: "planning" | "day-of";
  height?: number;
  width?: number;
}

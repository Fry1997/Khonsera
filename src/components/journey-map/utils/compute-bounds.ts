/**
 * Compute a MapLibre LngLatBounds-compatible bounding box from a Journey.
 *
 * Returns [[west, south], [east, north]] — the format MapLibre's
 * map.fitBounds() expects.
 */
import type { Journey } from "../types";

type LngLatBoundsLike = [[number, number], [number, number]];

export function computeBounds(journey: Journey): LngLatBoundsLike {
  let west = 180;
  let east = -180;
  let south = 90;
  let north = -90;

  const expand = (lat: number, lng: number) => {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  };

  for (const leg of journey.legs) {
    expand(leg.from.lat, leg.from.lng);
    expand(leg.to.lat, leg.to.lng);

    for (const [lat, lng] of leg.track) {
      expand(lat, lng);
    }

    if (leg.waypoints) {
      for (const wp of leg.waypoints) {
        expand(wp.lat, wp.lng);
      }
    }
  }

  // Guard: if no data, default to UK-ish bounds
  if (west > east || south > north) {
    return [[-6, 50], [2, 56]];
  }

  return [[west, south], [east, north]];
}

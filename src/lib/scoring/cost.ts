// Taxi-cost estimator. MVP stub: linear in distance with a small
// base fare. Swapped for a real Uber API call later as its own
// commit — see the scoring spec.
//
// Numbers picked to land in a UK Uber X ballpark for short city
// hops. Off in either direction for long fares or surge pricing;
// the real API will fix that.
const BASE_FARE_PENCE = 250; // £2.50 hop-on
const PER_MILE_PENCE = 250; // £2.50 / mile

export function estimateTaxiCostPence(
  distanceMeters: number | null,
): number | null {
  if (distanceMeters == null) return null;
  const miles = distanceMeters / 1609.344;
  return Math.round(BASE_FARE_PENCE + miles * PER_MILE_PENCE);
}

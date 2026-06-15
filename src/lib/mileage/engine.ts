// Mileage engine (Phase 15) — pure, unit-tested. The HMRC Approved Mileage
// Allowance Payment (AMAP) maths + GPS-track distance. No I/O — the action layer
// feeds it trips, this values them. Rates + the 10,000-mile threshold are FIXED
// statutory defaults (never learned): change them here when HMRC changes them.

export type Vehicle = "car" | "motorcycle" | "bicycle";

// HMRC AMAP rates in PENCE per mile (2026; unchanged for years). Cars/vans get a
// two-tier rate; the first 10,000 BUSINESS miles in a tax year are 45p, the rest 25p.
const RATE_PENCE = {
  car: { first: 45, firstThresholdMiles: 10_000, rest: 25 },
  motorcycle: { first: 24, firstThresholdMiles: Infinity, rest: 24 },
  bicycle: { first: 20, firstThresholdMiles: Infinity, rest: 20 },
} as const;

const METERS_PER_MILE = 1609.344;
export function metersToMiles(m: number): number {
  return m / METERS_PER_MILE;
}

// The claimable amount (pence) for `miles` of business travel, given how many
// business miles already fall earlier in the same tax year (so the 10k tier is
// applied across the year, not per trip). Pure + exact at the boundary.
export function hmrcAmountPence(miles: number, priorMiles: number, vehicle: Vehicle): number {
  if (miles <= 0) return 0;
  const r = RATE_PENCE[vehicle];
  const firstRemaining = Math.max(0, r.firstThresholdMiles - priorMiles);
  const atFirst = Math.min(miles, firstRemaining);
  const atRest = miles - atFirst;
  return Math.round(atFirst * r.first + atRest * r.rest);
}

// Distance (metres) along a recorded GPS track — the sum of leg hops. The map-
// matched (road-snapped) distance is a positioned enhancement; this is the honest
// straight-segment lower bound that's always available offline.
export function trackDistanceMeters(points: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversine(points[i - 1], points[i]);
  }
  return total;
}

const EARTH_M = 6_371_000;
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(s));
}

// The UK tax year an instant falls in (6 April → 5 April). Returns the start
// year, so 2026-05-01 → "2026/27" and 2026-03-01 → "2025/26".
export function taxYearOf(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // 0-based
  const day = d.getUTCDate();
  const startYear = m > 3 || (m === 3 && day >= 6) ? y : y - 1;
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export type TripForReport = { id: string; startedAt: string; distanceMeters: number; classification: "business" | "personal" | "unset"; vehicle: Vehicle };
export type TripValued = TripForReport & { miles: number; amountPence: number };
export type MileageReport = {
  taxYear: string;
  businessMiles: number;
  personalMiles: number;
  claimablePence: number;
  trips: TripValued[];
};

// Build the claim-ready report for ONE tax year. Business trips accumulate miles
// in chronological order so the 10k tier crosses correctly; personal trips are
// counted (for the record) but never valued. Vehicles tier independently.
export function buildReport(trips: TripForReport[], taxYear: string): MileageReport {
  const inYear = trips.filter((t) => taxYearOf(t.startedAt) === taxYear).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const priorByVehicle: Record<Vehicle, number> = { car: 0, motorcycle: 0, bicycle: 0 };
  let businessMiles = 0;
  let personalMiles = 0;
  let claimablePence = 0;
  const valued: TripValued[] = [];

  for (const t of inYear) {
    const miles = metersToMiles(t.distanceMeters);
    if (t.classification === "business") {
      const amountPence = hmrcAmountPence(miles, priorByVehicle[t.vehicle], t.vehicle);
      priorByVehicle[t.vehicle] += miles;
      businessMiles += miles;
      claimablePence += amountPence;
      valued.push({ ...t, miles, amountPence });
    } else {
      if (t.classification === "personal") personalMiles += miles;
      valued.push({ ...t, miles, amountPence: 0 });
    }
  }

  return {
    taxYear,
    businessMiles: round1(businessMiles),
    personalMiles: round1(personalMiles),
    claimablePence,
    trips: valued,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

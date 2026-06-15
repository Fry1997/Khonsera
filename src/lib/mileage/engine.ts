// Mileage engine (Phase 15) — pure, unit-tested. The HMRC Approved Mileage
// Allowance Payment (AMAP) maths + GPS-track distance. No I/O — the action layer
// feeds it trips, this values them. Rates + the 10,000-mile threshold are FIXED
// statutory defaults (never learned): change them here when HMRC changes them.

export type Vehicle = "car" | "motorcycle" | "bicycle";

// HMRC AMAP rates (pence/mile) are now YEAR-EFFECTIVE — the car/van rate rose to
// 55p on 6 Apr 2026 (the first change since 2011/12), so a hardcoded constant would
// silently misvalue claims. Keyed by UK tax year; cars tier at 10,000 business
// miles, motorcycle/bicycle are flat. The passenger rate (5p/mile per fellow
// employee on a shared business journey) is on top, tax/NIC-free, no relief floor.
type RateTable = {
  car: { first: number; thresholdMiles: number; rest: number };
  motorcycle: number;
  bicycle: number;
  passenger: number;
};
const RATES_BY_TAX_YEAR: Record<string, RateTable> = {
  "2026/27": { car: { first: 55, thresholdMiles: 10_000, rest: 25 }, motorcycle: 24, bicycle: 20, passenger: 5 },
  "2025/26": { car: { first: 45, thresholdMiles: 10_000, rest: 25 }, motorcycle: 24, bicycle: 20, passenger: 5 },
};
const LATEST_TAX_YEAR = "2026/27";
export function ratesForYear(taxYear: string): RateTable {
  return RATES_BY_TAX_YEAR[taxYear] ?? RATES_BY_TAX_YEAR[LATEST_TAX_YEAR];
}

const METERS_PER_MILE = 1609.344;
export function metersToMiles(m: number): number {
  return m / METERS_PER_MILE;
}

// The claimable amount (pence) for `miles` of business travel in `taxYear`, given
// how many business miles already fall earlier in the same tax year (so the 10k
// tier applies across the year, not per trip). Pure + exact at the boundary.
export function hmrcAmountPence(miles: number, priorMiles: number, vehicle: Vehicle, taxYear: string): number {
  if (miles <= 0) return 0;
  const r = ratesForYear(taxYear);
  if (vehicle === "motorcycle") return Math.round(miles * r.motorcycle);
  if (vehicle === "bicycle") return Math.round(miles * r.bicycle);
  const firstRemaining = Math.max(0, r.car.thresholdMiles - priorMiles);
  const atFirst = Math.min(miles, firstRemaining);
  const atRest = miles - atFirst;
  return Math.round(atFirst * r.car.first + atRest * r.car.rest);
}

// Passenger payments: 5p/mile per fellow employee carried on the business journey.
export function passengerAmountPence(miles: number, passengers: number, taxYear: string): number {
  if (miles <= 0 || passengers <= 0) return 0;
  return Math.round(miles * passengers * ratesForYear(taxYear).passenger);
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

export type TripForReport = {
  id: string;
  startedAt: string;
  distanceMeters: number;
  classification: "business" | "personal" | "unset";
  vehicle: Vehicle;
  passengers?: number;
  purpose?: string | null;
};
export type TripValued = TripForReport & { miles: number; amountPence: number; passengerPence: number; needsPurpose: boolean };
export type MileageReport = {
  taxYear: string;
  businessMiles: number;
  personalMiles: number;
  claimablePence: number; // mileage + passenger payments
  passengerPence: number; // the passenger-payment portion, for transparency
  needsPurposeCount: number; // business trips not yet claim-ready (HMRC needs a purpose)
  trips: TripValued[];
};

// Build the claim-ready report for ONE tax year. Business trips accumulate miles
// in chronological order so the 10k tier crosses correctly; personal trips are
// counted (for the record) but never valued. Vehicles tier independently. A
// business trip without a purpose is valued but flagged (HMRC needs the reason).
export function buildReport(trips: TripForReport[], taxYear: string): MileageReport {
  const inYear = trips.filter((t) => taxYearOf(t.startedAt) === taxYear).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const priorByVehicle: Record<Vehicle, number> = { car: 0, motorcycle: 0, bicycle: 0 };
  let businessMiles = 0;
  let personalMiles = 0;
  let claimablePence = 0;
  let passengerPence = 0;
  let needsPurposeCount = 0;
  const valued: TripValued[] = [];

  for (const t of inYear) {
    const miles = metersToMiles(t.distanceMeters);
    if (t.classification === "business") {
      const amountPence = hmrcAmountPence(miles, priorByVehicle[t.vehicle], t.vehicle, taxYear);
      const paxPence = passengerAmountPence(miles, t.passengers ?? 0, taxYear);
      const needsPurpose = !t.purpose?.trim();
      priorByVehicle[t.vehicle] += miles;
      businessMiles += miles;
      claimablePence += amountPence + paxPence;
      passengerPence += paxPence;
      if (needsPurpose) needsPurposeCount += 1;
      valued.push({ ...t, miles, amountPence, passengerPence: paxPence, needsPurpose });
    } else {
      if (t.classification === "personal") personalMiles += miles;
      valued.push({ ...t, miles, amountPence: 0, passengerPence: 0, needsPurpose: false });
    }
  }

  return {
    taxYear,
    businessMiles: round1(businessMiles),
    personalMiles: round1(personalMiles),
    claimablePence,
    passengerPence,
    needsPurposeCount,
    trips: valued,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

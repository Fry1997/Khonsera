// Parkopedia / Arrive adapter (Phase 13) — parking find + predicted occupancy +
// reserve, for the "car park likely full → pre-book" rule. Procurement-gated:
// MOCK until PARKOPEDIA_KEY is set. The mock predicts a plausible occupancy from
// the arrival time (busier mid-morning) so the rule has a real-shaped signal to
// reason over, and mints a reservation on confirm. Live find-data + occupancy and
// the reserve POST drop in behind these shapes when keyed.

export type ParkingOutlook = { site: string; predictedOccupancyPct: number; sample: boolean };

export type ParkingReservation = {
  reference: string;
  site: string;
  fromIso: string;
  toIso: string;
  qrPayload: string;
  provider: "parkopedia";
  sample: boolean;
};

function parkopediaKey(): string | null {
  return process.env.PARKOPEDIA_KEY ?? null;
}

// Predicted occupancy at arrival. Mock: a smooth daily curve peaking late-morning
// (the airport-parking rush) — deterministic so dev + tests are stable.
export async function parkingOutlook(args: { site: string; arriveIso: string }): Promise<ParkingOutlook> {
  if (parkopediaKey()) {
    // Real find + predicted-occupancy query slots in here.
    return { site: args.site, predictedOccupancyPct: 60, sample: false };
  }
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/London" }).format(new Date(args.arriveIso)),
  );
  // Peak ~10:00; ebb overnight. Maps roughly to 55–95%.
  const peakDistance = Math.min(Math.abs(hour - 10), 12);
  const pct = Math.round(95 - peakDistance * 3.3);
  return { site: args.site, predictedOccupancyPct: Math.max(45, Math.min(95, pct)), sample: true };
}

export async function reserveParking(args: { site: string; fromIso: string; toIso: string }): Promise<ParkingReservation> {
  const sample = !parkopediaKey();
  const ref = `PK-${shortHash(args.site + args.fromIso)}`;
  return {
    reference: ref,
    site: args.site,
    fromIso: args.fromIso,
    toIso: args.toIso,
    qrPayload: `PARKOPEDIA|${ref}`,
    provider: "parkopedia",
    sample,
  };
}

function shortHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 6).toUpperCase();
}

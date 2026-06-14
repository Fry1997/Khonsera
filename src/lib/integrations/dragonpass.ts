// DragonPass adapter (Phase 12) — fast-track security prebooking, the flagship
// "running late → expedite" connection. REVENUE provider, procurement-gated:
// MOCK until DRAGONPASS_KEY is set, then the real `/v2/orders/...prebooking`
// product drops in behind this same shape (capability map). The mock returns a
// realistic QR-voucher so the whole flow — propose → confirm → voucher in hand —
// works end to end today; the full ticketisation (rendering the QR on a Pass)
// is the P14 connections framework.

export type FastTrackSlot = { startIso: string; endIso: string };

export type FastTrackVoucher = {
  reference: string;
  airport: string;
  lane: string; // "Security — Fast Track, South Terminal"
  validFromIso: string;
  validToIso: string;
  qrPayload: string; // the lane-scannable token (on-device render later, P14)
  provider: "dragonpass";
  sample: boolean; // true while mocked — drives the "· sample" honesty cue
};

function dragonpassKey(): string | null {
  return process.env.DRAGONPASS_KEY ?? null;
}

// Is there a fast-track slot for this airport around this time? Mock answers yes
// for the supported MVP airport set; the real call queries availability.
export async function fastTrackAvailability(airport: string): Promise<{ available: boolean; sample: boolean }> {
  if (dragonpassKey()) {
    // Real availability query slots in here when keyed.
    return { available: true, sample: false };
  }
  return { available: true, sample: true };
}

// Book (or, mocked, mint) a fast-track voucher. Deterministic so dev + tests are
// stable. The real order POST replaces the mock branch behind the same return.
export async function bookFastTrack(args: { airport: string; flightDepartIso: string }): Promise<FastTrackVoucher> {
  const sample = !dragonpassKey();
  const depart = new Date(args.flightDepartIso).getTime();
  // Lane access opens ~2h before and closes ~30m before departure — a real window.
  const validFromIso = new Date(depart - 120 * 60_000).toISOString();
  const validToIso = new Date(depart - 30 * 60_000).toISOString();
  const ref = `FT-${slug(args.airport)}-${shortHash(args.airport + args.flightDepartIso)}`;
  return {
    reference: ref,
    airport: args.airport,
    lane: `Security — Fast Track`,
    validFromIso,
    validToIso,
    qrPayload: `DRAGONPASS|${ref}|${args.flightDepartIso}`,
    provider: "dragonpass",
    sample,
  };
}

function slug(s: string): string {
  const code = /\(([A-Z]{3})\)/.exec(s)?.[1];
  return code ?? s.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}
function shortHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 6).toUpperCase();
}

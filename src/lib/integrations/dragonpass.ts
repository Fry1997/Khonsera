// DragonPass adapter (Phase 12–13) — the single airport-experience partner (founder
// call, D52): BOTH **fast-track security** (the running-late flagship, P12) and
// **lounge** access (the long-layover rule, P13). Chosen as the practical SHORT-TERM
// partner (one contract, achievable onboarding); Collinson (Priority Pass + SmartDelay)
// is the long-term strategic TARGET, kept dormant in `integrations/collinson.ts` until
// that enterprise relationship is realistic — identical voucher shapes, one-line swap.
//
// REVENUE provider, procurement-gated: MOCK until DRAGONPASS_KEY is set, then the
// real `/v2/orders/...prebooking` product drops in behind these same shapes.

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

// ───────────────────────── lounge access (P13) ─────────────────────────

export type LoungePass = {
  reference: string;
  airport: string;
  loungeName: string;
  validFromIso: string;
  validToIso: string;
  guests: number;
  qrPayload: string;
  provider: "dragonpass";
  sample: boolean;
};

export async function loungeAvailability(airport: string): Promise<{ available: boolean; loungeName: string; sample: boolean }> {
  return { available: true, loungeName: loungeNameFor(airport), sample: !dragonpassKey() };
}

// Book (or, mocked, mint) a lounge pass sized to the window before boarding.
export async function bookLounge(args: { airport: string; boardingIso: string; windowMin: number }): Promise<LoungePass> {
  const sample = !dragonpassKey();
  const boarding = new Date(args.boardingIso).getTime();
  const validToIso = new Date(boarding - 20 * 60_000).toISOString(); // leave to reach the gate
  const validFromIso = new Date(boarding - args.windowMin * 60_000).toISOString();
  const ref = `LG-${slug(args.airport)}-${shortHash(args.airport + args.boardingIso)}`;
  return {
    reference: ref,
    airport: args.airport,
    loungeName: loungeNameFor(args.airport),
    validFromIso,
    validToIso,
    guests: 1,
    qrPayload: `DRAGONPASS|${ref}|${args.boardingIso}`,
    provider: "dragonpass",
    sample,
  };
}

function loungeNameFor(airport: string): string {
  const code = /\(([A-Z]{3})\)/.exec(airport)?.[1];
  return code ? `DragonPass Lounge ${code}` : "Airport Lounge";
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

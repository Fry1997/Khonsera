// Collinson (Priority Pass / LoungeKey) adapter (Phase 12–13) — the single
// airport-experience partner (founder call, D52): BOTH **fast-track security**
// (the running-late flagship, P12) and **lounge** access (the long-layover rule,
// P13). REVENUE provider, procurement-gated: MOCK until COLLINSON_KEY is set. The
// mock returns realistic vouchers so propose → confirm → pass-in-hand works end to
// end today; the real catalogue + booking drop in behind these shapes. (SmartDelay
// — lounge auto-triggered by a flight delay — is the P11/P13 follow-on noted in
// the capability map, and a key reason Collinson is the strategic partner.)
//
// Honest note: Collinson's fast-track footprint is narrower than a pure fast-track
// vendor's; `integrations/dragonpass.ts` stays in the tree (dormant) as the ready
// fallback/secondary fast-track adapter behind the identical voucher shape.

export type LoungePass = {
  reference: string;
  airport: string;
  loungeName: string;
  validFromIso: string;
  validToIso: string;
  guests: number;
  qrPayload: string;
  provider: "collinson";
  sample: boolean;
};

function collinsonKey(): string | null {
  return process.env.COLLINSON_KEY ?? null;
}

// ───────────────────────── fast-track security (P12 flagship) ─────────────────────────

export type FastTrackVoucher = {
  reference: string;
  airport: string;
  lane: string;
  validFromIso: string;
  validToIso: string;
  qrPayload: string;
  provider: "collinson";
  sample: boolean;
};

export async function fastTrackAvailability(airport: string): Promise<{ available: boolean; sample: boolean }> {
  void airport;
  if (collinsonKey()) return { available: true, sample: false };
  return { available: true, sample: true };
}

// Book (or, mocked, mint) a fast-track voucher. Deterministic so dev + tests are
// stable. The real order POST replaces the mock branch behind the same return.
export async function bookFastTrack(args: { airport: string; flightDepartIso: string }): Promise<FastTrackVoucher> {
  const sample = !collinsonKey();
  const depart = new Date(args.flightDepartIso).getTime();
  const validFromIso = new Date(depart - 120 * 60_000).toISOString();
  const validToIso = new Date(depart - 30 * 60_000).toISOString();
  const ref = `FT-${codeOf(args.airport)}-${shortHash(args.airport + args.flightDepartIso)}`;
  return {
    reference: ref,
    airport: args.airport,
    lane: "Security — Fast Track",
    validFromIso,
    validToIso,
    qrPayload: `COLLINSON|${ref}|${args.flightDepartIso}`,
    provider: "collinson",
    sample,
  };
}

export async function loungeAvailability(airport: string): Promise<{ available: boolean; loungeName: string; sample: boolean }> {
  const sample = !collinsonKey();
  // The real availability query slots in here when keyed.
  return { available: true, loungeName: loungeNameFor(airport), sample };
}

// Book (or, mocked, mint) a lounge pass sized to the window before boarding.
export async function bookLounge(args: { airport: string; boardingIso: string; windowMin: number }): Promise<LoungePass> {
  const sample = !collinsonKey();
  const boarding = new Date(args.boardingIso).getTime();
  // Access from now-ish until boarding; cap the booked window to the layover.
  const validToIso = new Date(boarding - 20 * 60_000).toISOString(); // leave to reach the gate
  const validFromIso = new Date(boarding - args.windowMin * 60_000).toISOString();
  const ref = `LG-${codeOf(args.airport)}-${shortHash(args.airport + args.boardingIso)}`;
  return {
    reference: ref,
    airport: args.airport,
    loungeName: loungeNameFor(args.airport),
    validFromIso,
    validToIso,
    guests: 1,
    qrPayload: `COLLINSON|${ref}|${args.boardingIso}`,
    provider: "collinson",
    sample,
  };
}

function loungeNameFor(airport: string): string {
  const code = codeOf(airport);
  return code ? `The Club ${code}` : "Airport Lounge";
}
function codeOf(s: string): string {
  return /\(([A-Z]{3})\)/.exec(s)?.[1] ?? s.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}
function shortHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 6).toUpperCase();
}

// Collinson (Priority Pass / LoungeKey) adapter (Phase 13) — airport lounge
// access for the long-layover rule. REVENUE provider, procurement-gated: MOCK
// until COLLINSON_KEY is set. The mock returns a realistic lounge pass so
// propose → confirm → pass-in-hand works end to end today; the real catalogue +
// booking drop in behind this shape. (SmartDelay — lounge auto-triggered by a
// flight delay — is the P11/P13 follow-on noted in the capability map.)

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

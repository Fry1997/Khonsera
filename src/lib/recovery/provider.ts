import { nextServicesTo } from "@/lib/integrations/darwin";
import { otpRouteAlternatives, type OtpPoint } from "@/lib/integrations/otp";
import { wallClockToIso } from "@/lib/time-zone";
import type { RecoveryCandidate } from "./engine";

// Recovery providers (Phase 11) — the ways out, sourced from tools we have:
// - Darwin's destination-filtered board → the next rail services on your booked
//   ROUTE (real, live in prod via DARWIN_LDBWS_TOKEN; deterministic mock until).
// - OTP → ALTERNATIVE routes when the route itself is blocked (a different
//   interchange, rail→tube→rail, a coach leg). Self-hosted, gated on OTP_URL;
//   inert until stood up, so the band degrades gracefully to same-route options.
// (A Valhalla taxi fallback plugs in here too via the same RecoveryCandidate shape.)

function londonDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(iso));
}
const isHHMM = (s: string) => /^\d{2}:\d{2}$/.test(s);

export async function nextRailServices(args: {
  originCrs: string;
  destCrs: string;
  destName: string;
  afterIso: string; // the broken service's departure — recover with what leaves after it
  durationMin: number; // the original journey time — the alternative takes ~the same
  // Coords unlock OTP's alternative-route planning (a blocked-line detour). When
  // absent or OTP_URL is unset, the band is just the Darwin same-route options.
  originCoord?: OtpPoint | null;
  destCoord?: OtpPoint | null;
}): Promise<{ candidates: RecoveryCandidate[]; sample: boolean }> {
  const { originCrs, destCrs, destName, afterIso, durationMin, originCoord, destCoord } = args;
  const date = londonDate(afterIso);
  const afterMs = new Date(afterIso).getTime();
  const dur = durationMin > 0 ? durationMin : 120;

  // Cross-network alternatives (OTP, when stood up + coords known) merge into the
  // same band as the same-route services below. Inert (null) until OTP_URL is set.
  const alts =
    originCoord && destCoord
      ? await otpRouteAlternatives({ origin: originCoord, destination: destCoord, destName, afterIso })
      : null;

  const real = await nextServicesTo(originCrs, destCrs);
  if (real) {
    const candidates: RecoveryCandidate[] = [];
    for (const s of real) {
      if (s.isCancelled) continue;
      const depHHMM = isHHMM(s.etd) ? s.etd : s.std; // honour a known delay estimate
      const departIso = wallClockToIso(date, depHHMM);
      if (!departIso || new Date(departIso).getTime() <= afterMs) continue;
      const arriveIso = new Date(new Date(departIso).getTime() + dur * 60_000).toISOString();
      candidates.push({ id: s.std, label: `${s.std} to ${destName}`, mode: "rail", departIso, arriveIso });
    }
    const merged = mergeAlternatives(candidates, alts);
    if (merged.length) return { candidates: merged.slice(0, 5), sample: false };
  }

  // Mock — deterministic ways-out after the break (drives dev + the surface).
  const candidates: RecoveryCandidate[] = [30, 60, 90].map((off, i) => {
    const departIso = new Date(afterMs + off * 60_000).toISOString();
    return {
      id: `mock-${i}`,
      label: `${clock(departIso)} to ${destName}`,
      mode: "rail" as const,
      departIso,
      arriveIso: new Date(afterMs + (off + dur) * 60_000).toISOString(),
    };
  });
  // If OTP is live it can still add real detours to a mocked same-route board —
  // but then the band isn't wholly sample, so only flag sample when there are none.
  const merged = mergeAlternatives(candidates, alts);
  return { candidates: merged, sample: alts == null || alts.length === 0 };
}

// Fold OTP alternatives in beside the same-route services, dropping ones that
// duplicate a same-route departure minute (OTP often re-finds the direct train).
export function mergeAlternatives(sameRoute: RecoveryCandidate[], alts: RecoveryCandidate[] | null): RecoveryCandidate[] {
  if (!alts || !alts.length) return sameRoute;
  const seen = new Set(sameRoute.map((c) => clock(c.departIso)));
  const extra = alts.filter((a) => a.mode !== "rail" || a.changes ? true : !seen.has(clock(a.departIso)));
  return [...sameRoute, ...extra];
}

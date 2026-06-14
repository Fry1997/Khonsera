import { nextServicesTo } from "@/lib/integrations/darwin";
import { wallClockToIso } from "@/lib/time-zone";
import type { RecoveryCandidate } from "./engine";

// Recovery providers (Phase 11) — the ways out, sourced from tools we have:
// Darwin's destination-filtered board for the next rail services (real, live in
// prod via DARWIN_LDBWS_TOKEN), with a deterministic mock until the key flows.
// (TfL journey-planner alternatives and a Valhalla taxi fallback plug in here
// too via the same RecoveryCandidate shape.)

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
}): Promise<{ candidates: RecoveryCandidate[]; sample: boolean }> {
  const { originCrs, destCrs, destName, afterIso, durationMin } = args;
  const date = londonDate(afterIso);
  const afterMs = new Date(afterIso).getTime();
  const dur = durationMin > 0 ? durationMin : 120;

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
    if (candidates.length) return { candidates: candidates.slice(0, 4), sample: false };
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
  return { candidates, sample: true };
}

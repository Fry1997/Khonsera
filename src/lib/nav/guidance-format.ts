// Guidance surface presentation helpers (N1) — pure, so the wording of the
// differentiator is testable without a DOM. The chip's spare reading is the number
// the user reads first; its phrasing is by state (Design N1 redline):
//   on_track  → "13 MIN EARLY"   (you land with room)
//   thinning  → "4 MIN SPARE"    (the margin is getting thin)
//   will_miss → "3 MIN LATE"     (stated levelly, never alarm)

import type { EventETA } from "./event-eta";
import type { RecoveryMode } from "@/lib/recovery/engine";

export function spareLabel(eta: Pick<EventETA, "state" | "spareMin">): string {
  const n = Math.abs(eta.spareMin);
  if (eta.state === "will_miss") return `${n} MIN LATE`;
  if (eta.state === "thinning") return `${n} MIN SPARE`;
  return `${n} MIN EARLY`;
}

// The eyebrow above the chip — "For the 14:00 meeting".
export function etaForLabel(name: string): string {
  return `For ${name}`;
}

// A calm, world-fact default sub-line per state (the surface accepts an explicit
// one from the live layer; this is the fallback). Never about the user's body/mood
// (the §rule) — only the state of the world / the plan.
export function defaultEtaSub(eta: Pick<EventETA, "state">): string {
  if (eta.state === "will_miss") return "As it stands, just past the hour";
  if (eta.state === "thinning") return "The margin is getting thin";
  return "You land with room to spare";
}

// Decision-mode → the glyph key used by the surface's mode pill.
export type NavGlyphKey = "tube" | "taxi" | "bus" | "walk" | "rail" | "drive";
export function glyphForMode(mode: RecoveryMode): NavGlyphKey {
  switch (mode) {
    case "tube": return "tube";
    case "taxi": return "taxi";
    case "bus": return "bus";
    case "walk": return "walk";
    case "rail": return "rail";
    default: return "drive"; // "mixed" and anything else read as ground transport
  }
}

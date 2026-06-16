// Day-commitments reader — turns the day's anchors (Today's spine) into the
// NavCommitment[] the navigation session projects ETAs against. Pure / testable.
//
// The active anchor (the obligation you're navigating to) is the lead commitment
// (downstreamMin 0); anchors further down the day carry their SCHEDULED offset from
// it, so "you're behind to the next thing" cascades into "…and the thing after."
// The comfort buffer per commitment comes from its kind (D77): an airport wants the
// airport buffer, a rail platform the station buffer, a meeting the meeting buffer.

import { comfortBufferMinutes, type ComfortBufferProfile } from "@/lib/itinerary/buffers";
import type { NavCommitment } from "./session";

export type CommitmentAnchor = {
  id: string;
  title: string;
  place?: string;
  arriveByIso: string | null;
  // Present when the anchor is a transport hub; `kind` distinguishes airport / rail
  // / tube so the buffer matches (a flight ≫ a train ≫ a tube change).
  station: { kind?: string | null } | null;
};

export function buildNavCommitments(
  anchors: CommitmentAnchor[],
  activeAnchorId: string,
  profile?: ComfortBufferProfile | null,
): NavCommitment[] {
  const startIdx = anchors.findIndex((a) => a.id === activeAnchorId);
  if (startIdx < 0) return [];
  // The active anchor onward, only those with a needed-by time (an ETA needs one).
  const ahead = anchors.slice(startIdx).filter((a) => a.arriveByIso);
  const base = (anchors[startIdx].arriveByIso ?? ahead[0]?.arriveByIso) || null;
  if (!base) return [];
  const baseMs = Date.parse(base);

  return ahead.map((a) => {
    const kind = a.station?.kind ?? null;
    const type = a.station
      ? kind === "airport"
        ? "flight"
        : "transit_departure"
      : "appointment";
    const mode = a.station ? (kind === "tube" || kind === "underground" ? "tube" : "train") : undefined;
    const downstreamMin = Math.max(0, Math.round((Date.parse(a.arriveByIso!) - baseMs) / 60_000));
    return {
      id: a.id,
      name: a.title,
      place: a.place ?? a.title,
      neededByIso: a.arriveByIso!,
      bufferMin: comfortBufferMinutes({ type, mode }, profile),
      downstreamMin,
    };
  });
}

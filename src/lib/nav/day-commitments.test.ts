import { describe, expect, it } from "vitest";
import { buildNavCommitments, type CommitmentAnchor } from "./day-commitments";

const anchors: CommitmentAnchor[] = [
  { id: "home", title: "Home", arriveByIso: null, station: null },
  { id: "station", title: "Harpenden Station", arriveByIso: "2026-06-25T13:30:00.000Z", station: { kind: "rail" } },
  { id: "meeting", title: "the 14:00 meeting", place: "Dancing Duck", arriveByIso: "2026-06-25T14:00:00.000Z", station: null },
  { id: "flight", title: "LTN", arriveByIso: "2026-06-25T16:00:00.000Z", station: { kind: "airport" } },
];

describe("buildNavCommitments", () => {
  it("leads with the active anchor (downstream 0) and offsets the rest from it", () => {
    const cms = buildNavCommitments(anchors, "station");
    expect(cms.map((c) => c.id)).toEqual(["station", "meeting", "flight"]);
    expect(cms[0].downstreamMin).toBe(0); // the active one
    expect(cms[1].downstreamMin).toBe(30); // 13:30 → 14:00
    expect(cms[2].downstreamMin).toBe(150); // 13:30 → 16:00
  });

  it("buffers by kind: rail station, meeting, airport", () => {
    const cms = buildNavCommitments(anchors, "station");
    expect(cms[0].bufferMin).toBe(15); // rail station
    expect(cms[1].bufferMin).toBe(10); // meeting
    expect(cms[2].bufferMin).toBe(90); // airport
  });

  it("a tube station gets the quick buffer", () => {
    const tube: CommitmentAnchor[] = [
      { id: "t", title: "Victoria", arriveByIso: "2026-06-25T09:00:00.000Z", station: { kind: "tube" } },
    ];
    expect(buildNavCommitments(tube, "t")[0].bufferMin).toBe(5);
  });

  it("ignores anchors before the active one and those without a time", () => {
    const cms = buildNavCommitments(anchors, "meeting");
    expect(cms.map((c) => c.id)).toEqual(["meeting", "flight"]);
    expect(cms[0].downstreamMin).toBe(0);
  });

  it("returns [] when the active anchor isn't found", () => {
    expect(buildNavCommitments(anchors, "nope")).toEqual([]);
  });
});

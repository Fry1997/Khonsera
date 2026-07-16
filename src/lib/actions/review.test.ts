import { describe, expect, it } from "vitest";

import { deriveReviewLeaveBy, type ReviewStopRow as StopRow, type ReviewTransitionRow as TransRow } from "./review-derive";

const at = (clock: string) => `2026-07-16T${clock}:00.000Z`;

function tr(from_stop_id: string, to_stop_id: string): TransRow {
  return { from_stop_id, to_stop_id, mode: "train", is_locked: true, computed_duration_minutes: 30 };
}

describe("deriveReviewLeaveBy", () => {
  it("uses the explicit start stop departure when present", () => {
    const stops: StopRow[] = [
      { id: "home", type: "start", title: "Home", start_time: null, end_time: at("05:55") },
      { id: "station", type: "transit_departure", title: "Wellingborough", start_time: at("06:25"), end_time: null },
    ];

    expect(deriveReviewLeaveBy(stops, [tr("home", "station")])).toBe(at("05:55"));
  });

  it("back-calculates from the first start leg when the base has no stored departure", () => {
    const stops: StopRow[] = [
      { id: "office", type: "start", title: "Office", start_time: null, end_time: null },
      { id: "breww", type: "appointment", title: "Breww Office Day", start_time: at("09:00"), end_time: at("17:00") },
    ];

    expect(deriveReviewLeaveBy(stops, [tr("office", "breww")])).toBe(at("08:25"));
  });

  it("falls back to the first real departure when a legacy journey has no start bookend", () => {
    const stops: StopRow[] = [
      { id: "wel", type: "transit_departure", title: "Wellingborough", start_time: at("06:25"), end_time: null },
      { id: "lut", type: "transit_changeover", title: "Luton", start_time: at("06:55"), end_time: at("07:13") },
      { id: "har", type: "transit_arrival", title: "Harpenden", start_time: null, end_time: at("07:21") },
    ];

    expect(deriveReviewLeaveBy(stops, [tr("wel", "lut"), tr("lut", "har")])).toBe(at("06:25"));
  });

  it("does not show a transit arrival as leave-by when only arrival-like stops are available", () => {
    const stops: StopRow[] = [
      { id: "har", type: "transit_arrival", title: "Harpenden", start_time: null, end_time: at("07:21") },
    ];

    expect(deriveReviewLeaveBy(stops, [])).toBeNull();
  });
});

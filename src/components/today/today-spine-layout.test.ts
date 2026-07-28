import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TodaySpine } from "@/components/today/today-spine";
import type { SpineAnchor } from "./spine-model";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const anchor: SpineAnchor = {
  id: "work",
  type: "shift",
  title: "Work",
  place: "Breww Office",
  arriveByIso: "2026-07-28T09:00:00+01:00",
  endIso: "2026-07-28T17:00:00+01:00",
  coord: { lat: 51.8172, lng: -0.356 },
  plannedTravelMinutes: null,
  station: null,
  role: "stop",
};

describe("active Today spine layout contract", () => {
  it("renders the instrument spine rather than the retired v7 rail", () => {
    const html = renderToStaticMarkup(
      createElement(TodaySpine, {
        anchors: [anchor],
        nextId: "work",
        nowOverride: 0,
      }),
    );

    expect(html).toContain("cc-spine-heading");
    expect(html).toContain("Your itinerary");
    expect(html).not.toContain("cc-spine-v7");
  });
});

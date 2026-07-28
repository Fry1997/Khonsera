import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TicketVM } from "@/components/concierge";
import { TodaySpine } from "./today-spine-fixed";
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
  navMode: "walk",
  station: null,
  role: "stop",
};

const railTicket: TicketVM = {
  id: "screen-one-rail",
  kind: "rail",
  operator: "Thameslink",
  source: "manual",
  legs: [
    {
      id: "screen-one-rail-leg",
      origin: {
        place: "Harpenden",
        code: "HPD",
        time: "2026-07-28T17:32:00+01:00",
        platform: "1",
      },
      destination: {
        place: "London St Pancras",
        code: "STP",
        time: "2026-07-28T18:02:00+01:00",
      },
      status: { status: "on_time" },
    },
  ],
};

const populatedAnchors: SpineAnchor[] = [
  {
    id: "station",
    type: "custom",
    title: "Harpenden Station",
    place: "Harpenden",
    arriveByIso: "2026-07-28T17:22:00+01:00",
    endIso: "2026-07-28T17:32:00+01:00",
    coord: { lat: 51.8146, lng: -0.3515 },
    plannedTravelMinutes: 12,
    bufferMinutes: 15,
    navMode: "walk",
    station: {
      name: "Harpenden",
      code: "HPD",
      kind: "rail_station",
    },
    role: "departure",
    pass: {
      ticket: railTicket,
      crs: "HPD",
      time: "17:32",
      dest: "STP",
    },
  },
  {
    id: "change",
    type: "custom",
    title: "London St Pancras",
    place: "London",
    arriveByIso: "2026-07-28T18:02:00+01:00",
    endIso: "2026-07-28T18:10:00+01:00",
    coord: { lat: 51.5308, lng: -0.1238 },
    plannedTravelMinutes: null,
    navMode: "walk",
    station: {
      name: "London St Pancras",
      code: "STP",
      kind: "rail_station",
    },
    role: "changeover",
  },
  {
    id: "dinner",
    type: "reservation",
    title: "Dinner at Sessions Arts Club",
    place: "Clerkenwell",
    arriveByIso: "2026-07-28T18:45:00+01:00",
    endIso: "2026-07-28T20:30:00+01:00",
    coord: { lat: 51.5229, lng: -0.111 },
    plannedTravelMinutes: 18,
    navMode: "walk",
    station: null,
    role: "stop",
  },
];

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

  it("renders a populated multi-leg day with real movement, pass, and change cards", () => {
    const html = renderToStaticMarkup(
      createElement(TodaySpine, {
        anchors: populatedAnchors,
        nextId: "station",
        nowOverride: Date.parse("2026-07-28T16:30:00+01:00"),
        toolbar: createElement("span", null, "Keep 15-min margin"),
      }),
    );

    expect(html).toContain("3 timed points");
    expect(html).toContain("Keep 15-min margin");
    expect(html).toContain('data-kind="walk"');
    expect(html).toContain("cc-pass--today");
    expect(html).toContain("cc-transfer");
    expect(html).toContain("Dinner at Sessions Arts Club");
  });
});

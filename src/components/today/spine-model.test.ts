import { describe, it, expect } from "vitest";
import { stationLabel, roleOf, roleLabel, navigateHref, navModeForTransition } from "./spine-model";

describe("stationLabel", () => {
  it("appends Station to a bare rail hub name", () => {
    expect(stationLabel("Harpenden", "rail_station")).toBe("Harpenden Station");
    expect(stationLabel("Luton", "rail_station")).toBe("Luton Station");
  });

  it("appends Airport for air hubs", () => {
    expect(stationLabel("Luton", "airport")).toBe("Luton Airport");
  });

  it("leaves names that already carry a station/airport noun alone", () => {
    expect(stationLabel("London St Pancras International", "rail_station")).toBe("London St Pancras International");
    expect(stationLabel("Luton Airport Parkway", "rail_station")).toBe("Luton Airport Parkway");
    expect(stationLabel("Birmingham New Street Station", "rail_station")).toBe("Birmingham New Street Station");
  });
});

describe("roleOf", () => {
  it("reads the leg role from the raw stop type", () => {
    expect(roleOf("transit_departure")).toBe("departure");
    expect(roleOf("transit_changeover")).toBe("changeover");
    expect(roleOf("transit_arrival")).toBe("arrival");
    expect(roleOf("station")).toBe("stop");
    expect(roleOf("appointment")).toBe("stop");
  });
});

describe("roleLabel", () => {
  const rail = { name: "Harpenden", code: "HPD", kind: "rail_station" as const };
  it("names the leg role", () => {
    expect(roleLabel("departure", rail)).toBe("Departure");
    expect(roleLabel("changeover", rail)).toBe("Change");
    expect(roleLabel("arrival", rail)).toBe("Arrival");
  });
  it("falls back to Station / Airport / Stop", () => {
    expect(roleLabel("stop", rail)).toBe("Station");
    expect(roleLabel("stop", { name: "Luton", code: null, kind: "airport" })).toBe("Airport");
    expect(roleLabel("stop", null)).toBe("Stop");
  });
});

describe("navigateHref", () => {
  it("builds a /navigate deep link to the station point", () => {
    const href = navigateHref({ coord: { lat: 51.8156, lng: -0.3536 }, title: "Harpenden Station" });
    expect(href).toContain("/navigate?");
    expect(href).toContain("dlat=51.8156");
    expect(href).toContain("dlng=-0.3536");
    expect(href).toContain("dname=Harpenden+Station");
  });
  it("is null without coordinates", () => {
    expect(navigateHref({ coord: null, title: "Somewhere" })).toBeNull();
  });
});

describe("navModeForTransition", () => {
  it("maps plan modes onto door-nav costings, defaulting to walk", () => {
    expect(navModeForTransition("drive")).toBe("drive");
    expect(navModeForTransition("taxi")).toBe("drive");
    expect(navModeForTransition("cycle")).toBe("cycle");
    expect(navModeForTransition("train")).toBe("walk");
    expect(navModeForTransition(null)).toBe("walk");
  });
});

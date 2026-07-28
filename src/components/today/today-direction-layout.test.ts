import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const todayPage = readFileSync(
  new URL("../../app/(app)/today/page.tsx", import.meta.url),
  "utf8",
);
const liveDay = readFileSync(
  new URL("./live-day.tsx", import.meta.url),
  "utf8",
);
const appLayout = readFileSync(
  new URL("../../app/(app)/layout.tsx", import.meta.url),
  "utf8",
);
const directionCss = readFileSync(
  new URL("../../app/khonsera-today-direction.css", import.meta.url),
  "utf8",
);

describe("the approved Today application direction", () => {
  it("keeps the next move and route map inside one dominant command surface", () => {
    const command = todayPage.indexOf('className="cc-today-command"');
    const map = todayPage.indexOf('className="cc-today-command-map"');
    const forecast = todayPage.indexOf('className="cc-day-forecast"');
    const itinerary = todayPage.indexOf('className="cc-day-primary"');

    expect(command).toBeGreaterThan(-1);
    expect(map).toBeGreaterThan(command);
    expect(forecast).toBeGreaterThan(map);
    expect(itinerary).toBeGreaterThan(forecast);
  });

  it("retains the four approved next-move actions", () => {
    expect(liveDay).toContain("View best route");
    expect(liveDay).toContain("Share trip");
    expect(liveDay).toContain("Re-route");
    expect(liveDay).toContain("Tickets");
  });

  it("uses unified chrome instead of the retired permanent desktop rail", () => {
    expect(appLayout).toContain("khonsera-app--unified");
    expect(appLayout).not.toContain("AppSidebar");
    expect(appLayout).not.toContain("cc-app-desktop");
  });

  it("styles the itinerary as one continuous object", () => {
    expect(directionCss).toContain(".cc-today-direction .cc-spine {");
    expect(directionCss).toContain("border-radius: 22px");
    expect(directionCss).toContain(".cc-today-command-map");
  });
});

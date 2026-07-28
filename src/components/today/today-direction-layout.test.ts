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
  new URL("../../app/khonsera-screen-one.css", import.meta.url),
  "utf8",
);

describe("the approved Screen One Today direction", () => {
  it("keeps one dominant next-move surface ahead of weather and itinerary", () => {
    const command = todayPage.indexOf('className="cc-today-command"');
    const forecast = todayPage.indexOf('className="cc-day-forecast"');
    const itinerary = todayPage.indexOf('className="cc-day-primary"');

    expect(command).toBeGreaterThan(-1);
    expect(forecast).toBeGreaterThan(command);
    expect(itinerary).toBeGreaterThan(forecast);
    expect(todayPage).not.toContain('className="cc-today-command-map"');
    expect(todayPage).not.toContain("<PlanMap");
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

  it("keeps the screen controls wired to real product flows", () => {
    expect(todayPage).toContain("<TodayBufferControl");
    expect(todayPage).toContain("Tickets today");
    expect(todayPage).toContain('label="Plan something"');
  });

  it("implements the compact orange timeline and operational pass", () => {
    expect(directionCss).toContain("--kh-today-accent: var(--rail)");
    expect(directionCss).toContain(".cc-today-buffer");
    expect(directionCss).toContain(".cc-timeline-icon");
    expect(directionCss).toContain(".cc-pass.cc-pass--today");
    expect(directionCss).toContain(".cc-today-direction .cc-spine {");
  });
});

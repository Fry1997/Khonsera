import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
const system = readFileSync(join(root, "src/app/khonsera-system.css"), "utf8");
const components = readFileSync(
  join(root, "src/app/khonsera-components.css"),
  "utf8",
);
const primaryFlows = readFileSync(
  join(root, "src/app/khonsera-primary-flows.css"),
  "utf8",
);
const secondarySurfaces = readFileSync(
  join(root, "src/app/khonsera-secondary-surfaces.css"),
  "utf8",
);
const todayPage = readFileSync(
  join(root, "src/app/(app)/today/page.tsx"),
  "utf8",
);
const planPage = readFileSync(
  join(root, "src/app/(app)/plan/[id]/page.tsx"),
  "utf8",
);

describe("app-wide Khonsera component system", () => {
  it("loads every shared layer in authority order", () => {
    const foundationIndex = layout.indexOf('"./khonsera-system.css"');
    const componentIndex = layout.indexOf('"./khonsera-components.css"');
    const primaryFlowIndex = layout.indexOf('"./khonsera-primary-flows.css"');
    const secondaryIndex = layout.indexOf('"./khonsera-secondary-surfaces.css"');

    expect(foundationIndex).toBeGreaterThan(-1);
    expect(componentIndex).toBeGreaterThan(foundationIndex);
    expect(primaryFlowIndex).toBeGreaterThan(componentIndex);
    expect(secondaryIndex).toBeGreaterThan(primaryFlowIndex);
  });

  it("keeps palette and component appearance in central app layers", () => {
    expect(system).toContain("--kh-ground:");
    expect(system).toContain("--kh-green:");
    expect(system).toContain("--kh-orange:");

    for (const selector of [
      ".cc-tab",
      ".cc-rail-item",
      ".cc-spine",
      ".cc-anchor-card",
      ".cc-leg-card",
      ".cc-pass",
      ".cc-ticket",
      ".cc-sheet",
    ]) {
      expect(components).toContain(selector);
    }
  });

  it("covers the shared Today and Plan itinerary vocabulary", () => {
    for (const selector of [
      ".cc-walk",
      ".cc-appt",
      ".cc-station-card",
      ".cc-transfer",
      ".cc-gap-card",
      ".cc-var",
      ".cc-status-strip",
    ]) {
      expect(components).toContain(selector);
    }
  });

  it("treats Today and Plan as one primary-flow family", () => {
    expect(todayPage).toContain('className="cc-today-direction"');
    expect(todayPage).toContain('className="cc-day-dashboard"');
    expect(planPage).toContain('className="cc-plan-detail"');
    expect(planPage).toContain('className="cc-plan-grid"');

    for (const selector of [
      ".cc-today-direction, .cc-plan-detail",
      ".cc-day-dashboard, .cc-plan-grid",
      ".cc-day-primary, .cc-plan-primary",
      ".cc-day-context, .cc-plan-context",
      ".cc-today-head, .cc-day-header",
    ]) {
      expect(primaryFlows).toContain(selector);
    }
  });

  it("covers the secondary route families without route-specific palettes", () => {
    for (const selector of [
      ".cc-plan-group",
      ".cc-journey-card",
      ".cc-wallet",
      ".cc-pass--peek",
      ".cc-task-row",
      ".cc-list-row",
      ".cc-total-bar",
      ".cc-empty",
    ]) {
      expect(secondarySurfaces).toContain(selector);
    }
  });
});

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

describe("app-wide Khonsera component system", () => {
  it("loads the shared component layer after the foundation", () => {
    const foundationIndex = layout.indexOf('"./khonsera-system.css"');
    const componentIndex = layout.indexOf('"./khonsera-components.css"');

    expect(foundationIndex).toBeGreaterThan(-1);
    expect(componentIndex).toBeGreaterThan(foundationIndex);
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
});

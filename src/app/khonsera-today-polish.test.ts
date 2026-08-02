import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
const polish = readFileSync(
  join(root, "src/app/khonsera-today-polish.css"),
  "utf8",
);
const demo = readFileSync(
  join(root, "src/components/today/today-demo-client.tsx"),
  "utf8",
);

describe("Today card-by-card polish", () => {
  it("loads after the shared layout system so it can correct final placement", () => {
    const layoutIndex = layout.indexOf('"./khonsera-layout.css"');
    const polishIndex = layout.indexOf('"./khonsera-today-polish.css"');
    expect(layoutIndex).toBeGreaterThan(-1);
    expect(polishIndex).toBeGreaterThan(layoutIndex);
  });

  it("keeps the active movement leg readable and names every next action", () => {
    expect(polish).toContain('.cc-node[data-state="next"] .cc-walk');
    expect(polish).toContain("background: var(--kh-surface) !important");
    expect(polish).toContain(".cc-next-action-label");
    expect(polish).toContain("grid-column: 1 / -1");
  });

  it("keeps mobile demo explanation concise without removing the data boundary", () => {
    expect(polish).toContain(".cc-today-demo .cc-day-context");
    expect(polish).toContain("display: none");
    expect(demo).toContain("Your real Today and account data remain untouched");
    expect(demo).toContain("No stops, bookings or status are read from or");
  });

  it("uses a coherent Wellingborough to Harpenden sample journey", () => {
    expect(demo).toContain('name: "Home, Wellingborough"');
    expect(demo).toContain('place: "Wellingborough"');
    expect(demo).toContain('place: "Luton"');
    expect(demo).toContain('place: "Harpenden"');
    expect(demo).toContain('reference: "DEMO WEL-01"');
    expect(demo).toContain('reference: "DEMO LUT-02"');
  });
});

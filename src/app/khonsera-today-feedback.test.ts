import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
const css = readFileSync(
  join(root, "src/app/khonsera-today-feedback.css"),
  "utf8",
);
const spine = readFileSync(
  join(root, "src/components/today/today-spine.tsx"),
  "utf8",
);

describe("Today detailed feedback pass", () => {
  it("loads after the earlier Today polish layer", () => {
    const polishIndex = layout.indexOf('"./khonsera-today-polish.css"');
    const feedbackIndex = layout.indexOf('"./khonsera-today-feedback.css"');
    expect(polishIndex).toBeGreaterThan(-1);
    expect(feedbackIndex).toBeGreaterThan(polishIndex);
  });

  it("uses one SVG spine icon family instead of inherited geometric markers", () => {
    expect(spine).toContain("function SpineIcon");
    expect(spine).toContain('className="cc-spine-icon"');
    expect(spine).toContain('kind="train"');
    expect(spine).toContain('kind="change"');
    expect(spine).not.toContain('className="cc-med-leg"');
    expect(css).toContain('.cc-spine-icon[data-kind="train"]');
  });

  it("adds a distinct transport-hub arrival before a booked departure", () => {
    expect(spine).toContain("hasImplicitHubArrival");
    expect(spine).toContain("<HubArrivalCard");
    expect(spine).toContain("Arrive at station");
    expect(spine).toContain("min at station");
    expect(css).toContain(".cc-hub-arrival-window");
  });

  it("gives badges clearance and structures connection timing", () => {
    expect(css).toContain("padding: 17px 14px 13px");
    expect(css).toContain(".cc-walk-mode");
    expect(spine).toContain("cc-transfer-duration");
    expect(spine).toContain("cc-transfer-window");
    expect(css).toContain("grid-column: 1 / -1");
  });
});

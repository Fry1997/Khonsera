import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
const css = readFileSync(
  join(root, "src/app/khonsera-today-spine-fix.css"),
  "utf8",
);

describe("Today spine visual correction", () => {
  it("loads after every older Today styling layer", () => {
    const feedback = layout.indexOf('"./khonsera-today-feedback.css"');
    const finalFix = layout.indexOf('"./khonsera-today-spine-fix.css"');
    expect(feedback).toBeGreaterThan(-1);
    expect(finalFix).toBeGreaterThan(feedback);
  });

  it("removes legacy marker geometry and forces visible SVG strokes", () => {
    expect(css).toContain(".cc-node-dot::before");
    expect(css).toContain("content: none !important");
    expect(css).toContain("stroke: currentColor !important");
    expect(css).toContain('data-kind="train"');
    expect(css).toContain("border-radius: 9px 9px 9px 3px !important");
  });

  it("keeps movement badges inside the card and below its accent", () => {
    expect(css).toContain("padding: 22px 14px 14px !important");
    expect(css).toContain("position: static !important");
    expect(css).toContain("inset: auto !important");
    expect(css).toContain(".cc-walk-mode::before");
  });

  it("restores readable journey and connection contrast", () => {
    expect(css).toContain("background: var(--kh-surface) !important");
    expect(css).toContain("background: var(--kh-orange-soft) !important");
    expect(css).toContain("color: var(--kh-ink-2) !important");
    expect(css).toContain("font-style: normal !important");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
const css = readFileSync(join(root, "src/app/khonsera-today.css"), "utf8");
const spine = readFileSync(
  join(root, "src/components/today/today-spine.tsx"),
  "utf8",
);

describe("canonical Today design system", () => {
  it("loads one route-specific Today stylesheet after the shared layers", () => {
    expect(layout).toContain('import "./khonsera-today.css"');
    expect(layout).not.toContain('import "./khonsera-today-direction.css"');
    expect(layout).not.toContain('import "./khonsera-screen-one.css"');
    expect(layout).not.toContain('import "./khonsera-today-polish.css"');
    expect(layout).not.toContain('import "./khonsera-today-feedback.css"');
    expect(layout).not.toContain('import "./khonsera-today-spine-fix.css"');

    const todayIndex = layout.indexOf('import "./khonsera-today.css"');
    const layoutIndex = layout.indexOf('import "./khonsera-layout.css"');
    expect(todayIndex).toBeGreaterThan(layoutIndex);
  });

  it("uses a Today-only spine contract instead of inherited legacy geometry", () => {
    expect(spine).toContain('className="kh-spine"');
    expect(spine).toContain('className="kh-spine-node');
    expect(spine).toContain('className="kh-spine-marker-col"');
    expect(spine).toContain('className="kh-spine-marker"');
    expect(spine).toContain('className="kh-movement-card"');
    expect(spine).toContain('className="kh-change-card"');
    expect(spine).not.toContain('className="cc-node"');
    expect(spine).not.toContain('className="cc-node-dot"');
    expect(spine).not.toContain('className="pg cc-walk"');
  });

  it("defines the audited spacing, marker, movement and transfer rules", () => {
    expect(css).toContain("--today-space-1: 4px");
    expect(css).toContain("--today-space-6: 32px");
    expect(css).toContain("grid-template-columns: 29px minmax(0, 1fr)");
    expect(css).toContain("left: 14px");
    expect(css).toContain(".kh-movement-card");
    expect(css).toContain(".kh-change-times");
    expect(css).toContain(".kh-pass-shell .cc-pass");
  });

  it("keeps operational surfaces neutral and issued documents paper-warm", () => {
    expect(css).toContain("--today-surface: #ffffff");
    expect(css).toContain("--today-paper: #fcfaf5");
    expect(css).toContain("background: var(--today-surface)");
    expect(css).toContain("background: var(--today-paper) !important");
  });

  it("keeps live state green and directional identity orange", () => {
    expect(css).toContain("--today-green-strong: #063b34");
    expect(css).toContain("--today-orange: #cf531f");
    expect(css).toContain('[data-kind="train"]');
    expect(css).toContain('[data-active="true"]');
  });
});

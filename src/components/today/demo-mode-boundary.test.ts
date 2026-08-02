import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const gate = readFileSync(
  join(root, "src/components/today/today-demo.tsx"),
  "utf8",
);
const demo = readFileSync(
  join(root, "src/components/today/today-demo-client.tsx"),
  "utf8",
);
const demoCss = readFileSync(
  join(root, "src/app/khonsera-demo.css"),
  "utf8",
);
const demoMode = readFileSync(
  join(root, "src/lib/demo-mode.ts"),
  "utf8",
);
const action = readFileSync(
  join(root, "src/app/(app)/demo-mode-actions.ts"),
  "utf8",
);
const indicator = readFileSync(
  join(root, "src/components/demo-mode-indicator.tsx"),
  "utf8",
);
const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");

describe("staff Today demo boundary", () => {
  it("renders the scenario through the production Today component family", () => {
    expect(demo).toContain('import { LiveDay }');
    expect(demo).toContain('import { TodaySpine }');
    expect(demo).toContain("<LiveDay");
    expect(demo).toContain("<TodaySpine");
    expect(demo).toContain('className="cc-today-direction cc-today-demo"');
  });

  it("keeps the scenario visibly and semantically separate from account data", () => {
    expect(demo).toContain('data-demo="true"');
    expect(demo).toContain("isolated sample data, not your Today");
    expect(demo).not.toContain("createClient");
    expect(demo).not.toContain("setLiveTransitionProgress");
  });

  it("preserves the natural Today header before presenting demo controls", () => {
    expect(gate).toContain("getLocalWeather");
    expect(gate).toContain("<TodayDemoClient weather={weather}");
    expect(demo).toContain('eyebrow="Today"');
    expect(demo).toContain('title="Right now"');
    expect(demo).toContain('className="cc-weather"');
    expect(demo).toContain('className="cc-demo-controls"');
    expect(demo.indexOf("actions={")).toBeLessThan(
      demo.indexOf('className="cc-demo-controls"'),
    );
    expect(demoCss).toContain('"demo-controls context"');
  });

  it("uses the Settings switch as the authority for every entry point", () => {
    expect(gate).toContain("isDemoModeActive");
    expect(gate).toContain('redirect("/today")');
    expect(gate).toContain("<TodayDemoClient");
    expect(demoMode).toContain("if (!ctx.isStaff) return false");
    expect(demoMode).toContain('throw new Error("Demo mode is staff-only")');
    expect(action).toContain('redirect("/today")');
    expect(indicator).toContain('role="switch"');
    expect(indicator).toContain("Showing your real Today");
  });

  it("loads the demo identifier after the shared application system", () => {
    const shared = layout.indexOf('"./khonsera-secondary-surfaces.css"');
    const demoBoundary = layout.indexOf('"./khonsera-demo.css"');
    expect(shared).toBeGreaterThan(-1);
    expect(demoBoundary).toBeGreaterThan(shared);
  });
});

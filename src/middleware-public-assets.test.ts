import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const middleware = readFileSync(join(root, "src/middleware.ts"), "utf8");
const sessionMiddleware = readFileSync(
  join(root, "src/lib/supabase/middleware.ts"),
  "utf8",
);

describe("PWA assets remain reachable before authentication", () => {
  it("keeps the service worker outside the auth matcher", () => {
    expect(middleware).toContain("sw.js");
    expect(middleware).toContain("manifest.webmanifest");
    expect(middleware).toContain("offline");
  });

  it("also treats PWA bootstrap routes as public if the matcher changes", () => {
    expect(sessionMiddleware).toContain('"/sw.js"');
    expect(sessionMiddleware).toContain('"/manifest.webmanifest"');
    expect(sessionMiddleware).toContain('"/offline"');
  });
});

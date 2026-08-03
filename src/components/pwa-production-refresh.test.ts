import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
const register = readFileSync(
  join(root, "src/components/pwa-register.tsx"),
  "utf8",
);
const worker = readFileSync(join(root, "public/sw.js"), "utf8");

describe("production PWA refresh", () => {
  it("versions the service worker from the Vercel deployment", () => {
    expect(layout).toContain("VERCEL_GIT_COMMIT_SHA");
    expect(layout).toContain("<PwaRegister version={deploymentVersion} />");
    expect(register).toContain("/sw.js?v=");
    expect(register).toContain('updateViaCache: "none"');
  });

  it("checks for updates and reloads when a new worker controls the app", () => {
    expect(register).toContain('"controllerchange"');
    expect(register).toContain("window.location.reload()");
    expect(register).toContain("registration.update()");
    expect(register).toContain('"visibilitychange"');
    expect(register).toContain('"focus"');
  });

  it("separates caches by deployment and never serves cached HTML online", () => {
    expect(worker).toContain('searchParams.get("v")');
    expect(worker).toContain("const VERSION = `khonsera-${deploymentVersion}`");
    expect(worker).toContain('{ cache: "no-store" }');
    expect(worker).toContain('event.data?.type === "SKIP_WAITING"');
  });

  it("never caches Next router or React Server Component responses", () => {
    expect(worker).toContain("function isNextRouteData");
    expect(worker).toContain('url.searchParams.has("_rsc")');
    expect(worker).toContain('request.headers.get("RSC") === "1"');
    expect(worker).toContain('request.headers.has("Next-Router-State-Tree")');
    expect(worker).toContain('request.headers.has("Next-Router-Prefetch")');
    expect(worker).toContain('fetch(request, { cache: "no-store" })');
  });

  it("limits non-hashed cache writes to explicit offline-safe assets", () => {
    expect(worker).toContain("const SAFE_STATIC_PATHS");
    expect(worker).toContain('"/manifest.webmanifest"');
    expect(worker).toContain('"/icon.svg"');
    expect(worker).not.toContain("event.respondWith(staleWhileRevalidate(request));\n});");
  });
});

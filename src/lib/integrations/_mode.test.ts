import { describe, expect, it } from "vitest";
import { decideIntegrationMode } from "./_mode";

describe("decideIntegrationMode", () => {
  it("returns 'live' when the feature flag is on, regardless of user", () => {
    expect(
      decideIntegrationMode({
        featureLive: true,
        isStaff: false,
        demoModeOn: false,
      }),
    ).toBe("live");
    expect(
      decideIntegrationMode({
        featureLive: true,
        isStaff: true,
        demoModeOn: true,
      }),
    ).toBe("live");
  });

  it("returns 'demo' only when staff AND demo cookie is on", () => {
    expect(
      decideIntegrationMode({
        featureLive: false,
        isStaff: true,
        demoModeOn: true,
      }),
    ).toBe("demo");
  });

  it("returns 'unavailable' for a real user even with demo cookie", () => {
    expect(
      decideIntegrationMode({
        featureLive: false,
        isStaff: false,
        demoModeOn: true,
      }),
    ).toBe("unavailable");
  });

  it("returns 'unavailable' for staff who haven't toggled demo mode", () => {
    expect(
      decideIntegrationMode({
        featureLive: false,
        isStaff: true,
        demoModeOn: false,
      }),
    ).toBe("unavailable");
  });

  it("returns 'unavailable' for an anonymous-equivalent caller", () => {
    expect(
      decideIntegrationMode({
        featureLive: false,
        isStaff: false,
        demoModeOn: false,
      }),
    ).toBe("unavailable");
  });
});

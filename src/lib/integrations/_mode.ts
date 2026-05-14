// Decision logic for which mode an integration call runs in. Pure so it can
// be unit-tested without Next.js context. The integration modules read the
// real values (feature flag, isStaff, cookie) and pass them in.
//
// Rules:
//   1. If the feature is live → "live" (real provider call)
//   2. Else if the caller is staff AND demo cookie is on → "demo"
//   3. Else → "unavailable" (real users see honest "coming soon" state)

export type IntegrationMode = "live" | "demo" | "unavailable";

export type ModeContext = {
  featureLive: boolean;
  isStaff: boolean;
  demoModeOn: boolean;
};

export function decideIntegrationMode(ctx: ModeContext): IntegrationMode {
  if (ctx.featureLive) return "live";
  if (ctx.isStaff && ctx.demoModeOn) return "demo";
  return "unavailable";
}

import { features } from "@/lib/features";
import { isDemoModeActive } from "@/lib/demo-mode";
import type { BookingHandoff, IntegrationResult, RailJourney } from "./types";

export async function buildRailBookingHandoff(args: {
  outbound: RailJourney;
  return?: RailJourney;
}): Promise<IntegrationResult<BookingHandoff>> {
  if (features.railBookingEmbedded || features.railBookingDeepLink) {
    return { mode: "unavailable", reason: "Rail booking partner not yet connected" };
  }
  if (await isDemoModeActive()) {
    return {
      mode: "demo",
      demo: true,
      data: {
        outbound: args.outbound,
        return: args.return,
        partnerDeepLink: "https://example-rail-partner.invalid/demo",
        embeddable: false,
      },
    };
  }
  return {
    mode: "unavailable",
    reason: "Rail booking partner not connected.",
  };
}

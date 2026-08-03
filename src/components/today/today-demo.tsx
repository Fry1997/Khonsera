import { redirect } from "next/navigation";
import { isDemoModeActive } from "@/lib/demo-mode";
import { getLocalWeather } from "@/lib/actions/weather";
import { TodayDemoV2Client } from "@/components/today/today-demo-v2-client";

// The Settings switch is the single authority for the staff demo. TodayPage
// still accepts an older staff preview URL for backwards compatibility, but
// this server gate prevents that URL from showing scenario data while the
// switch is off.
export async function TodayDemo() {
  if (!(await isDemoModeActive())) redirect("/today");

  // The scenario itinerary remains isolated, while the normal Today header can
  // still show the user's ordinary local weather just as the real screen does.
  const weather = await getLocalWeather().catch(() => null);
  const buildId = (
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.VERCEL_DEPLOYMENT_ID ??
    process.env.NEXT_PUBLIC_APP_VERSION ??
    "local"
  ).slice(0, 7);

  return <TodayDemoV2Client weather={weather} buildId={buildId} />;
}

import { redirect } from "next/navigation";
import { isDemoModeActive } from "@/lib/demo-mode";
import { getLocalWeather } from "@/lib/actions/weather";
import { TodayDemoClient } from "@/components/today/today-demo-client";

// The Settings switch is the single authority for the staff demo. TodayPage
// still accepts an older staff preview URL for backwards compatibility, but
// this server gate prevents that URL from showing scenario data while the
// switch is off.
export async function TodayDemo() {
  if (!(await isDemoModeActive())) redirect("/today");

  // The scenario itinerary remains isolated, while the normal Today header can
  // still show the user's ordinary local weather just as the real screen does.
  const weather = await getLocalWeather().catch(() => null);

  return <TodayDemoClient weather={weather} />;
}

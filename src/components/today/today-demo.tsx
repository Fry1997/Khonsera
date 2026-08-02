import { redirect } from "next/navigation";
import { isDemoModeActive } from "@/lib/demo-mode";
import { TodayDemoClient } from "@/components/today/today-demo-client";

// The Settings switch is the single authority for the staff demo. TodayPage
// still accepts an older staff preview URL for backwards compatibility, but
// this server gate prevents that URL from showing scenario data while the
// switch is off.
export async function TodayDemo() {
  if (!(await isDemoModeActive())) redirect("/today");
  return <TodayDemoClient />;
}

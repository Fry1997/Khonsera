import { redirect } from "next/navigation";
import { requireUserContext } from "@/lib/auth";
import { isWelcomed } from "@/lib/welcome";
import { WelcomeScreen } from "@/components/welcome/welcome-screen";
import { loadOnboardingChecklistState } from "@/lib/onboarding";

// First-run (§3). Chromeless — deliberately outside the (app) shell so the first
// minute is just Khonsera, no navigation furniture. If already welcomed, skip.
export default async function WelcomePage() {
  const ctx = await requireUserContext();
  if (await isWelcomed()) redirect("/today");
  const checklist = await loadOnboardingChecklistState();
  return <WelcomeScreen mode={ctx.activeMode} checklist={checklist} />;
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setDemoMode } from "@/lib/demo-mode";

export async function toggleDemoMode(formData: FormData) {
  const target = String(formData.get("next") ?? "off") === "on";
  await setDemoMode(target);

  // The switch controls which data source Today projects. Revalidate both
  // surfaces, then send the staff user to a clean /today URL so an old preview
  // query string can never keep the demo visible after the switch is turned off.
  revalidatePath("/today");
  revalidatePath("/settings");
  redirect("/today");
}

"use server";

import { revalidatePath } from "next/cache";
import { setDemoMode } from "@/lib/demo-mode";

export async function toggleDemoMode(formData: FormData) {
  const target = String(formData.get("next") ?? "off") === "on";
  await setDemoMode(target);
  revalidatePath("/", "layout");
}

"use server";

import { revalidatePath } from "next/cache";
import { setActiveMode, type AppMode } from "@/lib/mode";

// Switch the active Work/Personal mode and re-render everything mode-scoped.
export async function switchMode(mode: AppMode) {
  await setActiveMode(mode === "work" ? "work" : "personal");
  revalidatePath("/", "layout");
}

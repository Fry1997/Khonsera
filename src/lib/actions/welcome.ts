"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import { markWelcomed } from "@/lib/welcome";

// Every terminal choice on the welcome screen marks first-run complete, then
// routes onward. Keeps the honest fork (§3) from ever re-appearing once answered.
export async function chooseAndContinue(target: string) {
  await markWelcomed();
  redirect(target as Route);
}

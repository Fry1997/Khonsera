// Demo mode is a staff-only selector for an isolated Today scenario.
//
// It does not replace, seed or mutate the signed-in user's itinerary. The
// cookie only decides which data source the Today route projects: production
// account data when off, fixed scenario data when on. Both paths render through
// the same production components.

import { cookies } from "next/headers";
import { requireUserContext } from "@/lib/auth";

const COOKIE = "journies_demo_mode";

export async function isDemoModeActive(): Promise<boolean> {
  const ctx = await requireUserContext();
  if (!ctx.isStaff) return false;

  const store = await cookies();
  return store.get(COOKIE)?.value === "on";
}

export async function setDemoMode(on: boolean) {
  const ctx = await requireUserContext();
  if (!ctx.isStaff) {
    throw new Error("Demo mode is staff-only");
  }

  const store = await cookies();
  if (on) {
    store.set(COOKIE, "on", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  } else {
    store.delete(COOKIE);
  }
}

// Demo mode is a per-session toggle available ONLY to staff users.
// When demo mode is on, integration stubs return realistic mock data so the
// full flow can be clicked through end-to-end without real API keys. Real
// users never see demo data — they always go through the real (or honestly
// unbuilt) flows. The flag is read from a signed cookie, but acceptance is
// gated by profiles.is_staff server-side.

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
    store.set(COOKIE, "on", { httpOnly: true, sameSite: "lax", path: "/" });
  } else {
    store.delete(COOKIE);
  }
}

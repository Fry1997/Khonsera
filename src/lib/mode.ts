// Active Work/Personal mode — the §2 spine made operational. Persisted in a
// cookie so it survives refresh/navigation (handover hard requirement). The
// privacy boundary itself is enforced in the data layer (RLS, migration 0030);
// this is just which mode the user is currently looking at.

import { cookies } from "next/headers";

export type AppMode = "work" | "personal";

const COOKIE = "khonsera_mode";

export async function getActiveMode(): Promise<AppMode> {
  const store = await cookies();
  return store.get(COOKIE)?.value === "work" ? "work" : "personal";
}

export async function setActiveMode(mode: AppMode) {
  const store = await cookies();
  store.set(COOKIE, mode, { sameSite: "lax", path: "/" });
}

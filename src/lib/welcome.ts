// First-run flag. Once the user has met Khonsera (or chosen "find me later"),
// we don't show the welcome again. Cookie-based — the simplest thing that
// survives refresh; a profile column can supersede it later if cross-device
// first-run matters.

import { cookies } from "next/headers";

const COOKIE = "khonsera_welcomed";

export async function isWelcomed(): Promise<boolean> {
  const store = await cookies();
  return store.get(COOKIE)?.value === "1";
}

export async function markWelcomed() {
  const store = await cookies();
  store.set(COOKIE, "1", { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

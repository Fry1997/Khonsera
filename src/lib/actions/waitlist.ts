"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { WAITLIST_COOKIE, type WaitlistResult } from "@/lib/waitlist-shared";

// Landing+waitlist brief §4/§6 — the one conversion moment. A logged-out
// visitor (anon role) inserts their email into `waitlist`. No account, no
// identity. The cookie remembers them so a return visit shows the joined
// state without a read (the list is not API-readable — RLS, migration 0033).

// Deliberately permissive — we validate shape, not deliverability. A real
// "are you human" pass is the honeypot, not a regex.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function joinWaitlist(formData: FormData): Promise<WaitlistResult> {
  // Honeypot (brief §6): a hidden field bots fill and humans never see. Treat
  // it as success so the bot learns nothing, but write nothing.
  const trap = String(formData.get("company") ?? "").trim();
  if (trap) return { status: "joined" };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim() || null;
  const source = String(formData.get("source") ?? "").trim() || null;

  if (!email) {
    return { status: "invalid", message: "Enter your email to join." };
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { status: "invalid", message: "That email doesn't look right." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("waitlist")
    .insert({ email, name, source });

  if (error) {
    // 23505 = unique violation → already on the list. Graceful, not an error
    // to the visitor (brief §6: "handle already-on-list gracefully").
    if (error.code === "23505") {
      await setJoinedCookie();
      return { status: "already" };
    }
    return {
      status: "invalid",
      message: "Something went wrong joining the list. Please try again.",
    };
  }

  await setJoinedCookie();
  return { status: "joined" };
}

async function setJoinedCookie() {
  const jar = await cookies();
  jar.set(WAITLIST_COOKIE, "joined", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // a year
    sameSite: "lax",
  });
}

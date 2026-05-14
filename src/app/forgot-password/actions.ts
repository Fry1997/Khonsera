"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect(`/forgot-password?error=${encodeURIComponent("Email is required")}`);
  }

  // Build the redirect URL the magic-link will bounce through. Prefer the
  // configured NEXT_PUBLIC_APP_URL (set on Vercel) so the email link lands
  // on the deployed app, falling back to the request origin for local dev.
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    (await headers()).get("origin") ??
    "http://localhost:3000";
  const redirectTo = `${origin}/auth/callback?next=/reset-password`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  // Best practice: don't reveal whether the email is registered. Always
  // claim success.
  if (error) {
    // Log on the server but still show success to the user.
    console.error("resetPasswordForEmail failed", error);
  }
  redirect("/forgot-password?sent=1");
}

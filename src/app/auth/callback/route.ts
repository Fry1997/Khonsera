import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Exchanges the recovery/auth code Supabase appends to the magic link for a
// real session, then forwards to ?next=... (default /dashboard).
//
// If anything goes wrong the user gets bounced somewhere meaningful with a
// readable ?error= rather than landing at /login wondering why. The most
// common failures here are:
//   * Supabase's "Redirect URLs" allow-list doesn't include this app, so
//     Supabase replaces our redirect with its Site URL and we never see a
//     code at all
//   * The code expired or was already exchanged (e.g. user clicked twice)

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const supabaseError = searchParams.get("error_description") ?? searchParams.get("error");

  if (supabaseError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(`Auth provider: ${supabaseError}`)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        "No auth code in callback. Check that this app's URL is in Supabase Auth → URL Configuration → Redirect URLs.",
      )}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("exchangeCodeForSession failed", { code: code.slice(0, 8), error });
    // If this was a password-reset flow, send them back to /forgot-password
    // with the error so they can retry. Otherwise /login.
    const isReset = next.startsWith("/reset-password");
    const target = isReset ? "/forgot-password" : "/login";
    return NextResponse.redirect(
      `${origin}${target}?error=${encodeURIComponent(
        `Couldn't exchange reset link: ${error.message}. The link may have expired or already been used.`,
      )}`,
    );
  }
  return NextResponse.redirect(`${origin}${next}`);
}

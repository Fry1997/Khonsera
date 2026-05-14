// Handles the redirect back from Google. Verifies state, exchanges the code
// for tokens, fetches the user's email, persists to calendar_connections,
// redirects back to /settings with success.

import { NextResponse, type NextRequest } from "next/server";
import { requireUserContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { exchangeAuthCode, fetchUserInfo } from "@/lib/google/oauth";
import { buildRedirectUri } from "@/lib/google/config";

export async function GET(request: NextRequest) {
  const ctx = await requireUserContext();
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const cookieState = request.cookies.get("google_oauth_state")?.value;

  // Always clear the state cookie on the way out.
  const back = (errorMessage?: string) => {
    const target = errorMessage
      ? new URL(`/settings?error=${encodeURIComponent(errorMessage)}`, url)
      : new URL("/settings?connected=google", url);
    const r = NextResponse.redirect(target);
    r.cookies.set("google_oauth_state", "", { maxAge: 0, path: "/" });
    return r;
  };

  if (errorParam) {
    return back(`Google denied: ${errorParam}`);
  }
  if (!code || !state) {
    return back("Missing code or state from Google callback");
  }
  if (!cookieState || cookieState !== state) {
    return back("OAuth state mismatch (possible CSRF). Try connecting again.");
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`;
  const redirectUri = buildRedirectUri(origin);

  let tokens;
  let email: string | null = null;
  try {
    tokens = await exchangeAuthCode({ code, redirectUri });
    if (tokens.accessToken) {
      try {
        email = (await fetchUserInfo(tokens.accessToken)).email;
      } catch {
        email = null;
      }
    }
  } catch (e) {
    console.error("google callback exchange failed", e);
    return back("Token exchange failed. Check the redirect URI in Google Cloud matches this app.");
  }

  const supabase = await createClient();

  // Upsert: one calendar_connection per (user, workspace, provider). Re-auth
  // replaces an existing row. Use a service-role insert via RPC if needed, but
  // direct upsert under RLS is fine because the user owns these rows.
  const { data: existing } = await supabase
    .from("calendar_connections")
    .select("id, refresh_token")
    .eq("user_id", ctx.userId)
    .eq("workspace_id", ctx.workspaceId)
    .eq("provider", "google")
    .maybeSingle();

  const payload = {
    user_id: ctx.userId,
    workspace_id: ctx.workspaceId,
    provider: "google" as const,
    provider_account_email: email,
    access_token: tokens.accessToken,
    // Google only returns a refresh_token on the FIRST consent. Preserve any
    // existing one if Google didn't issue a new one this round.
    refresh_token: tokens.refreshToken ?? existing?.refresh_token ?? null,
    expires_at: tokens.expiresAt.toISOString(),
    status: "active",
  };

  const { error } = existing
    ? await supabase.from("calendar_connections").update(payload).eq("id", existing.id)
    : await supabase.from("calendar_connections").insert(payload);
  if (error) {
    console.error("calendar_connections write failed", error);
    return back(`Couldn't store connection: ${error.message}`);
  }

  return back();
}

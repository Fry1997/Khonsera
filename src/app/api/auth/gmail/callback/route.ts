// Handles the redirect back from Google for Gmail OAuth.
// Verifies state, exchanges code for tokens, persists to gmail_connections.

import { NextResponse, type NextRequest } from "next/server";
import { requireUserContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { exchangeAuthCode, fetchUserInfo } from "@/lib/google/oauth";
import { buildGmailRedirectUri } from "@/lib/google/gmail-config";

export async function GET(request: NextRequest) {
  const ctx = await requireUserContext();
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const cookieState = request.cookies.get("gmail_oauth_state")?.value;

  const back = (errorMessage?: string) => {
    const target = errorMessage
      ? new URL(`/settings?error=${encodeURIComponent(errorMessage)}`, url)
      : new URL("/settings?connected=gmail", url);
    const r = NextResponse.redirect(target);
    r.cookies.set("gmail_oauth_state", "", { maxAge: 0, path: "/" });
    return r;
  };

  if (errorParam) return back(`Google denied: ${errorParam}`);
  if (!code || !state) return back("Missing code or state from Google callback");
  if (!cookieState || cookieState !== state) {
    return back("OAuth state mismatch (possible CSRF). Try connecting again.");
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`;
  const redirectUri = buildGmailRedirectUri(origin);

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
    console.error("gmail callback exchange failed", e);
    return back(
      "Token exchange failed. Check the redirect URI in Google Cloud matches this app.",
    );
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("gmail_connections")
    .select("id, refresh_token")
    .eq("user_id", ctx.userId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  const payload = {
    user_id: ctx.userId,
    workspace_id: ctx.workspaceId,
    provider_account_email: email,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken ?? existing?.refresh_token ?? null,
    expires_at: tokens.expiresAt.toISOString(),
    status: "active",
  };

  const { error } = existing
    ? await supabase.from("gmail_connections").update(payload).eq("id", existing.id)
    : await supabase.from("gmail_connections").insert(payload);
  if (error) {
    console.error("gmail_connections write failed", error);
    return back(`Couldn't store connection: ${error.message}`);
  }

  return back();
}

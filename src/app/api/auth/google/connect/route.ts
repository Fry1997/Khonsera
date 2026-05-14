// Initiates the Google OAuth flow. Generates a CSRF state token, stores it
// in an HttpOnly cookie, and redirects to Google's consent screen.

import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { buildGoogleAuthUrl } from "@/lib/google/oauth";
import { buildRedirectUri, googleCredentials } from "@/lib/google/config";

export async function GET(request: NextRequest) {
  // Require an authenticated session — only signed-in users can grant
  // Google access to their workspace.
  await requireUser();

  if (!googleCredentials()) {
    return NextResponse.redirect(
      new URL(
        `/settings?error=${encodeURIComponent(
          "Google OAuth not configured on this deployment. Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET.",
        )}`,
        request.nextUrl,
      ),
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  const redirectUri = buildRedirectUri(origin);

  // 16 random bytes hex → 32-char state. Stored signed + httpOnly so callback
  // verifies it round-tripped through Google unchanged.
  const state = crypto.randomUUID().replace(/-/g, "");

  const authUrl = buildGoogleAuthUrl({ redirectUri, state });
  if (!authUrl) {
    return NextResponse.redirect(
      new URL("/settings?error=Google%20OAuth%20unavailable", request.nextUrl),
    );
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600, // 10 minutes
  });
  return response;
}

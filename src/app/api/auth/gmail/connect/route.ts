// Initiates the Gmail OAuth flow. Same pattern as calendar connect, but
// requests gmail.readonly scope and redirects to the Gmail callback.

import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { GMAIL_SCOPES, buildGmailRedirectUri } from "@/lib/google/gmail-config";
import {
  GOOGLE_AUTH_ENDPOINT,
  googleCredentials,
} from "@/lib/google/config";

export async function GET(request: NextRequest) {
  await requireUser();

  if (!googleCredentials()) {
    return NextResponse.redirect(
      new URL(
        `/settings?error=${encodeURIComponent(
          "Google OAuth not configured. Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET.",
        )}`,
        request.nextUrl,
      ),
    );
  }

  const creds = googleCredentials()!;
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  const redirectUri = buildGmailRedirectUri(origin);
  const state = crypto.randomUUID().replace(/-/g, "");

  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
    include_granted_scopes: "true",
  });

  const authUrl = `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}

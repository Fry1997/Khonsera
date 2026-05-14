// OAuth 2.0 web-server flow against Google. Plain fetch, no SDK.
//
// Flow:
//   1. /api/auth/google/connect builds the auth URL with a CSRF state cookie
//      and a random nonce, redirects the user to Google
//   2. Google bounces back to /api/auth/google/callback?code=...&state=...
//   3. We verify state, POST code to the token endpoint, get
//      { access_token, refresh_token, expires_in, id_token }
//   4. Store in calendar_connections; refresh later via refreshAccessToken()

import {
  GOOGLE_AUTH_ENDPOINT,
  GOOGLE_TOKEN_ENDPOINT,
  GOOGLE_USERINFO_ENDPOINT,
  GOOGLE_SCOPES,
  googleCredentials,
} from "./config";

export function buildGoogleAuthUrl(args: {
  redirectUri: string;
  state: string;
  loginHint?: string;
}): string | null {
  const creds = googleCredentials();
  if (!creds) return null;
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: args.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    // Request a refresh_token; "consent" forces the consent screen so a
    // refresh_token is reliably returned even on re-authorisation.
    access_type: "offline",
    prompt: "consent",
    state: args.state,
    include_granted_scopes: "true",
  });
  if (args.loginHint) params.set("login_hint", args.loginHint);
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export type GoogleTokens = {
  accessToken: string;
  refreshToken: string | null; // null on refresh-after-first-grant
  expiresAt: Date;
  idToken?: string;
};

export async function exchangeAuthCode(args: {
  code: string;
  redirectUri: string;
}): Promise<GoogleTokens> {
  const creds = googleCredentials();
  if (!creds) throw new Error("Google OAuth not configured");

  const body = new URLSearchParams({
    code: args.code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: args.redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    id_token?: string;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + (data.expires_in - 30) * 1000),
    idToken: data.id_token,
  };
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<GoogleTokens> {
  const creds = googleCredentials();
  if (!creds) throw new Error("Google OAuth not configured");

  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    id_token?: string;
  };
  return {
    accessToken: data.access_token,
    refreshToken: null, // Google doesn't roll the refresh token here
    expiresAt: new Date(Date.now() + (data.expires_in - 30) * 1000),
    idToken: data.id_token,
  };
}

export async function fetchUserInfo(accessToken: string): Promise<{ email: string }> {
  const res = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Google userinfo failed");
  const data = (await res.json()) as { email: string };
  return { email: data.email };
}

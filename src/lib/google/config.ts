// Google OAuth + Calendar API config. Single place that decides what scopes
// we request, what env vars we read, and how the redirect URI is built.
//
// Required env vars:
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
// Optional:
//   GOOGLE_OAUTH_REDIRECT_URL — explicit override; otherwise computed from
//     NEXT_PUBLIC_APP_URL / request origin.

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

export const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export function googleCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function buildRedirectUri(origin: string): string {
  const explicit = process.env.GOOGLE_OAUTH_REDIRECT_URL;
  if (explicit) return explicit;
  return `${origin}/api/auth/google/callback`;
}

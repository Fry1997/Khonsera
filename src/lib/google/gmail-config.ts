// Gmail OAuth scopes. Reuses the same Google Cloud OAuth client as Calendar
// (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) but requests gmail.readonly.

export const GMAIL_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

export function buildGmailRedirectUri(origin: string): string {
  const explicit = process.env.GOOGLE_GMAIL_REDIRECT_URL;
  if (explicit) return explicit;
  return `${origin}/api/auth/gmail/callback`;
}

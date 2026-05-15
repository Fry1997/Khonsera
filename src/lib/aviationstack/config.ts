// Aviationstack — accessed via API Layer's relay. They're a hosted reseller
// so the base URL + auth header are theirs, not aviationstack's direct.
//
// Env:
//   AVIATIONSTACK_API_KEY — required; the API Layer key from your dashboard
//   AVIATIONSTACK_BASE_URL — optional override; defaults to API Layer
//
// Free tiers vary, but typical free is 100 calls/month. We don't poll: each
// page render makes at most one call, and we cache the result for 60s.

export const AVIATIONSTACK_DEFAULT_BASE = "https://api.apilayer.com/aviationstack/v1";

export function aviationstackConfig(): {
  apiKey: string;
  baseUrl: string;
} | null {
  const apiKey = process.env.AVIATIONSTACK_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: process.env.AVIATIONSTACK_BASE_URL ?? AVIATIONSTACK_DEFAULT_BASE,
  };
}

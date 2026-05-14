// Fetches a valid Google access token for the current user, refreshing it
// from the stored refresh_token when expired. Called from every Calendar API
// helper. Returns null if the user hasn't connected Google (caller falls
// back to demo/unavailable).

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { refreshAccessToken } from "./oauth";

export type CalendarConnection = {
  id: string;
  user_id: string;
  workspace_id: string;
  provider: "google" | "microsoft";
  provider_account_email: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
};

export async function getGoogleConnection(): Promise<CalendarConnection | null> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("calendar_connections")
    .select(
      "id, user_id, workspace_id, provider, provider_account_email, access_token, refresh_token, expires_at",
    )
    .eq("user_id", ctx.userId)
    .eq("workspace_id", ctx.workspaceId)
    .eq("provider", "google")
    .eq("status", "active")
    .maybeSingle();
  return (data as CalendarConnection | null) ?? null;
}

export async function getValidGoogleAccessToken(): Promise<{
  accessToken: string;
  email: string | null;
} | null> {
  const conn = await getGoogleConnection();
  if (!conn) return null;

  const now = Date.now();
  const expiresAt = conn.expires_at ? Date.parse(conn.expires_at) : 0;
  // 60s of headroom — if we're within a minute of expiry refresh proactively.
  if (expiresAt > now + 60_000) {
    return {
      accessToken: conn.access_token,
      email: conn.provider_account_email,
    };
  }

  if (!conn.refresh_token) {
    console.warn("google: token expired and no refresh_token; user must reconnect");
    return null;
  }

  try {
    const refreshed = await refreshAccessToken(conn.refresh_token);
    const supabase = await createClient();
    await supabase
      .from("calendar_connections")
      .update({
        access_token: refreshed.accessToken,
        expires_at: refreshed.expiresAt.toISOString(),
      })
      .eq("id", conn.id);
    return {
      accessToken: refreshed.accessToken,
      email: conn.provider_account_email,
    };
  } catch (e) {
    console.error("google: refresh failed", e);
    return null;
  }
}

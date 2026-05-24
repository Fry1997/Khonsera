// Token management for Gmail connections. Mirrors the Calendar client
// pattern — fetches the stored token, refreshes proactively if near expiry.

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { refreshAccessToken } from "./oauth";

export type GmailConnection = {
  id: string;
  user_id: string;
  workspace_id: string;
  provider_account_email: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  last_scan_at: string | null;
};

export async function getGmailConnection(): Promise<GmailConnection | null> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("gmail_connections")
    .select(
      "id, user_id, workspace_id, provider_account_email, access_token, refresh_token, expires_at, last_scan_at",
    )
    .eq("user_id", ctx.userId)
    .eq("workspace_id", ctx.workspaceId)
    .eq("status", "active")
    .maybeSingle();
  return (data as GmailConnection | null) ?? null;
}

export async function getValidGmailAccessToken(): Promise<{
  accessToken: string;
  email: string | null;
  connectionId: string;
} | null> {
  const conn = await getGmailConnection();
  if (!conn) return null;

  const now = Date.now();
  const expiresAt = conn.expires_at ? Date.parse(conn.expires_at) : 0;
  if (expiresAt > now + 60_000) {
    return {
      accessToken: conn.access_token,
      email: conn.provider_account_email,
      connectionId: conn.id,
    };
  }

  if (!conn.refresh_token) {
    console.warn("gmail: token expired and no refresh_token; user must reconnect");
    return null;
  }

  try {
    const refreshed = await refreshAccessToken(conn.refresh_token);
    const supabase = await createClient();
    await supabase
      .from("gmail_connections")
      .update({
        access_token: refreshed.accessToken,
        expires_at: refreshed.expiresAt.toISOString(),
      })
      .eq("id", conn.id);
    return {
      accessToken: refreshed.accessToken,
      email: conn.provider_account_email,
      connectionId: conn.id,
    };
  } catch (e) {
    console.error("gmail: refresh failed", e);
    return null;
  }
}

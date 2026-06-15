"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";

// Sharing (Phase 18). Two tiers, never crossed:
//  • Employer tier — status + ETA for WORK trips (the existing work-itinerary RLS);
//    NEVER live location. There is no action here that puts coordinates in front of
//    a workspace.
//  • Personal tier — live location as a GIFT: opt-in, to a named recipient,
//    time-bounded, revocable. Owner-managed; the recipient sees only the live point
//    via a secret token link (share_position RPC), and only while active.

export type ShareVM = { id: string; token: string; recipient: string | null; expiresAt: string; revoked: boolean; lastAt: string | null };

const createSchema = z.object({
  itineraryId: z.string().uuid().optional(),
  recipient: z.string().trim().max(80).optional(),
  hours: z.number().int().min(1).max(24).default(4), // time-bound: 1–24h
});

export async function createLocationShare(input: z.input<typeof createSchema>): Promise<{ ok: boolean; token?: string; error?: string }> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the share details." };
  const v = parsed.data;
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const expiresAt = new Date(Date.now() + v.hours * 3_600_000).toISOString();
  const { data, error } = await supabase
    .from("location_shares")
    .insert({ user_id: ctx.userId, itinerary_id: v.itineraryId ?? null, recipient_label: v.recipient ?? null, expires_at: expiresAt })
    .select("token")
    .single();
  if (error) return { ok: false, error: error.message };
  if (v.itineraryId) revalidatePath(`/plan/${v.itineraryId}`);
  return { ok: true, token: data.token as string };
}

export async function revokeLocationShare(id: string, itineraryId?: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { error } = await supabase.from("location_shares").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("user_id", ctx.userId);
  if (error) return { ok: false, error: error.message };
  if (itineraryId) revalidatePath(`/plan/${itineraryId}`);
  return { ok: true };
}

// The traveller's device posts its position to its ACTIVE shares (owner-scoped).
// One call updates every live share at once — the recipient pages poll the RPC.
const posSchema = z.object({ lat: z.number(), lng: z.number() });
export async function pushSharePosition(input: z.input<typeof posSchema>): Promise<{ ok: boolean; active: number }> {
  const parsed = posSchema.safeParse(input);
  if (!parsed.success) return { ok: false, active: 0 };
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("location_shares")
    .update({ last_lat: parsed.data.lat, last_lng: parsed.data.lng, last_at: nowIso })
    .eq("user_id", ctx.userId)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .select("id");
  return { ok: true, active: (data ?? []).length };
}

export async function listLocationShares(itineraryId: string): Promise<ShareVM[]> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("location_shares")
    .select("id, token, recipient_label, expires_at, revoked_at, last_at")
    .eq("user_id", ctx.userId)
    .eq("itinerary_id", itineraryId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as { id: string; token: string; recipient_label: string | null; expires_at: string; revoked_at: string | null; last_at: string | null }[])
    .map((s) => ({ id: s.id, token: s.token, recipient: s.recipient_label, expiresAt: s.expires_at, revoked: !!s.revoked_at || new Date(s.expires_at).getTime() < Date.now(), lastAt: s.last_at }));
}

// Recipient view (public) — position only, only while active. Anon-safe RPC.
export type SharePosition = { recipient: string | null; lat: number | null; lng: number | null; at: string | null; active: boolean } | null;
export async function readSharePosition(token: string): Promise<SharePosition> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("share_position", { p_token: token });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { recipient: row.recipient_label ?? null, lat: row.lat ?? null, lng: row.lng ?? null, at: row.at ?? null, active: !!row.active };
}

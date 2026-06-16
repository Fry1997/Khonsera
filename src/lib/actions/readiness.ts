"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import {
  buildDaySummary,
  evaluateReadiness,
  type StopForReadiness,
  type TransitionForReadiness,
} from "@/lib/readiness/engine";
import type { ReadinessItem, ReadinessStatus } from "@/lib/readiness/types";

type StopRow = {
  id: string;
  type: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  location: { latitude: number | null; longitude: number | null } | null;
  customer_site: { latitude: number | null; longitude: number | null } | null;
  transport_hub: { latitude: number | null; longitude: number | null } | null;
};

function coord(s: StopRow): { lat: number | null; lng: number | null } {
  return {
    lat: s.customer_site?.latitude ?? s.location?.latitude ?? s.transport_hub?.latitude ?? null,
    lng: s.customer_site?.longitude ?? s.location?.longitude ?? s.transport_hub?.longitude ?? null,
  };
}

/** Derive the checklist from the day-object and merge the persisted tick/dismiss overlay. */
export async function loadReadiness(itineraryId: string): Promise<ReadinessItem[]> {
  await requireUserContext();
  const supabase = await createClient();

  const { data: itin } = await supabase
    .from("itineraries")
    .select("date_start, date_end")
    .eq("id", itineraryId)
    .maybeSingle();
  if (!itin) return [];

  const [{ data: s }, { data: t }, { data: state }, { data: userItems }] = await Promise.all([
    supabase
      .from("stops")
      .select("id, type, title, start_time, end_time, location:locations(latitude, longitude), customer_site:customer_sites(latitude, longitude), transport_hub:transport_hubs(latitude, longitude)")
      .eq("itinerary_id", itineraryId),
    supabase
      .from("transitions")
      .select("from_stop_id, to_stop_id, mode, is_locked")
      .eq("itinerary_id", itineraryId),
    supabase
      .from("readiness_state")
      .select("item_key, status, snooze_until")
      .eq("itinerary_id", itineraryId),
    supabase
      .from("readiness_items")
      .select("id, label, status")
      .eq("itinerary_id", itineraryId)
      .order("created_at"),
  ]);

  const stops: StopForReadiness[] = ((s ?? []) as unknown as StopRow[]).map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    start_time: row.start_time,
    end_time: row.end_time,
    ...coord(row),
  }));
  const transitions = (t ?? []) as unknown as TransitionForReadiness[];

  const summary = buildDaySummary({
    dateStart: itin.date_start as string,
    dateEnd: itin.date_end as string,
    stops,
    transitions,
  });
  const checks = evaluateReadiness(summary);

  const now = Date.now();
  const byKey = new Map<string, { status: ReadinessStatus; snooze_until: string | null }>();
  for (const r of state ?? []) byKey.set(r.item_key as string, { status: r.status as ReadinessStatus, snooze_until: (r.snooze_until as string | null) ?? null });

  const derived: ReadinessItem[] = checks.map((c) => {
    const saved = byKey.get(c.key);
    let status: ReadinessStatus = saved?.status ?? "open";
    // A snooze that has elapsed re-opens the item.
    if (status === "snoozed" && saved?.snooze_until && new Date(saved.snooze_until).getTime() < now) {
      status = "open";
    }
    return { ...c, status };
  });

  // User-authored items (key prefixed `user:` so setReadinessStatus routes them).
  const authored: ReadinessItem[] = (userItems ?? []).map((u) => ({
    key: `user:${u.id as string}`,
    category: "custom",
    label: u.label as string,
    severity: "info",
    action: { kind: "none" },
    status: (u.status as ReadinessStatus) ?? "open",
  }));

  return [...derived, ...authored];
}

const ITEM_PREFIX = "user:";

// Add a prep item of your own ("remember the charger"). Owner-only.
export async function createReadinessItem(input: {
  itineraryId: string;
  label: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireUserContext();
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Type something to add." };
  const supabase = await createClient();
  const { error } = await supabase.from("readiness_items").insert({
    itinerary_id: input.itineraryId,
    user_id: ctx.userId,
    workspace_id: ctx.workspaceId,
    label,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/plan/${input.itineraryId}`);
  return { ok: true };
}

export async function deleteReadinessItem(
  id: string,
  itineraryId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireUserContext();
  const supabase = await createClient();
  const { error } = await supabase.from("readiness_items").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/plan/${itineraryId}`);
  return { ok: true };
}

export async function setReadinessStatus(
  itineraryId: string,
  itemKey: string,
  status: ReadinessStatus,
): Promise<{ ok: boolean; error?: string }> {
  await requireUserContext();
  const supabase = await createClient();
  // A user-authored item carries its row id in the key — update it directly.
  if (itemKey.startsWith(ITEM_PREFIX)) {
    const id = itemKey.slice(ITEM_PREFIX.length);
    const { error } = await supabase.from("readiness_items").update({ status }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/plan/${itineraryId}`);
    return { ok: true };
  }
  const { error } = await supabase
    .from("readiness_state")
    .upsert(
      { itinerary_id: itineraryId, item_key: itemKey, status },
      { onConflict: "itinerary_id,item_key" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/plan/${itineraryId}`);
  return { ok: true };
}

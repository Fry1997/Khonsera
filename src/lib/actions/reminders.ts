"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";

// Reminders (proposal §4) — a dateless capture ("renew my passport", "see the
// museum someday") is neither an anchor nor a task: it's a Reminder, parked to
// slot into a day later. Stored as `intents` (migration 0027, "held wishes
// without a date anchor, resurfaced periodically"). Read back on the Plan index.

export type Reminder = { id: string; label: string };

export async function loadReminders(): Promise<Reminder[]> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("intents")
    .select("id, label, status, surface_after")
    .eq("user_id", ctx.userId)
    .eq("workspace_id", ctx.workspaceId)
    .in("status", ["open", "snoozed"])
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []).map((r) => ({ id: r.id as string, label: (r.label as string) ?? "Reminder" }));
}

// Dismiss a reminder once it's dealt with (or slotted into a day).
export async function dismissReminder(id: string): Promise<{ ok: boolean }> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  await supabase
    .from("intents")
    .update({ status: "fulfilled" })
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .eq("workspace_id", ctx.workspaceId);
  revalidatePath("/plan");
  return { ok: true };
}

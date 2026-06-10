"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";

// Events (proposal §1) — an Event is one `itineraries` row: a single day or a
// multi-day trip, hinged on date_start, spanning to date_end (default single-day
// until a bounding fact extends it, §5). No migration — Events ARE itineraries.
//
// This is the create door for the Plan index: a new Event needs a start date
// (the hinge) and an optional name (Khonsera auto-names from the first place
// later if blank). It opens straight into the Event detail.

export async function createEvent(input: {
  dateStart: string; // YYYY-MM-DD — the hinge / lock
  name?: string | null;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const date = (input.dateStart ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Pick a start date." };
  }
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("itineraries")
    .insert({
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
      mode: ctx.activeMode,
      title: input.name?.trim() || null,
      date_start: date,
      date_end: date, // single-day until a bounding fact extends it (§5)
      status: "planning",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "Couldn't start that. Please try again." };
  }
  return { ok: true, id: data.id as string };
}

// Convenience for a form action: create then navigate into the Event.
export async function createEventAndOpen(formData: FormData): Promise<void> {
  const res = await createEvent({
    dateStart: String(formData.get("dateStart") ?? ""),
    name: String(formData.get("name") ?? ""),
  });
  if (res.ok && res.id) redirect(`/plan/${res.id}` as Route);
  redirect("/plan" as Route);
}

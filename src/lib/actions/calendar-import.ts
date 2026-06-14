"use server";

import { requireUserContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listEvents } from "@/lib/integrations/calendar";
import { addManualAnchor } from "@/lib/actions/plan-edit";

// Capture method 3 (Edition III C1): calendar structured-field pull. We read the
// structured fields (time, title, location) and surface them as CONFIRMABLE
// proposals — nothing auto-inserts (infer-never-manufacture). The user picks
// which land as appointments; the messy location string is geocoded by
// addManualAnchor's address path (no parsing of free text into a fact).

export type CalendarProposal = {
  id: string;
  title: string;
  startIso: string;
  endIso: string;
  location: string | null;
};

export async function loadCalendarProposals(
  itineraryId: string,
): Promise<{ ok: boolean; proposals?: CalendarProposal[]; error?: string }> {
  await requireUserContext();
  const supabase = await createClient();
  const { data: itin } = await supabase
    .from("itineraries")
    .select("date_start, date_end")
    .eq("id", itineraryId)
    .maybeSingle();
  if (!itin) return { ok: false, error: "Day not found." };

  const start = new Date(`${itin.date_start as string}T00:00:00`);
  const end = new Date(`${itin.date_end as string}T23:59:59`);
  const res = await listEvents({ start, end });
  if (res.mode === "unavailable") {
    return { ok: false, error: res.reason ?? "Calendar not connected." };
  }
  const proposals: CalendarProposal[] = (res.data ?? []).map((e) => ({
    id: e.id,
    title: e.summary ?? "Untitled event",
    startIso: e.start.toISOString(),
    endIso: e.end.toISOString(),
    location: e.location ?? null,
  }));
  return { ok: true, proposals };
}

export async function importCalendarEvents(
  itineraryId: string,
  events: CalendarProposal[],
): Promise<{ ok: boolean; added: number; error?: string }> {
  await requireUserContext();
  let added = 0;
  for (const e of events) {
    const r = await addManualAnchor({
      itineraryId,
      kind: "appointment",
      title: e.title,
      iso: e.startIso,
      leaveIso: e.endIso,
      address: e.location ?? undefined,
    });
    if (r.ok) added += 1;
  }
  return { ok: true, added };
}

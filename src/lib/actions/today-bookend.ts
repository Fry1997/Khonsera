"use server";

import type { SpineAnchor } from "@/components/today/spine-model";
import { requireUserContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadBookendLegs } from "@/lib/actions/bookend-legs";

export async function loadEndContextForStop(stopId: string): Promise<SpineAnchor | null> {
  await requireUserContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stops")
    .select("itinerary_id")
    .eq("id", stopId)
    .maybeSingle();
  if (error || !data?.itinerary_id) return null;
  const bookends = await loadBookendLegs(data.itinerary_id as string);
  return bookends.endContext;
}

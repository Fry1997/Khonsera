"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { ok, type Result } from "@/lib/errors";
import { rankByProximity } from "@/lib/geo";

// A saved place the capture screen can bind an event slot to. Mirrors the
// shape the slot editor's place-picker emits (location vs customer_site).
export type PlaceHit = {
  kind: "location" | "customer_site";
  id: string;
  customer_id?: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  // Present only when the search was given a `near` anchor.
  distance_m?: number;
};

const schema = z.object({
  query: z.string().trim().max(120),
  near: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

// Workspace-scoped search over saved locations + customer sites. Name prefix
// first, then substring (mirrors searchContacts). When `near` is set, results
// are sorted nearest-first with `distance_m` attached. Unknown venues are not
// invented here — they stay verbatim until the user saves them as a place.
export async function searchPlaces(
  input: z.input<typeof schema>,
): Promise<Result<PlaceHit[]>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return ok([]);
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const q = parsed.data.query;
  const near = parsed.data.near;

  const fetchLocations = async (substring: boolean) => {
    let query = supabase
      .from("locations")
      .select("id, name, latitude, longitude")
      .eq("workspace_id", ctx.workspaceId)
      .order("name")
      .limit(8);
    if (q.length > 0) query = query.ilike("name", substring ? `%${q}%` : `${q}%`);
    const { data } = await query;
    return (data ?? []).map(
      (r): PlaceHit => ({ kind: "location", id: r.id, name: r.name, latitude: r.latitude, longitude: r.longitude }),
    );
  };

  const fetchSites = async (substring: boolean) => {
    let query = supabase
      .from("customer_sites")
      .select("id, customer_id, name, latitude, longitude")
      .eq("workspace_id", ctx.workspaceId)
      .order("name")
      .limit(8);
    if (q.length > 0) query = query.ilike("name", substring ? `%${q}%` : `${q}%`);
    const { data } = await query;
    return (data ?? [])
      .filter((r) => r.name)
      .map(
        (r): PlaceHit => ({
          kind: "customer_site",
          id: r.id,
          customer_id: r.customer_id,
          name: r.name as string,
          latitude: r.latitude,
          longitude: r.longitude,
        }),
      );
  };

  let hits = [...(await fetchLocations(false)), ...(await fetchSites(false))];

  // Substring fallback when the prefix search is thin.
  if (q.length >= 2 && hits.length < 3) {
    const seen = new Set(hits.map((h) => `${h.kind}:${h.id}`));
    for (const row of [...(await fetchLocations(true)), ...(await fetchSites(true))]) {
      if (!seen.has(`${row.kind}:${row.id}`)) hits.push(row);
    }
  }

  if (near) hits = rankByProximity(hits, near);
  return ok(hits.slice(0, 8));
}

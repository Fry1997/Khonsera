import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getPlanningViewData } from "./planning-data";
import { PlanningView } from "./planning-view";

export default async function ItineraryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: itinerary } = await supabase
    .from("itineraries")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!itinerary) notFound();

  // Auto-seed the first "start" point from the user's travel profile defaults
  // (drive origin → rail origin → return location). Only fires when the
  // itinerary has zero stops, so it's idempotent on refresh.
  const { count: stopCount } = await supabase
    .from("stops")
    .select("id", { count: "exact", head: true })
    .eq("itinerary_id", id);
  if (stopCount === 0) {
    const { data: profile } = await supabase
      .from("travel_profiles")
      .select(
        "default_drive_origin_location_id, default_rail_origin_location_id, default_return_location_id",
      )
      .eq("user_id", ctx.userId)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();
    const homeId =
      profile?.default_drive_origin_location_id ??
      profile?.default_rail_origin_location_id ??
      profile?.default_return_location_id ??
      null;
    if (homeId) {
      await supabase.from("stops").insert({
        itinerary_id: id,
        workspace_id: ctx.workspaceId,
        sequence: 0,
        type: "start",
        location_id: homeId,
        is_time_fixed: false,
      });
    }
  }

  const data = await getPlanningViewData(id);
  if (!data) notFound();

  return <PlanningView data={data} />;
}

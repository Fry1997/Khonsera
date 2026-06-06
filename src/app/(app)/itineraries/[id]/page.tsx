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

  // Compose the view model and load the "+" add-sheet picker data in parallel —
  // they're independent, so there's no reason to serialise them on load.
  const [
    data,
    [
      { data: customers },
      { data: customerSites },
      { data: locations },
      { data: contacts },
      { data: gmailConn },
    ],
  ] = await Promise.all([
    getPlanningViewData(id),
    Promise.all([
    supabase
      .from("customers")
      .select("id, name")
      .eq("workspace_id", ctx.workspaceId)
      .order("name"),
    supabase
      .from("customer_sites")
      .select("id, customer_id, name, address")
      .eq("workspace_id", ctx.workspaceId),
    supabase
      .from("locations")
      .select("id, name, type, address")
      .eq("workspace_id", ctx.workspaceId)
      .order("type")
      .order("name"),
    supabase
      .from("contacts")
      .select("id, customer_id, name")
      .eq("workspace_id", ctx.workspaceId),
    supabase
      .from("gmail_connections")
      .select("id")
      .eq("user_id", ctx.userId)
      .eq("workspace_id", ctx.workspaceId)
      .eq("status", "active")
      .maybeSingle(),
    ]),
  ]);

  if (!data) notFound();

  return (
    <PlanningView
      data={data}
      pickers={{
        customers: customers ?? [],
        customerSites: customerSites ?? [],
        locations: (locations ?? []) as never,
        contacts: (contacts ?? []).filter(
          (c): c is { id: string; customer_id: string; name: string } =>
            c.customer_id != null,
        ),
        gmailConnected: !!gmailConn,
      }}
    />
  );
}

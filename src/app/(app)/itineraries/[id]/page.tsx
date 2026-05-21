import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { ItineraryEditor } from "./itinerary-editor";

export default async function ItineraryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const wsCfg = await getWorkspaceConfig(ctx.workspaceId);

  const { data: itinerary } = await supabase
    .from("itineraries")
    .select(
      "id, title, date_start, date_end, status, notes, trip_purpose, luggage_for_trip",
    )
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!itinerary) notFound();

  // Travel-profile inputs for the scoring engine — pulled here so
  // the editor can build a ScoringContext per leg.
  const { data: scoringProfile } = await supabase
    .from("travel_profiles")
    .select(
      "preferred_mode, walking_threshold_minutes, minimum_buffer_minutes, max_taxi_fare_pence, luggage_default",
    )
    .eq("user_id", ctx.userId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

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

  const [
    { data: stops },
    { data: transitions },
    { data: customers },
    { data: customerSites },
    { data: locations },
    { data: contacts },
    { data: expenseRows },
  ] = await Promise.all([
    supabase
      .from("stops")
      .select(
        `id, sequence, type, title, start_time, end_time, duration_minutes,
         is_time_fixed, location_id, customer_id, customer_site_id, contact_id,
         external_reference, external_url, metadata, notes,
         location:locations(name, type, address, latitude, longitude),
         customer:customers(name),
         customer_site:customer_sites(name, address, latitude, longitude)`,
      )
      .eq("itinerary_id", id)
      .order("sequence"),
    supabase
      .from("transitions")
      .select(
        "id, from_stop_id, to_stop_id, mode, start_time, end_time, computed_duration_minutes, distance_miles, overview_polyline, is_locked, notes, user_mode_override, override_locked",
      )
      .eq("itinerary_id", id),
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
      .from("expense_records")
      .select("amount, currency")
      .eq("itinerary_id", id),
  ]);

  const transitionIds = (transitions ?? []).map((t) => t.id);
  const { data: journeyLegs } =
    transitionIds.length > 0
      ? await supabase
          .from("journey_legs")
          .select(
            "id, transition_id, sequence, leg_type, start_location_name, end_location_name, start_time, end_time, duration_minutes, distance_miles, service_number, instructions",
          )
          .in("transition_id", transitionIds)
          .order("sequence")
      : { data: [] as never[] };

  // Pre-fetch route_preview_cache rows for every stop in this
  // itinerary so the editor doesn't have to round-trip the
  // previewRoute server action 15+ times on every page load. The
  // client-side hook seeds from these on mount; cache misses still
  // fire previewRoute lazily.
  const stopIds = (stops ?? []).map((s) => s.id);
  const { data: previewCacheRows } =
    stopIds.length > 0
      ? await supabase
          .from("route_preview_cache")
          .select(
            "from_stop_id, to_stop_id, mode, duration_minutes, distance_miles",
          )
          .in("from_stop_id", stopIds)
          .in("to_stop_id", stopIds)
      : {
          data: [] as Array<{
            from_stop_id: string;
            to_stop_id: string;
            mode: string;
            duration_minutes: number | null;
            distance_miles: number | null;
          }>,
        };

  const totalCost = (expenseRows ?? []).reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0,
  );
  const currency =
    (expenseRows?.[0]?.currency as string | undefined) ?? "GBP";

  return (
    <ItineraryEditor
      itinerary={{
        id: itinerary.id,
        title: itinerary.title,
        date_start: itinerary.date_start,
        date_end: itinerary.date_end,
        status: itinerary.status,
        notes: itinerary.notes,
        trip_purpose:
          (itinerary as { trip_purpose?: string }).trip_purpose ?? "balanced",
        luggage_for_trip:
          (itinerary as { luggage_for_trip?: string | null }).luggage_for_trip ??
          null,
      }}
      stops={(stops ?? []) as never}
      transitions={(transitions ?? []) as never}
      journeyLegs={(journeyLegs ?? []) as never}
      customers={customers ?? []}
      customerSites={customerSites ?? []}
      locations={locations ?? []}
      contacts={contacts ?? []}
      timezone={wsCfg.timezone}
      totals={{ cost: totalCost, currency }}
      initialPreviewCache={(previewCacheRows ?? []).map((row) => ({
        fromStopId: row.from_stop_id,
        toStopId: row.to_stop_id,
        mode: row.mode as "walk" | "drive" | "taxi",
        durationMinutes: row.duration_minutes,
        distanceMiles: row.distance_miles,
      }))}
      scoringProfile={{
        preferredMode:
          (scoringProfile?.preferred_mode as
            | "walk"
            | "drive"
            | "taxi"
            | "no_preference"
            | undefined) ?? "no_preference",
        walkingThresholdMinutes:
          scoringProfile?.walking_threshold_minutes ?? 15,
        minimumBufferMinutes: scoringProfile?.minimum_buffer_minutes ?? 10,
        maxTaxiFarePence: scoringProfile?.max_taxi_fare_pence ?? 1500,
        luggageDefault:
          (scoringProfile?.luggage_default as
            | "none"
            | "light"
            | "heavy"
            | undefined) ?? "none",
      }}
    />
  );
}

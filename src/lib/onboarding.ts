import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
export type OnboardingChecklistState = {
  travelProfileBaseSet: boolean;
  calendarConnected: boolean;
  gmailConnected: boolean;
  hasItinerary: boolean;
};

export async function loadOnboardingChecklistState(): Promise<OnboardingChecklistState> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const [{ data: profile }, { data: calendarConn }, { data: gmailConn }, { count: itineraryCount }] = await Promise.all([
    supabase
      .from("travel_profiles")
      .select("default_drive_origin_location_id, default_rail_origin_location_id, default_return_location_id, default_rail_origin_transport_hub_id, default_flight_origin_transport_hub_id")
      .eq("user_id", ctx.userId)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle(),
    supabase
      .from("calendar_connections")
      .select("id")
      .eq("user_id", ctx.userId)
      .eq("workspace_id", ctx.workspaceId)
      .eq("provider", "google")
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("gmail_connections")
      .select("id")
      .eq("user_id", ctx.userId)
      .eq("workspace_id", ctx.workspaceId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("itineraries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId)
      .eq("workspace_id", ctx.workspaceId),
  ]);

  return {
    travelProfileBaseSet: Boolean(
      profile?.default_drive_origin_location_id ||
        profile?.default_rail_origin_location_id ||
        profile?.default_return_location_id ||
        profile?.default_rail_origin_transport_hub_id ||
        profile?.default_flight_origin_transport_hub_id,
    ),
    calendarConnected: Boolean(calendarConn),
    gmailConnected: Boolean(gmailConn),
    hasItinerary: Boolean((itineraryCount ?? 0) > 0),
  };
}

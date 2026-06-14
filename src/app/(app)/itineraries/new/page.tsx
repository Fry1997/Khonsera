import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { NewItineraryBrief } from "./new-itinerary-form";

export default async function NewItineraryPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const wsCfg = await getWorkspaceConfig(ctx.workspaceId);

  const [
    { data: customers },
    { data: customerSites },
    { data: locations },
    { data: profile },
  ] = await Promise.all([
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
      .from("travel_profiles")
      .select(
        "default_drive_origin_location_id, default_rail_origin_location_id, default_return_location_id, default_rail_origin_transport_hub_id, default_flight_origin_transport_hub_id",
      )
      .eq("user_id", ctx.userId)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle(),
  ]);

  const { data: gmailConn } = await supabase
    .from("gmail_connections")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("workspace_id", ctx.workspaceId)
    .eq("status", "active")
    .maybeSingle();

  // Resolve the home label so the brief can show "from Home" (or the
  // actual name) on the implicit first transition.
  const homeId =
    profile?.default_drive_origin_location_id ??
    profile?.default_rail_origin_location_id ??
    profile?.default_return_location_id ??
    null;
  const home =
    homeId != null
      ? (locations ?? []).find((l) => l.id === homeId) ?? null
      : null;

  // Base locations — home/office locations the user can pick as their
  // starting point. Shown in the BaseLocationCard at the top of the brief.
  const baseLocations = (locations ?? [])
    .filter((l): l is typeof l & { type: "home" | "office" } =>
      l.type === "home" || l.type === "office",
    )
    .map((l) => ({ id: l.id, name: l.name, type: l.type, address: l.address }));
  const defaultBaseId = homeId;

  // Surface the user's default rail station / airport so the brief
  // can render a "via {station}" hint inside train / tube / flight
  // transitions. Full station-stop auto-insertion is a follow-up;
  // this is the smaller visual half of Slice E.
  const hubIds = [
    profile?.default_rail_origin_transport_hub_id,
    profile?.default_flight_origin_transport_hub_id,
  ].filter(Boolean) as string[];
  const { data: hubs } =
    hubIds.length > 0
      ? await supabase
          .from("transport_hubs")
          .select("id, name, code, kind")
          .in("id", hubIds)
      : { data: [] as Array<{ id: string; name: string; code: string | null; kind: string }> };
  const railHub =
    hubs?.find(
      (h) => h.id === profile?.default_rail_origin_transport_hub_id,
    ) ?? null;
  const flightHub =
    hubs?.find(
      (h) => h.id === profile?.default_flight_origin_transport_hub_id,
    ) ?? null;
  const railHubLabel = railHub
    ? railHub.code
      ? `${railHub.name} (${railHub.code})`
      : railHub.name
    : null;
  const flightHubLabel = flightHub
    ? flightHub.code
      ? `${flightHub.name} (${flightHub.code})`
      : flightHub.name
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <header>
        <span className="eyebrow" style={{ color: "var(--gold-2)" }}>
          New · Brief
        </span>
        <h1
          className="desk-h1"
          style={{ marginTop: 6, fontSize: "clamp(28px, 4vw, 42px)" }}
        >
          Plan your <em>day.</em>
        </h1>
        <p
          className="serif-i"
          style={{
            fontSize: 16,
            color: "var(--ink-dim)",
            margin: "8px 0 0",
            maxWidth: "62ch",
            lineHeight: 1.55,
          }}
        >
          Add what you already know &mdash; where you&rsquo;re starting,
          what&rsquo;s already booked, when you need to be back &mdash; or
          import it from your inbox, and we&rsquo;ll work out the rest.
        </p>
      </header>

      <NewItineraryBrief
        customers={customers ?? []}
        customerSites={customerSites ?? []}
        locations={locations ?? []}
        timezone={wsCfg.timezone}
        homeLabel={home?.name ?? null}
        railHubLabel={railHubLabel}
        flightHubLabel={flightHubLabel}
        baseLocations={baseLocations}
        defaultBaseId={defaultBaseId}
        gmailConnected={!!gmailConn}
      />
    </div>
  );
}

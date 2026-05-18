import { PageShell } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { LocationsPanel } from "./locations-panel";
import { StaticMap } from "@/components/static-map";
import type { StaticMapMarker } from "@/lib/google/maps";

export default async function LocationsPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, type, address, postcode, latitude, longitude, notes")
    .eq("workspace_id", ctx.workspaceId)
    .order("type")
    .order("name");

  // Each location type gets its own brand-palette pin so the saved-locations
  // map reads as a clear key without needing a legend.
  const TYPE_COLOR: Record<string, StaticMapMarker["color"]> = {
    home: "sage",
    office: "ink",
    station: "rust",
    hotel: "terra",
    parking: "amber",
    other: "ink",
  };
  const markers: StaticMapMarker[] = (locations ?? [])
    .filter((l) => l.latitude != null && l.longitude != null)
    .map((l) => ({
      lat: l.latitude as number,
      lng: l.longitude as number,
      color: TYPE_COLOR[l.type] ?? "red",
    }));

  return (
    <PageShell
      title="Locations"
      description="Home, office, preferred stations and other starting points used when generating travel options."
    >
      {markers.length > 0 ? (
        <StaticMap
          markers={markers}
          width={1200}
          height={320}
          alt="Saved locations"
          style="journies"
        />
      ) : null}
      <LocationsPanel locations={locations ?? []} />
    </PageShell>
  );
}

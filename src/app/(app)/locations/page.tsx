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
      color: TYPE_COLOR[l.type] ?? "ink",
    }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <header>
        <span className="eyebrow" style={{ color: "var(--gold-2)" }}>
          Places · {locations?.length ?? 0}
        </span>
        <h1
          className="desk-h1"
          style={{ marginTop: 6, fontSize: "clamp(28px, 4vw, 38px)" }}
        >
          Locations.
        </h1>
        <p
          className="serif-i"
          style={{
            fontSize: 16,
            color: "var(--ink-dim)",
            margin: "8px 0 0",
            maxWidth: "60ch",
          }}
        >
          Home, office, preferred stations and other anchors — used when
          Khonsera plans your travel options.
        </p>
      </header>

      {markers.length > 0 ? (
        <StaticMap
          markers={markers}
          width={1200}
          height={300}
          alt="Saved locations"
          style="journies"
        />
      ) : null}

      <LocationsPanel locations={locations ?? []} />
    </div>
  );
}

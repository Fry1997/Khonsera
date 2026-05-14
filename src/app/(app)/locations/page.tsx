import { PageShell } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { LocationsPanel } from "./locations-panel";

export default async function LocationsPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, type, address, postcode, notes")
    .eq("workspace_id", ctx.workspaceId)
    .order("type")
    .order("name");

  return (
    <PageShell
      title="Locations"
      description="Home, office, preferred stations and other starting points used when generating travel options."
    >
      <LocationsPanel locations={locations ?? []} />
    </PageShell>
  );
}

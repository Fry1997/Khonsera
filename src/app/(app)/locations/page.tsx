import { PageShell, ComingSoon } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";

export default async function LocationsPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, type, address")
    .eq("workspace_id", ctx.workspaceId)
    .order("type");

  return (
    <PageShell
      title="Locations"
      description="Home, office, preferred stations and any other starting points. Used when generating travel options."
    >
      {locations && locations.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {locations.map((l) => (
            <li key={l.id} className="p-4 text-sm">
              <p className="font-medium">{l.name}</p>
              <p className="text-muted-foreground">
                {l.type} · {l.address ?? "no address"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <ComingSoon
          feature="Locations CRUD"
          detail="Add Home / Office / Preferred station as your starting points. UI lands in Phase 3."
        />
      )}
    </PageShell>
  );
}

import { PageShell } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";

export default async function ItineraryPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data: trips } = await supabase
    .from("saved_trips")
    .select(
      "id, status, visit_plans!inner(id, title, proposed_start_time, customer_id)",
    )
    .eq("workspace_id", ctx.workspaceId)
    .in("status", ["upcoming", "ready", "in_progress"])
    .order("created_at", { ascending: true });

  return (
    <PageShell
      title="My itinerary"
      description="Confirmed visits, what's next and when to leave."
    >
      {trips && trips.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {trips.map((t) => (
            <li key={t.id} className="p-4 text-sm">
              <p className="font-medium">{t.status}</p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No upcoming trips yet.
        </div>
      )}
    </PageShell>
  );
}

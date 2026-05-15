import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ui/page-shell";
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
    .select("id, title, date_start, date_end, status, notes")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!itinerary) notFound();

  const [{ data: stops }, { data: transitions }, { data: customers }, { data: customerSites }, { data: locations }, { data: contacts }] =
    await Promise.all([
      supabase
        .from("stops")
        .select(
          `id, sequence, type, title, start_time, end_time, duration_minutes,
           is_time_fixed, location_id, customer_id, customer_site_id, contact_id,
           external_reference, external_url, metadata, notes,
           location:locations(name, address, latitude, longitude),
           customer:customers(name),
           customer_site:customer_sites(name, address, latitude, longitude)`,
        )
        .eq("itinerary_id", id)
        .order("sequence"),
      supabase
        .from("transitions")
        .select(
          "id, from_stop_id, to_stop_id, mode, start_time, end_time, computed_duration_minutes, distance_miles, overview_polyline, is_locked, notes",
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
    ]);

  return (
    <PageShell
      title={itinerary.title ?? `Itinerary · ${itinerary.date_start}`}
      description={
        itinerary.date_end !== itinerary.date_start
          ? `${itinerary.date_start} → ${itinerary.date_end} · ${itinerary.status}`
          : `${itinerary.date_start} · ${itinerary.status}`
      }
      actions={
        <Link href="/itineraries" className="btn-ghost">
          Back
        </Link>
      }
    >
      <ItineraryEditor
        itinerary={{
          id: itinerary.id,
          title: itinerary.title,
          date_start: itinerary.date_start,
          date_end: itinerary.date_end,
          status: itinerary.status,
          notes: itinerary.notes,
        }}
        stops={(stops ?? []) as never}
        transitions={(transitions ?? []) as never}
        customers={customers ?? []}
        customerSites={customerSites ?? []}
        locations={locations ?? []}
        contacts={contacts ?? []}
        timezone={wsCfg.timezone}
      />
    </PageShell>
  );
}

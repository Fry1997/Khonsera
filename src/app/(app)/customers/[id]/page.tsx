import { notFound } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { CustomerEditForm } from "./customer-edit-form";
import { SitesPanel } from "./sites-panel";
import { ContactsPanel } from "./contacts-panel";
import { DeleteCustomerButton } from "./delete-customer-button";
import { StaticMap } from "@/components/static-map";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, notes, created_at")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!customer) notFound();

  const [{ data: sites }, { data: contacts }] = await Promise.all([
    supabase
      .from("customer_sites")
      .select(
        "id, name, address, postcode, latitude, longitude, parking_notes, nearest_station_notes",
      )
      .eq("customer_id", id)
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at"),
    supabase
      .from("contacts")
      .select("id, name, email, phone, role")
      .eq("customer_id", id)
      .eq("workspace_id", ctx.workspaceId)
      .order("name"),
  ]);

  const siteMarkers = (sites ?? [])
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s, i) => ({
      lat: s.latitude as number,
      lng: s.longitude as number,
      color: "red" as const,
      label: String.fromCharCode(65 + i), // A, B, C…
    }));

  return (
    <PageShell
      title={customer.name}
      description="Customer details, sites and contacts."
      actions={
        <Link href="/customers" className="btn-ghost">
          Back to customers
        </Link>
      }
    >
      {siteMarkers.length > 0 ? (
        <StaticMap markers={siteMarkers} width={1200} height={280} alt={`${customer.name} sites`} />
      ) : null}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-md border border-border p-4">
          <h2 className="mb-3 text-sm font-semibold">Details</h2>
          <CustomerEditForm
            customer={{ id: customer.id, name: customer.name, notes: customer.notes }}
          />
          <div className="mt-4 border-t border-border pt-4">
            <DeleteCustomerButton id={customer.id} name={customer.name} />
          </div>
        </div>
        <div className="rounded-md border border-border p-4">
          <h2 className="mb-3 text-sm font-semibold">Sites ({sites?.length ?? 0})</h2>
          <SitesPanel customerId={id} sites={sites ?? []} />
        </div>
        <div className="rounded-md border border-border p-4 md:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Contacts ({contacts?.length ?? 0})</h2>
          <ContactsPanel customerId={id} contacts={contacts ?? []} />
        </div>
      </section>
    </PageShell>
  );
}

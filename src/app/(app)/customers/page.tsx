import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { formatDateInTz } from "@/lib/types/time";

type CustomerCardData = {
  id: string;
  name: string;
  notes: string | null;
  sites: number;
  contacts: number;
  visits: number;
  lastVisitAt: string | null;
  nextVisitAt: string | null;
};

export default async function CustomersPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const wsCfg = await getWorkspaceConfig(ctx.workspaceId);

  // Pull customers, sites, contacts and visits separately and stitch in code.
  // Each table is small enough that this is simpler than a SQL aggregation
  // view at this stage.
  const [
    { data: customers },
    { data: sites },
    { data: contacts },
    { data: visits },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, notes")
      .eq("workspace_id", ctx.workspaceId)
      .order("name"),
    supabase
      .from("customer_sites")
      .select("id, customer_id")
      .eq("workspace_id", ctx.workspaceId),
    supabase
      .from("contacts")
      .select("id, customer_id")
      .eq("workspace_id", ctx.workspaceId),
    supabase
      .from("stops")
      .select("id, customer_id, start_time, type")
      .eq("workspace_id", ctx.workspaceId)
      .eq("type", "appointment")
      .not("customer_id", "is", null),
  ]);

  const cards: CustomerCardData[] = (customers ?? []).map((c) => {
    const customerAppointments = (visits ?? []).filter(
      (v) => v.customer_id === c.id,
    );
    const now = Date.now();
    const past = customerAppointments
      .filter((v) => v.start_time && Date.parse(v.start_time) <= now)
      .sort((a, b) => b.start_time!.localeCompare(a.start_time!));
    const future = customerAppointments
      .filter((v) => v.start_time && Date.parse(v.start_time) > now)
      .sort((a, b) => a.start_time!.localeCompare(b.start_time!));
    return {
      id: c.id,
      name: c.name,
      notes: c.notes,
      sites: (sites ?? []).filter((s) => s.customer_id === c.id).length,
      contacts: (contacts ?? []).filter((co) => co.customer_id === c.id).length,
      visits: customerAppointments.length,
      lastVisitAt: past[0]?.start_time ?? null,
      nextVisitAt: future[0]?.start_time ?? null,
    };
  });

  return (
    <PageShell
      title="Customers"
      description="Reusable customer and site records — addresses, parking notes, nearest station."
      actions={
        <Link href="/customers/new" className="btn-terra">
          + Add customer
        </Link>
      }
    >
      {cards.length === 0 ? (
        <div className="j-card-soft p-8 text-center">
          <p className="body mb-3">No customers yet.</p>
          <Link href="/customers/new" className="btn-terra">
            Add your first customer
          </Link>
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <CustomerCard key={c.id} card={c} timezone={wsCfg.timezone} />
          ))}
        </section>
      )}
    </PageShell>
  );
}

function CustomerCard({
  card,
  timezone,
}: {
  card: CustomerCardData;
  timezone: string;
}) {
  return (
    <Link
      href={`/customers/${card.id}`}
      className="j-card group flex flex-col gap-3 p-5 transition hover:border-rule-2"
    >
      <div>
        <h3 className="h3 mb-1 group-hover:text-terra">{card.name}</h3>
        {card.notes ? (
          <p className="small line-clamp-2">{card.notes}</p>
        ) : (
          <p className="small text-ink-faint">No notes</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Mini label="Sites" value={card.sites} />
        <Mini label="Contacts" value={card.contacts} />
        <Mini label="Visits" value={card.visits} />
      </div>

      <div className="mt-auto border-t border-rule pt-3 text-xs text-ink-dim">
        {card.nextVisitAt ? (
          <p>
            <span className="uc mr-1">Next</span>
            <span className="mono">
              {formatDateInTz(new Date(card.nextVisitAt), timezone)}
            </span>
          </p>
        ) : card.lastVisitAt ? (
          <p>
            <span className="uc mr-1">Last</span>
            <span className="mono">
              {formatDateInTz(new Date(card.lastVisitAt), timezone)}
            </span>
          </p>
        ) : (
          <p className="text-ink-faint">No visits yet</p>
        )}
      </div>
    </Link>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-rule bg-card-2 px-2 py-1.5">
      <p className="mono text-base font-medium text-ink">{value}</p>
      <p className="tiny">{label}</p>
    </div>
  );
}

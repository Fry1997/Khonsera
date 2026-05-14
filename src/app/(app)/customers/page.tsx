import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";

export default async function CustomersPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, notes")
    .eq("workspace_id", ctx.workspaceId)
    .order("name");

  return (
    <PageShell
      title="Customers"
      description="Reusable customer and site records — addresses, parking notes, nearest station."
      actions={
        <Link
          href="/customers/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Add customer
        </Link>
      }
    >
      {customers && customers.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {customers.map((c) => (
            <li key={c.id} className="flex items-center justify-between p-4">
              <p className="text-sm font-medium">{c.name}</p>
              <Link
                href={`/customers/${c.id}`}
                className="text-sm font-medium underline"
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No customers yet.
        </div>
      )}
    </PageShell>
  );
}

import { PageShell, ComingSoon } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";

export default async function ExpensesPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data: expenses } = await supabase
    .from("expense_records")
    .select("id, type, amount, currency, reimbursement_status, created_at")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <PageShell
      title="Expenses"
      description="Rail tickets, mileage, parking, taxis and receipts captured against each visit."
    >
      {expenses && expenses.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {expenses.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between p-4 text-sm"
            >
              <p>{e.type}</p>
              <p className="text-muted-foreground">
                {e.currency} {e.amount} · {e.reimbursement_status}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <ComingSoon
          feature="Expense capture"
          detail="Receipt upload, mileage calculation and export. Schema is in place; UI lands once visits are creating expense records."
        />
      )}
    </PageShell>
  );
}

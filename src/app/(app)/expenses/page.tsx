import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { formatDateInTz } from "@/lib/types/time";
import { ExpensesRow } from "./expenses-row";

type ExpenseRow = {
  id: string;
  type: string;
  amount: number | null;
  currency: string;
  reimbursement_status: string;
  notes: string | null;
  created_at: string;
  visit_plan: { id: string; title: string | null; customer?: { name?: string } | null } | null;
};

const TYPE_LABEL: Record<string, string> = {
  rail_ticket: "Rail ticket",
  mileage: "Mileage",
  parking: "Parking",
  taxi: "Taxi",
  hotel: "Hotel",
  food: "Food",
  other: "Other",
};

export default async function ExpensesPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const wsCfg = await getWorkspaceConfig(ctx.workspaceId);

  const { data: rawExpenses } = await supabase
    .from("expense_records")
    .select(
      `id, type, amount, currency, reimbursement_status, notes, created_at,
       visit_plan:visit_plans(id, title, customer:customers(name))`,
    )
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false })
    .limit(200);

  const expenses = (rawExpenses ?? []) as unknown as ExpenseRow[];

  const totals = totalsFor(expenses);
  const byMonth = groupByMonth(expenses, wsCfg.timezone);

  return (
    <PageShell
      title="Expenses"
      description="Rail tickets, mileage, parking, taxis and receipts captured against each visit."
    >
      {expenses.length === 0 ? (
        <div className="j-card-soft p-8 text-center">
          <p className="body mb-1">No expenses yet.</p>
          <p className="small">
            Expense rows are created automatically when you confirm a drive
            visit (mileage) or record a rail booking (ticket). You can also
            add parking, taxi or food expenses on a visit.
          </p>
        </div>
      ) : (
        <>
          {/* Totals strip */}
          <section className="j-card grid gap-4 p-5 sm:grid-cols-4">
            <SumTile label="Total" value={fmtMoney(totals.total, "GBP")} sub={`${expenses.length} items`} />
            <SumTile
              label="Awaiting"
              value={fmtMoney(totals.awaiting, "GBP")}
              sub="Draft + submitted"
            />
            <SumTile
              label="Approved"
              value={fmtMoney(totals.approved, "GBP")}
              sub="Approved, not yet paid"
            />
            <SumTile
              label="Reimbursed"
              value={fmtMoney(totals.reimbursed, "GBP")}
              sub="Settled"
            />
          </section>

          {/* Per-month sections */}
          {byMonth.map((m) => (
            <section key={m.key} className="flex flex-col gap-2">
              <header className="flex items-baseline justify-between">
                <h2 className="h3">{m.label}</h2>
                <span className="small mono">
                  {fmtMoney(m.total, "GBP")}
                </span>
              </header>
              <div className="j-card divide-y divide-rule">
                {m.rows.map((e) => (
                  <ExpensesRow
                    key={e.id}
                    expense={{
                      id: e.id,
                      type: e.type,
                      typeLabel: TYPE_LABEL[e.type] ?? e.type,
                      amount: e.amount,
                      currency: e.currency,
                      reimbursementStatus: e.reimbursement_status,
                      notes: e.notes,
                      createdAt: formatDateInTz(new Date(e.created_at), wsCfg.timezone),
                      visit: e.visit_plan
                        ? {
                            id: e.visit_plan.id,
                            label:
                              e.visit_plan.title ??
                              e.visit_plan.customer?.name ??
                              "Visit",
                          }
                        : null,
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </PageShell>
  );
}

function totalsFor(expenses: ExpenseRow[]) {
  const total = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const awaiting = expenses
    .filter((e) =>
      ["draft", "submitted"].includes(e.reimbursement_status),
    )
    .reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const approved = expenses
    .filter((e) => e.reimbursement_status === "approved")
    .reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const reimbursed = expenses
    .filter((e) => e.reimbursement_status === "reimbursed")
    .reduce((s, e) => s + Number(e.amount ?? 0), 0);
  return { total, awaiting, approved, reimbursed };
}

function groupByMonth(expenses: ExpenseRow[], timezone: string) {
  const groups = new Map<string, { label: string; total: number; rows: ExpenseRow[] }>();
  for (const e of expenses) {
    const key = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      timeZone: timezone,
    }).format(new Date(e.created_at));
    const label = new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "long",
      timeZone: timezone,
    }).format(new Date(e.created_at));
    const g = groups.get(key) ?? { label, total: 0, rows: [] };
    g.total += Number(e.amount ?? 0);
    g.rows.push(e);
    groups.set(key, g);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, val]) => ({ key, ...val }));
}

function fmtMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(amount);
}

function SumTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div>
      <p className="uc mb-1">{label}</p>
      <p className="mono text-xl font-medium text-ink">{value}</p>
      <p className="tiny">{sub}</p>
    </div>
  );
}

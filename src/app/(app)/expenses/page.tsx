import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { formatDateInTz } from "@/lib/types/time";

// Expenses — Design Round 2 secondary template (.cc-total-bar + .cc-section /
// .cc-list-row + .cc-empty). Per-month, mode-scoped.

type ExpenseRow = {
  id: string;
  type: string;
  amount: number | null;
  currency: string;
  created_at: string;
  itinerary: { id: string; title: string | null; date_start: string } | null;
};

const TYPE_LABEL: Record<string, string> = {
  rail_ticket: "Rail ticket", mileage: "Mileage", parking: "Parking",
  taxi: "Taxi", hotel: "Hotel", food: "Food", other: "Other",
};

export default async function ExpensesPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const wsCfg = await getWorkspaceConfig(ctx.workspaceId);

  const { data: raw } = await supabase
    .from("expense_records")
    .select("id, type, amount, currency, created_at, itinerary:itineraries(id, title, date_start)")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false })
    .limit(200);

  const expenses = (raw ?? []) as unknown as ExpenseRow[];
  const total = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const byMonth = groupByMonth(expenses, wsCfg.timezone);

  return (
    <div className="cc-screen">
      <header>
        <span className="cc-eyebrow">{ctx.activeMode === "work" ? "Work" : "Personal"} · Ledger</span>
        <h1 className="cc-screen-title" style={{ marginTop: 6 }}>Expenses</h1>
      </header>

      {expenses.length === 0 ? (
        <div className="cc-empty">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mk-ink.png" alt="" />
          <p className="cc-empty-title">Nothing to settle</p>
          <p className="cc-empty-sub">Tickets, mileage, parking and receipts captured against a journey land here.</p>
        </div>
      ) : (
        <>
          <div className="cc-total-bar">
            <span className="l">Total · {expenses.length} items</span>
            <span className="v">{fmtMoney(total)}</span>
          </div>

          {byMonth.map((m) => (
            <section className="cc-section" key={m.key}>
              <div className="cc-section-head">
                <span className="cc-section-title">{m.label}</span>
                <span className="cc-section-meta">{fmtMoney(m.total)}</span>
              </div>
              {m.rows.map((e) => (
                <div className="cc-list-row" key={e.id}>
                  <div className="main">
                    <span className="t">{TYPE_LABEL[e.type] ?? e.type}</span>
                    <span className="s">
                      {e.itinerary?.title ?? formatDateInTz(new Date(e.created_at), wsCfg.timezone)}
                    </span>
                  </div>
                  <span className="r">{fmtMoney(Number(e.amount ?? 0))}</span>
                </div>
              ))}
            </section>
          ))}
        </>
      )}
    </div>
  );
}

function groupByMonth(expenses: ExpenseRow[], tz: string) {
  const groups = new Map<string, { label: string; total: number; rows: ExpenseRow[] }>();
  for (const e of expenses) {
    const key = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: tz }).format(new Date(e.created_at));
    const label = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "long", timeZone: tz }).format(new Date(e.created_at));
    const g = groups.get(key) ?? { label, total: 0, rows: [] };
    g.total += Number(e.amount ?? 0);
    g.rows.push(e);
    groups.set(key, g);
  }
  return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([key, val]) => ({ key, ...val }));
}

function fmtMoney(amount: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewExpense, type ApprovalItem } from "@/lib/actions/approvals";

// Approvals queue (Phase 17) — a manager reviews submitted WORK-trip spend.
// Functional + `.cc-approvals*` contract classes; Design skins later.
export function ApprovalsQueue({ items }: { items: ApprovalItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function review(id: string, approve: boolean) {
    startTransition(async () => { await reviewExpense({ id, approve }); router.refresh(); });
  }

  return (
    <section className="cc-approvals" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
      <span className="cc-eyebrow">Awaiting your approval</span>
      {items.length === 0 ? (
        <p className="cc-approvals-empty" style={{ color: "var(--ink-dim)", fontSize: "var(--fs-label)" }}>Nothing to approve right now.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {items.map((i) => (
            <li key={i.id} className="cc-approvals-row" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-2) var(--space-3)", border: "1px solid var(--rule)", borderRadius: "var(--radius-md, 6px)" }}>
              <span style={{ color: "var(--ink)" }}>{i.traveller}</span>
              <span style={{ fontSize: "var(--fs-micro, 11px)", color: "var(--ink-dim)" }}>{i.tripTitle} · {i.type}{i.notes ? ` · ${i.notes}` : ""}</span>
              <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", color: "var(--ink)" }}>{money(i.amount, i.currency)}</span>
              <button type="button" className="cc-btn cc-btn-gold" disabled={pending} onClick={() => review(i.id, true)}>Approve</button>
              <button type="button" className="cc-btn cc-btn-ghost" disabled={pending} onClick={() => review(i.id, false)}>Reject</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function money(amount: number | null, currency: string): string {
  if (amount == null) return "—";
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount); } catch { return `${amount} ${currency}`; }
}

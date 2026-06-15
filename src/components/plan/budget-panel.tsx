"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setItineraryCap, addTripExpense, attachReceipt, receiptViewUrl, type Budget } from "@/lib/actions/budget";

const TYPES = [
  { v: "food", label: "Food" }, { v: "taxi", label: "Taxi" }, { v: "parking", label: "Parking" },
  { v: "hotel", label: "Hotel" }, { v: "rail_ticket", label: "Rail" }, { v: "other", label: "Other" },
] as const;
const TYPE_LABEL: Record<string, string> = { ...Object.fromEntries(TYPES.map((t) => [t.v, t.label])), mileage: "Mileage" };

// Budget panel (Phase 16) — a per-trip spend cap with live used-vs-remaining +
// over-cap flag, the trip's expense lines, receipt capture, and quick-add.
// Functional + on-token + `.cc-budget*` contract classes; Design skins later.
export function BudgetPanel({ itineraryId, budget }: { itineraryId: string; budget: Budget }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [capInput, setCapInput] = useState(budget.cap != null ? String(budget.cap) : "");
  const [adding, setAdding] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const pct = budget.cap && budget.cap > 0 ? Math.min(100, Math.round((budget.spent / budget.cap) * 100)) : 0;
  const over = budget.overBy > 0;

  function saveCap() {
    startTransition(async () => {
      await setItineraryCap({ itineraryId, amount: capInput.trim() ? Number(capInput) : null, currency: budget.currency });
      router.refresh();
    });
  }
  function onReceipt(expenseId: string, file: File) {
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => { await attachReceipt(expenseId, itineraryId, fd); router.refresh(); });
  }
  async function viewReceipt(path: string) {
    const url = await receiptViewUrl(path);
    if (url) window.open(url, "_blank", "noopener");
  }

  return (
    <section className="cc-budget" style={{ border: "1px solid var(--rule)", borderRadius: "var(--radius-lg, 12px)", padding: "var(--space-4)", background: "var(--card)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div className="cc-budget-head" style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <span className="cc-eyebrow">Budget</span>
        <span className="cc-budget-fig" style={{ fontFamily: "var(--mono)", color: over ? "var(--rust)" : "var(--ink)" }}>
          {money(budget.spent, budget.currency)}{budget.cap != null ? ` / ${money(budget.cap, budget.currency)}` : " spent"}
        </span>
        {budget.cap != null ? (
          <span className="cc-budget-note" style={{ fontSize: "var(--fs-label)", color: over ? "var(--rust)" : "var(--ink-dim)" }}>
            {over ? `${money(budget.overBy, budget.currency)} over cap` : `${money(budget.remaining ?? 0, budget.currency)} remaining`}
          </span>
        ) : null}
      </div>

      {budget.cap != null ? (
        <div className="cc-budget-bar" data-over={over ? "true" : "false"} style={{ height: 6, borderRadius: 999, background: "var(--card-2)", overflow: "hidden" }}>
          <span style={{ display: "block", height: "100%", width: `${pct}%`, background: over ? "var(--rust)" : "var(--gold)" }} />
        </div>
      ) : null}

      <div className="cc-budget-cap" style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
        <input className="cc-field" type="number" inputMode="decimal" placeholder="Set a cap" value={capInput} onChange={(e) => setCapInput(e.target.value)} style={{ width: 120 }} />
        <button type="button" className="cc-btn cc-btn-ghost" onClick={saveCap} disabled={pending}>{budget.cap != null ? "Update cap" : "Set cap"}</button>
        <button type="button" className="cc-btn cc-btn-ghost" onClick={() => setAdding((v) => !v)} style={{ marginLeft: "auto" }}>{adding ? "Cancel" : "Add expense"}</button>
      </div>

      {adding ? <AddExpense itineraryId={itineraryId} currency={budget.currency} onDone={() => { setAdding(false); router.refresh(); }} /> : null}

      {budget.lines.length > 0 ? (
        <ul className="cc-budget-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          {budget.lines.map((l) => (
            <li key={l.id} className="cc-budget-row" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-1) 0" }}>
              <span className="cc-budget-row-type" style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-micro, 11px)", color: "var(--ink-dim)", textTransform: "uppercase", letterSpacing: "0.06em", minWidth: 64 }}>{TYPE_LABEL[l.type] ?? l.type}</span>
              <span className="cc-budget-row-notes" style={{ color: "var(--ink)", flex: 1 }}>{l.notes || "—"}</span>
              {l.hasReceipt && l.receiptPath ? (
                <button type="button" className="cc-budget-receipt" onClick={() => viewReceipt(l.receiptPath!)} style={{ background: "none", border: "none", color: "var(--gold-2)", cursor: "pointer", fontSize: "var(--fs-micro, 11px)" }}>Receipt</button>
              ) : l.type !== "mileage" ? (
                <>
                  <button type="button" className="cc-budget-attach" onClick={() => fileInputs.current[l.id]?.click()} style={{ background: "none", border: "none", color: "var(--ink-dim)", cursor: "pointer", fontSize: "var(--fs-micro, 11px)" }}>+ Receipt</button>
                  <input ref={(el) => { fileInputs.current[l.id] = el; }} type="file" accept="image/*,application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onReceipt(l.id, f); }} />
                </>
              ) : null}
              <span className="cc-budget-row-amt" style={{ fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>{l.amount != null ? money(l.amount, l.currency) : "—"}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function AddExpense({ itineraryId, currency, onDone }: { itineraryId: string; currency: string; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<(typeof TYPES)[number]["v"]>("food");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  function save() {
    const n = Number(amount);
    if (!n || n <= 0) return setError("Enter an amount.");
    startTransition(async () => {
      const res = await addTripExpense({ itineraryId, type, amount: n, currency, notes: notes || undefined });
      if (!res.ok) return setError(res.error ?? "Couldn't add it.");
      onDone();
    });
  }
  return (
    <div className="cc-budget-add" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center", padding: "var(--space-3)", border: "1px solid var(--rule)", borderRadius: "var(--radius-md, 6px)", background: "var(--card-2)" }}>
      <select className="cc-field" value={type} onChange={(e) => setType(e.target.value as typeof type)}>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select>
      <input className="cc-field" type="number" inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 100 }} />
      <input className="cc-field" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button type="button" className="cc-btn cc-btn-gold" onClick={save} disabled={pending}>{pending ? "Adding…" : "Add"}</button>
      {error ? <span style={{ color: "var(--rust)", fontSize: "var(--fs-micro, 11px)" }}>{error}</span> : null}
    </div>
  );
}

function money(amount: number, currency: string): string {
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount); } catch { return `${amount} ${currency}`; }
}

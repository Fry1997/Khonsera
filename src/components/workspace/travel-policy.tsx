"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setExpenseCap, type PolicyCap } from "@/lib/actions/budget";

const TYPES = [
  { v: "food", label: "Food" }, { v: "hotel", label: "Hotel" }, { v: "taxi", label: "Taxi" },
  { v: "parking", label: "Parking" }, { v: "rail_ticket", label: "Rail" }, { v: "other", label: "Other" },
] as const;

// Travel policy (Phase 16/17) — per-CATEGORY expense caps, manager-set, applied to
// every work trip's budget. Real T&E shape: a meal cap (often per-day), a hotel
// cap, etc. Functional + `.cc-policy*` contract classes; Design skins later.
export function TravelPolicy({ caps }: { caps: PolicyCap[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const byType = new Map(caps.map((c) => [c.type, c]));

  return (
    <section className="cc-policy" style={{ marginTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <span className="cc-eyebrow">Travel policy · expense caps</span>
      <p className="cc-policy-note" style={{ fontSize: "var(--fs-label)", color: "var(--ink-dim)", margin: 0 }}>Set a cap per category — applied to every work trip. Leave blank for no cap.</p>
      {TYPES.map((t) => (
        <CapRow key={t.v} type={t.v} label={t.label} current={byType.get(t.v) ?? null} pending={pending} onSave={(amount, period) => startTransition(async () => { await setExpenseCap({ type: t.v, period, amount, currency: "GBP" }); router.refresh(); })} />
      ))}
    </section>
  );
}

function CapRow({ type, label, current, pending, onSave }: { type: string; label: string; current: PolicyCap | null; pending: boolean; onSave: (amount: number | null, period: "per_day" | "per_trip") => void }) {
  void type;
  const [amount, setAmount] = useState(current ? String(current.amount) : "");
  const [period, setPeriod] = useState<"per_day" | "per_trip">(current?.period ?? (label === "Food" ? "per_day" : "per_trip"));
  return (
    <div className="cc-policy-row" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
      <span className="cc-policy-row-type" style={{ minWidth: 72, color: "var(--ink)" }}>{label}</span>
      <span style={{ color: "var(--ink-dim)" }}>£</span>
      <input className="cc-field" type="number" inputMode="decimal" placeholder="—" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 90 }} />
      <select className="cc-field" value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}><option value="per_trip">per trip</option><option value="per_day">per day</option></select>
      <button type="button" className="cc-btn cc-btn-ghost" disabled={pending} onClick={() => onSave(amount.trim() ? Number(amount) : null, period)}>Save</button>
    </div>
  );
}

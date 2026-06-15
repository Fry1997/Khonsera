"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setHomeCurrency } from "@/lib/actions/budget";

const COMMON = ["GBP", "EUR", "USD", "CHF", "JPY", "AUD", "CAD"];

// Home currency (Phase 19) — the currency foreign spend is shown in everywhere.
export function HomeCurrency({ current }: { current: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(current);
  const [saved, setSaved] = useState(false);
  return (
    <div className="cc-settings-row" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
      <span className="l">Home currency</span>
      <span className="v" style={{ marginLeft: "auto", display: "inline-flex", gap: "var(--space-2)", alignItems: "center" }}>
        <select className="cc-field" value={value} onChange={(e) => { setValue(e.target.value); setSaved(false); }}>
          {COMMON.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="button" className="cc-btn cc-btn-ghost" disabled={pending || value === current} onClick={() => startTransition(async () => { const r = await setHomeCurrency({ currency: value }); if (r.ok) { setSaved(true); router.refresh(); } })}>
          {saved ? "Saved" : "Save"}
        </button>
      </span>
    </div>
  );
}

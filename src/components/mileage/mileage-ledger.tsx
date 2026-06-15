"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logTrip, classifyTrip, deleteTrip, type TripVM } from "@/lib/actions/mileage";
import type { MileageReport } from "@/lib/mileage/engine";

// Mileage ledger (Phase 15) — the private claim-ready record. An HMRC summary bar
// (business miles + claimable, CSV export), manual add, and the trip list where
// each drive is classified business/personal (explicit, never learned). Functional
// + `.cc-mileage*` contract classes; Design skins later.
export function MileageLedger({ trips, report }: { trips: TripVM[]; report: MileageReport }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  function classify(id: string, c: "business" | "personal") {
    setBusy(id);
    startTransition(async () => {
      await classifyTrip(id, c);
      setBusy(null);
      router.refresh();
    });
  }
  function remove(id: string) {
    setBusy(id);
    startTransition(async () => {
      await deleteTrip(id);
      setBusy(null);
      router.refresh();
    });
  }

  function exportCsv() {
    const header = ["Date", "From", "To", "Miles", "Class", "Vehicle", "Claimable £"];
    const rows = report.trips.map((t) => {
      const trip = trips.find((x) => x.id === t.id);
      return [
        new Date(t.startedAt).toLocaleDateString("en-GB"),
        trip?.originLabel ?? "",
        trip?.destLabel ?? "",
        t.miles.toFixed(1),
        t.classification,
        t.vehicle,
        (t.amountPence / 100).toFixed(2),
      ];
    });
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mileage-${report.taxYear.replace("/", "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="cc-mileage" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* HMRC summary */}
      <div className="cc-mileage-summary" style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "var(--space-4)", padding: "var(--space-4) var(--space-5)", border: "1px solid var(--rule)", borderRadius: "var(--radius-lg, 12px)", background: "var(--card)" }}>
        <span className="cc-mileage-sum-fig" style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-h2, 24px)", color: "var(--ink)" }}>£{(report.claimablePence / 100).toFixed(2)}</span>
        <span style={{ color: "var(--ink-dim)", fontSize: "var(--fs-label)" }}>claimable · {report.businessMiles} business mi · {report.taxYear}</span>
        <button type="button" className="cc-btn cc-btn-ghost" onClick={exportCsv} style={{ marginLeft: "auto" }} disabled={report.trips.length === 0}>Export CSV</button>
        <button type="button" className="cc-btn cc-btn-ghost" onClick={() => setAdding((v) => !v)}>{adding ? "Cancel" : "Add a trip"}</button>
      </div>

      {adding ? <ManualAdd onDone={() => { setAdding(false); router.refresh(); }} /> : null}

      {/* Ledger */}
      {trips.length === 0 ? (
        <p className="cc-mileage-empty" style={{ color: "var(--ink-dim)", fontSize: "var(--fs-label)" }}>No trips yet. Record a drive or add one manually.</p>
      ) : (
        <ul className="cc-mileage-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {trips.map((t) => (
            <li key={t.id} className="cc-mileage-trip" data-class={t.classification} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "var(--space-3)", alignItems: "center", padding: "var(--space-3) var(--space-4)", border: "1px solid var(--rule)", borderRadius: "var(--radius-md, 6px)" }}>
              <span className="cc-mileage-trip-main">
                <span style={{ display: "block", color: "var(--ink)" }}>
                  {t.originLabel || "Drive"}{t.destLabel ? ` → ${t.destLabel}` : ""}
                </span>
                <span style={{ display: "block", fontFamily: "var(--mono)", fontSize: "var(--fs-micro, 11px)", color: "var(--ink-dim)" }}>
                  {new Date(t.startedAt).toLocaleDateString("en-GB")} · {t.distanceMiles} mi · {t.source === "gps" ? "GPS" : "manual"}
                </span>
              </span>
              <span className="cc-mileage-trip-class" role="group" style={{ display: "inline-flex", gap: 4 }}>
                <button type="button" data-active={t.classification === "business"} disabled={busy === t.id} onClick={() => classify(t.id, "business")} style={segBtn(t.classification === "business")}>Business</button>
                <button type="button" data-active={t.classification === "personal"} disabled={busy === t.id} onClick={() => classify(t.id, "personal")} style={segBtn(t.classification === "personal")}>Personal</button>
              </span>
              <button type="button" className="cc-mileage-trip-del" disabled={busy === t.id} onClick={() => remove(t.id)} style={{ background: "none", border: "none", color: "var(--ink-dim)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: "var(--fs-micro, 11px)" }}>Delete</button>
            </li>
          ))}
        </ul>
      )}
      {pending ? null : null}
    </div>
  );
}

function segBtn(active: boolean): React.CSSProperties {
  return {
    fontFamily: "var(--mono)",
    fontSize: "var(--fs-micro, 11px)",
    letterSpacing: "0.04em",
    padding: "5px 10px",
    borderRadius: "var(--radius-pill, 999px)",
    border: "1px solid var(--rule)",
    background: active ? "var(--gold)" : "transparent",
    color: active ? "#fff" : "var(--ink-dim)",
    cursor: "pointer",
  };
}

function ManualAdd({ onDone }: { onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [milesStr, setMilesStr] = useState("");
  const [vehicle, setVehicle] = useState<"car" | "motorcycle" | "bicycle">("car");
  const [cls, setCls] = useState<"business" | "personal">("business");
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState<string | null>(null);

  function save() {
    const miles = Number(milesStr);
    if (!miles || miles <= 0) return setError("Enter the miles.");
    startTransition(async () => {
      const res = await logTrip({
        startedAt: new Date(`${date}T09:00:00`).toISOString(),
        originLabel: from || undefined,
        destLabel: to || undefined,
        distanceMiles: miles,
        vehicle,
        classification: cls,
        source: "manual",
        purpose: purpose || undefined,
      });
      if (!res.ok) return setError(res.error ?? "Couldn't add it.");
      onDone();
    });
  }

  return (
    <div className="cc-mileage-add" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center", padding: "var(--space-4)", border: "1px solid var(--rule)", borderRadius: "var(--radius-lg, 12px)", background: "var(--card-2)" }}>
      <input className="cc-field" placeholder="From" value={from} onChange={(e) => setFrom(e.target.value)} />
      <input className="cc-field" placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} />
      <input className="cc-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <input className="cc-field" placeholder="Miles" inputMode="decimal" value={milesStr} onChange={(e) => setMilesStr(e.target.value)} style={{ width: 90 }} />
      <select className="cc-field" value={vehicle} onChange={(e) => setVehicle(e.target.value as typeof vehicle)}>
        <option value="car">Car</option><option value="motorcycle">Motorcycle</option><option value="bicycle">Bicycle</option>
      </select>
      <select className="cc-field" value={cls} onChange={(e) => setCls(e.target.value as typeof cls)}>
        <option value="business">Business</option><option value="personal">Personal</option>
      </select>
      <input className="cc-field" placeholder="Purpose (optional)" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
      <button type="button" className="cc-btn cc-btn-gold" onClick={save} disabled={pending}>{pending ? "Adding…" : "Add"}</button>
      {error ? <span style={{ color: "var(--rust)", fontSize: "var(--fs-micro, 11px)" }}>{error}</span> : null}
    </div>
  );
}

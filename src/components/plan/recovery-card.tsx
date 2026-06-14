import type { RecoveryOption } from "@/lib/recovery/engine";

// Recovery / the way out (Phase 11). When a booked train is cancelled or badly
// delayed, this is the consequence band: each viable alternative + its honest
// impact on your day. Until the protect-target is set we show the TRADE-OFF
// (soonest-first), never a silent ranking. Functional + on-token + `.cc-recovery`
// contract classes; Design owns the skin (handoff logged).
export function RecoveryCard({ options, sample }: { options: RecoveryOption[]; sample: boolean }) {
  if (!options.length) return null;
  return (
    <div className="cc-recovery"
      style={{ marginTop: "var(--space-2)", padding: "var(--space-3) var(--space-3-5)", border: "1px solid var(--rule)", borderRadius: 8, background: "var(--card)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div className="cc-recovery-head" style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <span className="cc-recovery-eyebrow" style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-micro, 11px)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gold-2)" }}>
          The way out{sample ? " · sample" : ""}
        </span>
        <span className="cc-recovery-note" style={{ fontSize: "var(--fs-label)", color: "var(--ink-faint)" }}>
          the trade-off — choose your priority
        </span>
      </div>
      <ul className="cc-recovery-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {options.map((o) => (
          <li key={o.id} className="cc-recovery-opt" data-makes={o.makesIt ? "true" : "false"} data-return={o.returnNote ? "at-risk" : undefined}
            style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "var(--space-3)", alignItems: "baseline" }}>
            <span className="cc-recovery-label" style={{ fontFamily: "var(--mono)", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
              {o.label}
              {o.note ? <span className="cc-recovery-via" style={{ display: "block", fontSize: "var(--fs-micro, 11px)", color: "var(--ink-faint)" }}>{o.note}</span> : null}
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: "var(--space-0-5)" }}>
              <span className="cc-recovery-conseq" style={{ fontSize: "var(--fs-label)", color: o.makesIt ? "var(--sage, var(--ink))" : "var(--ink)" }}>{o.consequence}</span>
              {o.returnNote ? (
                <span className="cc-recovery-return" style={{ fontSize: "var(--fs-label)", color: "var(--rust)" }}>{o.returnNote}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { tflLineStatus, type TflLineState } from "@/lib/integrations/tfl";

// London line status (Phase 8). Concierge restraint: lead with what's disrupted,
// withhold the rest ("everything else running well"). Functional + on-token;
// Design owns the .cc-tfl skin (see the Design handoff).
const DOT: Record<TflLineState, string> = {
  good: "var(--sage)",
  minor: "var(--gold)",
  severe: "var(--amber)",
  suspended: "var(--rust)",
  info: "var(--ink-faint)",
};

export async function TflLineStatus() {
  const res = await tflLineStatus();
  const lines = res.mode === "unavailable" ? [] : res.data;
  if (lines.length === 0) return null;
  const disrupted = lines.filter((l) => l.state !== "good");
  const goodCount = lines.length - disrupted.length;

  return (
    <section className="cc-tfl" aria-label="London transit status"
      style={{ border: "1px solid var(--rule)", borderRadius: 8, background: "var(--card)", padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <span className="cc-eyebrow">London transit{res.mode === "demo" ? " · sample" : ""}</span>

      {disrupted.length === 0 ? (
        <p className="cc-tfl-allgood" style={{ margin: 0, color: "var(--ink)" }}>All lines running well.</p>
      ) : (
        <>
          {disrupted.map((l) => (
            <div key={l.id} className="cc-tfl-line" data-state={l.state}
              style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", flexWrap: "wrap" }}>
              <span className="cc-tfl-dot" aria-hidden
                style={{ width: 8, height: 8, borderRadius: "50%", background: DOT[l.state], flex: "none", alignSelf: "center" }} />
              <span className="cc-tfl-name" style={{ color: "var(--ink)", fontWeight: 500 }}>{l.name}</span>
              <span className="cc-tfl-status" style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>{l.status}</span>
              {l.reason ? <span className="cc-tfl-reason" style={{ flexBasis: "100%", fontSize: "var(--fs-label)", color: "var(--ink-faint)" }}>{l.reason}</span> : null}
            </div>
          ))}
          {goodCount > 0 ? (
            <p className="cc-tfl-rest" style={{ margin: 0, fontSize: "var(--fs-label)", color: "var(--ink-faint)" }}>
              Everything else running well.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

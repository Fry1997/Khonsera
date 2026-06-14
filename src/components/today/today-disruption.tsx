// Today disruption banner (Phase 10). When a live break is on today's plan, Today
// adopts its disruption character: this banner leads, the rest recedes. Driven by
// Darwin (rail) server-side — only appears with DARWIN_LDBWS_TOKEN + a real delay,
// so no false alarms. Functional + on-token + .cc-today-disruption contract classes;
// Design owns the skin (see the Design handoff).
export type TodayDisruptionItem = { title: string; text: string; severe: boolean };

export function TodayDisruption({ items }: { items: TodayDisruptionItem[] }) {
  if (items.length === 0) return null;
  const severe = items.some((i) => i.severe);
  return (
    <section className="cc-today-disruption" data-severe={severe ? "true" : "false"}
      style={{ border: `1px solid ${severe ? "var(--rust)" : "var(--gold-soft)"}`, borderRadius: 8, background: "var(--card)", padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <span className="cc-eyebrow" style={{ color: severe ? "var(--rust)" : "var(--gold-2)" }}>
        {severe ? "Disruption" : "Running late"}
      </span>
      {items.map((i, idx) => (
        <div key={idx} className="cc-today-disruption-item" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ color: "var(--ink)", fontWeight: 500 }}>{i.title}</span>
          <span style={{ fontSize: "var(--fs-label)", color: "var(--ink)" }}>{i.text}</span>
        </div>
      ))}
    </section>
  );
}

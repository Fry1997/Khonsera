import type { TflLegPlanVM } from "@/lib/integrations/tfl";

// London leg plan (Phase 8): the multimodal route (walk → line → walk) + live
// arrivals at the boarding stop, rendered beneath a London transit leg on the
// plan. Functional + on-token + .cc-tflleg contract classes; Design owns the skin.
export function TflLegPlan({ data }: { data: TflLegPlanVM }) {
  const { plan, arrivals, sample } = data;
  const boardingArrivals = arrivals.slice(0, 3);
  return (
    <div className="cc-tflleg"
      style={{ marginTop: "var(--space-2)", padding: "var(--space-2) var(--space-3)", border: "1px solid var(--rule)", borderRadius: 6, background: "var(--card)", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <span className="cc-eyebrow">Via TfL · {plan.durationMin} min{sample ? " · sample" : ""}</span>
      <div className="cc-tflleg-route" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "baseline" }}>
        {plan.legs.map((l, i) => (
          <span key={i} className="cc-tflleg-step" style={{ fontSize: "var(--fs-label)", color: l.line ? "var(--ink)" : "var(--ink-dim)" }}>
            {l.line ? `${l.line} line` : "Walk"}
            <span style={{ fontFamily: "var(--mono)", color: "var(--ink-faint)" }}> · {l.durationMin}m</span>
            {i < plan.legs.length - 1 ? <span style={{ color: "var(--ink-faint)" }}> →</span> : null}
          </span>
        ))}
      </div>
      {plan.boardingName && boardingArrivals.length ? (
        <div className="cc-tflleg-arrivals" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "baseline" }}>
          <span style={{ fontSize: "var(--fs-label)", color: "var(--ink-faint)" }}>Next from {plan.boardingName}:</span>
          {boardingArrivals.map((a, i) => (
            <span key={i} className="cc-tflleg-arr" style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-label)", color: "var(--gold-2)" }}>
              {a.dueMin} min
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

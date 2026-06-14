import type { TflLegPlanVM } from "@/lib/integrations/tfl";

// London leg plan (Phase 8/9): the multimodal route + live arrivals, and (P9) the
// disruption + engine consequence. Markup carries Design's live contract
// (`.cc-tflleg` + `-eyebrow/-route/-step/-sep/-arrivals/-arr`, `[data-disrupted]`,
// `.cc-tflleg-alert[data-state]` + `-status/-conseq`, `.cc-tflleg-reroute`).
export function TflLegPlan({ data }: { data: TflLegPlanVM }) {
  const { plan, arrivals, sample, disruption, consequence } = data;
  const boardingArrivals = arrivals.slice(0, 3);
  return (
    <div className="cc-tflleg" data-disrupted={disruption ? disruption.state : undefined}>
      <div className="cc-tflleg-eyebrow">
        <span>Via TfL · {plan.durationMin} min</span>
        {sample ? <span className="cc-tfl-sample">· sample</span> : null}
      </div>

      <div className="cc-tflleg-route">
        {plan.legs.map((l, i) => (
          <span key={i} className="cc-tflleg-step">
            {l.line ? `${l.line} line` : "Walk"}
            <span className="min">{l.durationMin}m</span>
            {i < plan.legs.length - 1 ? <span className="cc-tflleg-sep" aria-hidden>→</span> : null}
          </span>
        ))}
      </div>

      {plan.boardingName && boardingArrivals.length ? (
        <div className="cc-tflleg-arrivals">
          <span className="lbl">Next from {plan.boardingName}</span>
          {boardingArrivals.map((a, i) => (
            <span key={i} className="cc-tflleg-arr">{a.dueMin} min</span>
          ))}
        </div>
      ) : null}

      {disruption ? (
        <div className="cc-tflleg-alert" data-state={disruption.state}>
          <span className="cc-tflleg-alert-status">{disruption.line} line · {disruption.status}</span>
          {consequence ? <span className="cc-tflleg-alert-conseq">{consequence}</span> : null}
          {disruption.state === "severe" || disruption.state === "suspended" ? (
            <span className="cc-tflleg-reroute">Consider an alternative, or a taxi to keep the day.</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

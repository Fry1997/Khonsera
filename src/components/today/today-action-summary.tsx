import Link from "next/link";
import type { Route } from "next";
import { PlanCreate } from "@/components/plan/plan-create";

export type TodayActionSummaryState =
  | { kind: "no-plan" }
  | { kind: "upcoming-plan"; title?: string | null }
  | { kind: "active-next-leg"; title: string; href: Route | null; detail?: string | null }
  | { kind: "missing-base"; title?: string | null }
  | { kind: "missing-ticket"; title?: string | null }
  | { kind: "disruption"; title?: string | null; severe?: boolean }
  | { kind: "completed-day" };

export function TodayActionSummary({ state }: { state: TodayActionSummaryState }) {
  const copy = actionCopy(state);

  return (
    <section className="cc-active-tile" data-urgency={state.kind === "disruption" && state.severe ? "breach" : "comfortable"}>
      <span className="cc-at-status">
        <span className="cc-at-dot" />
        {copy.kicker}
      </span>
      <h2 className="cc-at-headline">{copy.headline}</h2>
      {copy.detail ? <p className="cc-at-sub">{copy.detail}</p> : null}
      <div style={{ marginTop: "var(--space-4)", display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>{primaryAction(state)}</div>
    </section>
  );
}

function primaryAction(state: TodayActionSummaryState) {
  switch (state.kind) {
    case "no-plan":
      return <PlanCreate label="Plan a day" />;
    case "missing-base":
      return (
        <Link href={("/plan" as Route)} className="cc-btn cc-btn-gold">
          Set base
        </Link>
      );
    case "active-next-leg":
      return state.href ? (
        <Link href={state.href} className="cc-btn cc-btn-gold">
          Start navigation
        </Link>
      ) : (
        <Link href={("/navigate" as Route)} className="cc-btn cc-btn-gold">
          Start navigation
        </Link>
      );
    case "missing-ticket":
      return (
        <Link href={("/wallet" as Route)} className="cc-btn cc-btn-gold">
          Open ticket
        </Link>
      );
    case "disruption":
      return (
        <Link href={("#today-disruptions" as Route)} className="cc-btn cc-btn-gold">
          Review disruption
        </Link>
      );
    case "upcoming-plan":
    case "completed-day":
      return <PlanCreate label="Plan tomorrow" />;
  }
}

function actionCopy(state: TodayActionSummaryState): { kicker: string; headline: string; detail?: string | null } {
  switch (state.kind) {
    case "no-plan":
      return { kicker: "Next step", headline: "Plan a day", detail: "Start with the first place or booking and Khonsera will thread the rest." };
    case "upcoming-plan":
      return { kicker: "Next step", headline: "Plan tomorrow", detail: state.title ? `${state.title} is coming up next.` : "You are clear today — get tomorrow ready when you are." };
    case "active-next-leg":
      return { kicker: "Next step", headline: "Start navigation", detail: state.detail ?? `Head to ${state.title}.` };
    case "missing-base":
      return { kicker: "Needs base", headline: "Set base", detail: state.title ? `Add where you leave from for ${state.title}.` : "Add where you leave from so Today can compute the first move." };
    case "missing-ticket":
      return { kicker: "Needs ticket", headline: "Open ticket", detail: state.title ? `Check the pass for ${state.title}.` : "Keep the right pass ready before you move." };
    case "disruption":
      return { kicker: state.severe ? "Disruption" : "Heads up", headline: "Review disruption", detail: state.title ?? "A live service change may affect the next leg." };
    case "completed-day":
      return { kicker: "All done", headline: "Plan tomorrow", detail: "Your day is complete. Set up the next one when you are ready." };
  }
}

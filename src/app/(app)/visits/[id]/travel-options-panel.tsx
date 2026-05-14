"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmVisitWithTravelOption } from "@/lib/actions/visit-plans";
import { feedbackFromError } from "@/lib/actions/_form";
import { FormError } from "@/components/ui/form";
import { VerdictPill, Stat } from "@/components/ui/verdict-pill";
import { formatTimeInTz } from "@/lib/types/time";

type Leg = {
  id: string;
  sequence: number;
  leg_type: string;
  start_location_name: string | null;
  end_location_name: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  distance_miles: number | null;
  provider: string | null;
  service_number: string | null;
  instructions: string | null;
};

type Option = {
  id: string;
  mode: string;
  feasibility_status: "recommended" | "tight" | "not_recommended" | "not_possible";
  leave_origin_at: string | null;
  arrive_site_at: string | null;
  meeting_start_at: string | null;
  meeting_end_at: string | null;
  leave_site_at: string | null;
  arrive_return_location_at: string | null;
  total_duration_minutes: number | null;
  total_cost_estimate: number | null;
  travel_time_minutes: number | null;
  buffer_minutes: number | null;
  recommendation_summary: string | null;
  risk_summary: string | null;
  currency: string | null;
  journey_legs: Leg[];
};

type Run = {
  id: string;
  generated_at: string;
  status: string;
  summary: string | null;
  travel_options: Option[];
};

export function TravelOptionsPanel({
  visitId,
  visitStatus,
  run,
  savedTrip,
  timezone,
}: {
  visitId: string;
  visitStatus: string;
  run: Run;
  savedTrip: { id: string; status: string; selected_travel_option_id: string | null } | null;
  timezone: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const isConfirmed = visitStatus === "confirmed" || visitStatus === "booked" ||
                      visitStatus === "in_progress" || visitStatus === "completed";

  const handleConfirm = (optionId: string, verdict: Option["feasibility_status"]) => {
    const warningPrefix =
      verdict === "not_recommended"
        ? "This option is NOT RECOMMENDED — there are major issues (calendar conflict, tight buffers, or both). Confirm anyway?"
        : verdict === "tight"
          ? "This is a TIGHT option — limited buffer. Confirm?"
          : "Confirm this travel option and save the trip?";
    if (!window.confirm(warningPrefix)) return;
    setConfirmingId(optionId);
    startTransition(async () => {
      setError(null);
      const result = await confirmVisitWithTravelOption(visitId, optionId);
      setConfirmingId(null);
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      router.refresh();
    });
  };

  const options = [...run.travel_options].sort((a, b) => {
    if (a.id === savedTrip?.selected_travel_option_id) return -1;
    if (b.id === savedTrip?.selected_travel_option_id) return 1;
    return 0;
  });

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h2 className="h3">Travel options</h2>
        <span className="small">
          {run.summary} · generated{" "}
          {formatTimeInTz(new Date(run.generated_at), timezone)}
        </span>
      </header>
      <FormError message={error ?? undefined} />

      {options.map((o) => {
        const isSelected = o.id === savedTrip?.selected_travel_option_id;
        const cost = o.total_cost_estimate
          ? new Intl.NumberFormat("en-GB", {
              style: "currency",
              currency: o.currency ?? "GBP",
            }).format(o.total_cost_estimate)
          : "Cost TBD";
        return (
          <div
            key={o.id}
            className="j-card p-5"
            style={
              isSelected
                ? { borderColor: "var(--terra)", background: "var(--card)" }
                : undefined
            }
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="h3 capitalize">{o.mode}</span>
                  <VerdictPill verdict={o.feasibility_status} />
                  {isSelected ? (
                    <span
                      className="chip"
                      style={{
                        background: "var(--rust-2)",
                        color: "var(--terra-deep)",
                      }}
                    >
                      Selected
                    </span>
                  ) : null}
                </div>
                {o.recommendation_summary ? (
                  <p className="body" style={{ fontStyle: "italic" }}>
                    &ldquo;{o.recommendation_summary}&rdquo;
                  </p>
                ) : null}
                {o.risk_summary && o.feasibility_status !== "recommended" ? (
                  <p className="small" style={{ color: "var(--rust)" }}>
                    {o.risk_summary}
                  </p>
                ) : null}
              </div>
              <Stat
                label="Cost"
                value={cost}
                sub={`${o.total_duration_minutes} min total`}
                align="right"
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Leave" value={fmt(o.leave_origin_at, timezone)} />
              <Stat label="Arrive" value={fmt(o.arrive_site_at, timezone)} />
              <Stat
                label="Leave site"
                value={fmt(o.leave_site_at, timezone)}
              />
              <Stat
                label="Home"
                value={fmt(o.arrive_return_location_at, timezone)}
              />
            </div>

            <details className="mt-4">
              <summary className="uc cursor-pointer">
                Journey legs ({o.journey_legs.length})
              </summary>
              <ol className="mt-3 flex flex-col gap-1.5">
                {[...o.journey_legs]
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((l) => (
                    <li
                      key={l.id}
                      className="small flex justify-between gap-2 border-l-2 pl-3"
                      style={{ borderColor: "var(--rule)" }}
                    >
                      <span>
                        <span className="uc mr-2">{l.leg_type}</span>
                        {l.start_location_name} → {l.end_location_name}
                        {l.service_number ? ` · ${l.service_number}` : ""}
                      </span>
                      <span className="mono whitespace-nowrap">
                        {fmt(l.start_time, timezone)}–{fmt(l.end_time, timezone)} (
                        {l.duration_minutes}m)
                      </span>
                    </li>
                  ))}
              </ol>
            </details>

            {!isConfirmed && o.feasibility_status !== "not_possible" ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => handleConfirm(o.id, o.feasibility_status)}
                  disabled={pending && confirmingId === o.id}
                  className={
                    o.feasibility_status === "recommended"
                      ? "btn-terra"
                      : "btn-ghost"
                  }
                >
                  {pending && confirmingId === o.id
                    ? "Confirming…"
                    : o.feasibility_status === "not_recommended"
                      ? "Confirm anyway"
                      : "Confirm this option"}
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

function fmt(iso: string | null, tz: string): string {
  if (!iso) return "—";
  return formatTimeInTz(new Date(iso), tz);
}

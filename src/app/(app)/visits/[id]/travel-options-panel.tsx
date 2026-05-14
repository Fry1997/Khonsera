"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmVisitWithTravelOption } from "@/lib/actions/visit-plans";
import { feedbackFromError } from "@/lib/actions/_form";
import { FormError } from "@/components/ui/form";
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

const VERDICT_LABEL: Record<Option["feasibility_status"], string> = {
  recommended: "Recommended",
  tight: "Possible but tight",
  not_recommended: "Not recommended",
  not_possible: "Not possible",
};

const VERDICT_CLASS: Record<Option["feasibility_status"], string> = {
  recommended: "bg-emerald-100 text-emerald-800",
  tight: "bg-amber-100 text-amber-800",
  not_recommended: "bg-rose-100 text-rose-800",
  not_possible: "bg-rose-200 text-rose-900",
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

  const handleConfirm = (optionId: string) => {
    if (!window.confirm("Confirm this travel option and save the trip?")) return;
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
        <h2 className="text-sm font-semibold">Travel options</h2>
        <span className="text-xs text-muted-foreground">
          {run.summary} · generated {formatTimeInTz(new Date(run.generated_at), timezone)}
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
            className={`rounded-md border p-4 ${
              isSelected ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold capitalize">{o.mode}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${VERDICT_CLASS[o.feasibility_status]}`}
                  >
                    {VERDICT_LABEL[o.feasibility_status]}
                  </span>
                  {isSelected ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Selected
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave {fmt(o.leave_origin_at, timezone)} · arrive{" "}
                  {fmt(o.arrive_site_at, timezone)} · leave site{" "}
                  {fmt(o.leave_site_at, timezone)} · home{" "}
                  {fmt(o.arrive_return_location_at, timezone)}
                </p>
                {o.recommendation_summary ? (
                  <p className="mt-2 text-sm italic text-muted-foreground">
                    "{o.recommendation_summary}"
                  </p>
                ) : null}
                {o.risk_summary && o.feasibility_status !== "recommended" ? (
                  <p className="text-xs text-rose-700">{o.risk_summary}</p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">{cost}</p>
                <p className="text-xs text-muted-foreground">
                  {o.total_duration_minutes} min total
                </p>
              </div>
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Journey legs ({o.journey_legs.length})
              </summary>
              <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
                {[...o.journey_legs]
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((l) => (
                    <li key={l.id} className="flex justify-between gap-2">
                      <span>
                        {l.leg_type} · {l.start_location_name} → {l.end_location_name}
                        {l.service_number ? ` · ${l.service_number}` : ""}
                      </span>
                      <span className="whitespace-nowrap">
                        {fmt(l.start_time, timezone)}–{fmt(l.end_time, timezone)} ({l.duration_minutes}m)
                      </span>
                    </li>
                  ))}
              </ol>
            </details>

            {!isConfirmed && o.feasibility_status !== "not_possible" ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => handleConfirm(o.id)}
                  disabled={pending && confirmingId === o.id}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {pending && confirmingId === o.id ? "Confirming…" : "Confirm this option"}
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

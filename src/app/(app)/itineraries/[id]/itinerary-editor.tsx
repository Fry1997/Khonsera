"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useMemo } from "react";
import { FormError } from "@/components/ui/form";
import { createStop, deleteStop } from "@/lib/actions/stops";
import { upsertTransition, setTransitionMode } from "@/lib/actions/transitions";
import { transitionItineraryStatus } from "@/lib/actions/itineraries";
import { feedbackFromError } from "@/lib/actions/_form";
import type {
  ItineraryStatus,
  LocationType,
  StopType,
  TransitionMode,
} from "@/lib/types/domain";
import { AddStopForm } from "./add-stop-form";

const STOP_ICON: Record<StopType, string> = {
  start: "📍",
  end: "🏁",
  appointment: "🤝",
  accommodation: "🏨",
  event: "🎫",
  meal: "🍽️",
  transport_booked: "🎟️",
  transit_arrival: "🛬",
  other: "·",
};

const STOP_LABEL: Record<StopType, string> = {
  start: "Start",
  end: "End",
  appointment: "Appointment",
  accommodation: "Accommodation",
  event: "Event",
  meal: "Meal",
  transport_booked: "Transport",
  transit_arrival: "Arrival",
  other: "Point",
};

const MODE_LABEL: Record<TransitionMode, string> = {
  walk: "Walk",
  drive: "Drive",
  taxi: "Taxi",
  bus: "Bus",
  tube: "Tube",
  train: "Train",
  flight: "Flight",
  mixed: "Mixed",
};

type StopRow = {
  id: string;
  sequence: number;
  type: StopType;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  external_reference: string | null;
  notes: string | null;
  location: { name?: string; address?: string } | null;
  customer: { name?: string } | null;
  customer_site: { name?: string; address?: string } | null;
  metadata: Record<string, unknown> | null;
};

type TransitionRow = {
  id: string;
  from_stop_id: string;
  to_stop_id: string;
  mode: TransitionMode;
  computed_duration_minutes: number | null;
  distance_miles: number | null;
  is_locked: boolean;
};

export function ItineraryEditor({
  itinerary,
  stops,
  transitions,
  customers,
  customerSites,
  locations,
  contacts,
  timezone,
}: {
  itinerary: {
    id: string;
    title: string | null;
    date_start: string;
    date_end: string;
    status: ItineraryStatus;
    notes: string | null;
  };
  stops: StopRow[];
  transitions: TransitionRow[];
  customers: { id: string; name: string }[];
  customerSites: { id: string; customer_id: string; name: string | null; address: string | null }[];
  locations: { id: string; name: string; type: LocationType; address: string | null }[];
  contacts: { id: string; customer_id: string; name: string }[];
  timezone: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Transitions keyed by from_stop_id for fast lookup.
  const transitionByFrom = useMemo(() => {
    const m = new Map<string, TransitionRow>();
    for (const t of transitions) m.set(t.from_stop_id, t);
    return m;
  }, [transitions]);

  const sortedStops = useMemo(
    () => [...stops].sort((a, b) => a.sequence - b.sequence),
    [stops],
  );

  const handleAdd = (input: Parameters<typeof createStop>[0]) => {
    startTransition(async () => {
      setError(null);
      const result = await createStop(input);
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      const newStop = result.value;

      // After adding, compute the transition into this stop (if there's a
      // preceding stop) and out of it (if not last). Both happen
      // server-side via upsertTransition.
      const precedingStop = sortedStops[sortedStops.length - 1];
      if (precedingStop) {
        await upsertTransition({
          itinerary_id: itinerary.id,
          from_stop_id: precedingStop.id,
          to_stop_id: newStop.id,
        });
      }
      setAdding(false);
      router.refresh();
    });
  };

  const handleDelete = (stopId: string) => {
    if (!window.confirm("Delete this point?")) return;
    startTransition(async () => {
      setError(null);
      const result = await deleteStop(stopId);
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      router.refresh();
    });
  };

  const handleSetMode = (transitionId: string, mode: TransitionMode) => {
    startTransition(async () => {
      setError(null);
      const result = await setTransitionMode({
        id: transitionId,
        mode,
      });
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      router.refresh();
    });
  };

  const handleAdvanceStatus = () => {
    const next: ItineraryStatus | null =
      itinerary.status === "draft"
        ? "planning"
        : itinerary.status === "planning"
          ? "planned"
          : itinerary.status === "planned"
            ? "in_progress"
            : itinerary.status === "in_progress"
              ? "completed"
              : null;
    if (!next) return;
    if (!window.confirm(`Move itinerary to "${next}"?`)) return;
    startTransition(async () => {
      setError(null);
      const result = await transitionItineraryStatus(itinerary.id, next);
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <FormError message={error ?? undefined} />

      {/* Status controls */}
      <section className="j-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="uc">Status</p>
          <p className="h3 capitalize">{itinerary.status.replace("_", " ")}</p>
        </div>
        {itinerary.status !== "completed" && itinerary.status !== "cancelled" ? (
          <button
            type="button"
            onClick={handleAdvanceStatus}
            disabled={pending}
            className="btn-ghost"
          >
            Advance
          </button>
        ) : null}
      </section>

      {/* Timeline */}
      {sortedStops.length === 0 ? (
        <div className="j-card-soft p-6 text-center">
          <p className="body mb-2">
            No points yet. Add your first point — usually home.
          </p>
        </div>
      ) : (
        <ol className="flex flex-col">
          {sortedStops.map((stop, i) => {
            const next = sortedStops[i + 1];
            const transitionToNext = next
              ? transitionByFrom.get(stop.id)
              : null;
            const locationLabel =
              stop.customer_site?.address ??
              stop.customer_site?.name ??
              stop.location?.address ??
              stop.location?.name ??
              null;
            const customerLabel = stop.customer?.name ?? null;
            return (
              <li key={stop.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-sm"
                    style={{
                      background: "var(--card-2)",
                      border: "1px solid var(--rule)",
                    }}
                  >
                    {STOP_ICON[stop.type]}
                  </div>
                  {next ? (
                    <div
                      className="w-px flex-1"
                      style={{ background: "var(--rule)" }}
                    />
                  ) : null}
                </div>
                <div className="mb-4 flex-1">
                  <article className="j-card p-4">
                    <header className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <p className="uc mb-1">{STOP_LABEL[stop.type]}</p>
                        <h3 className="h3">
                          {stop.title ??
                            customerLabel ??
                            locationLabel ??
                            STOP_LABEL[stop.type]}
                        </h3>
                        {customerLabel && stop.title ? (
                          <p className="small">{customerLabel}</p>
                        ) : null}
                        {locationLabel ? (
                          <p className="small">{locationLabel}</p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className="mono">
                          {fmtTime(stop.start_time, timezone)}
                          {stop.end_time
                            ? ` – ${fmtTime(stop.end_time, timezone)}`
                            : ""}
                        </p>
                        {stop.duration_minutes ? (
                          <p className="tiny">{stop.duration_minutes} min</p>
                        ) : null}
                      </div>
                    </header>
                    {stop.external_reference ? (
                      <p className="small mt-2">
                        <span className="uc mr-1">Ref</span>
                        <span className="mono">{stop.external_reference}</span>
                      </p>
                    ) : null}
                    {(stop.metadata?.flight_iata as string | undefined) ? (
                      <p className="small mt-1">
                        <span className="uc mr-1">Flight</span>
                        <span className="mono">
                          {String(stop.metadata?.flight_iata)}
                        </span>
                      </p>
                    ) : null}
                    {stop.notes ? (
                      <p className="small mt-2 line-clamp-3">{stop.notes}</p>
                    ) : null}
                    <footer className="mt-3 flex justify-end">
                      <button
                        type="button"
                        className="text-xs text-rust hover:underline disabled:opacity-50"
                        onClick={() => handleDelete(stop.id)}
                        disabled={pending}
                      >
                        Delete
                      </button>
                    </footer>
                  </article>

                  {/* Transition card between this stop and the next */}
                  {next && transitionToNext ? (
                    <div className="my-3 ml-4 flex items-center gap-3 text-sm">
                      <span className="uc">via</span>
                      <select
                        value={transitionToNext.mode}
                        disabled={pending}
                        onChange={(e) =>
                          handleSetMode(
                            transitionToNext.id,
                            e.target.value as TransitionMode,
                          )
                        }
                        className="input-base"
                        style={{
                          width: "auto",
                          padding: "4px 8px",
                          fontSize: 12,
                        }}
                      >
                        {(
                          [
                            "walk",
                            "drive",
                            "taxi",
                            "bus",
                            "tube",
                            "train",
                            "flight",
                          ] as TransitionMode[]
                        ).map((m) => (
                          <option key={m} value={m}>
                            {MODE_LABEL[m]}
                          </option>
                        ))}
                      </select>
                      {transitionToNext.computed_duration_minutes ? (
                        <span className="mono text-ink-dim">
                          {transitionToNext.computed_duration_minutes} min
                        </span>
                      ) : null}
                      {transitionToNext.distance_miles ? (
                        <span className="mono text-ink-dim">
                          {Number(transitionToNext.distance_miles).toFixed(1)} mi
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Add stop */}
      {adding ? (
        <AddStopForm
          itineraryId={itinerary.id}
          customers={customers}
          customerSites={customerSites}
          locations={locations}
          contacts={contacts}
          onCancel={() => setAdding(false)}
          onSubmit={handleAdd}
          pending={pending}
        />
      ) : (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="btn-terra"
            disabled={pending}
          >
            + Add point
          </button>
        </div>
      )}
    </div>
  );
}

function fmtTime(iso: string | null, tz: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });
}

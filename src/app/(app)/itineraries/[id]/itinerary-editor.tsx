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
  is_time_fixed: boolean;
  location_id: string | null;
  customer_id: string | null;
  customer_site_id: string | null;
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
  overview_polyline: string | null;
};

type JourneyLegRow = {
  id: string;
  transition_id: string;
  sequence: number;
  leg_type: string; // walk | drive | train | bus | taxi | wait | meeting | buffer
  start_location_name: string | null;
  end_location_name: string | null;
  duration_minutes: number | null;
  distance_miles: number | null;
  service_number: string | null;
  instructions: string | null;
};

export function ItineraryEditor({
  itinerary,
  stops,
  transitions,
  journeyLegs,
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
  journeyLegs: JourneyLegRow[];
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

  const legsByTransition = useMemo(() => {
    const m = new Map<string, JourneyLegRow[]>();
    for (const l of journeyLegs) {
      const arr = m.get(l.transition_id) ?? [];
      arr.push(l);
      m.set(l.transition_id, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.sequence - b.sequence);
    return m;
  }, [journeyLegs]);

  const sortedStops = useMemo(
    () => [...stops].sort((a, b) => a.sequence - b.sequence),
    [stops],
  );

  // The most recent prior place we could "return to" — i.e. the second-to-last
  // stop's place. Lets a user quickly close a hotel → expo → hotel hop without
  // re-typing the place.
  const returnToTarget = useMemo(() => {
    if (sortedStops.length < 2) return null;
    const last = sortedStops[sortedStops.length - 1];
    const prev = sortedStops[sortedStops.length - 2];
    // Don't offer "return to" if the last stop is already at the prev place.
    if (
      prev.location_id &&
      prev.location_id === last.location_id &&
      prev.customer_site_id === last.customer_site_id
    )
      return null;
    const label =
      prev.customer_site?.name ??
      prev.customer?.name ??
      prev.location?.name ??
      prev.title ??
      "previous place";
    return {
      label,
      location_id: prev.location_id,
      customer_id: prev.customer_id,
      customer_site_id: prev.customer_site_id,
    };
  }, [sortedStops]);

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

  const handleReturnTo = (target: {
    label: string;
    location_id: string | null;
    customer_id: string | null;
    customer_site_id: string | null;
  }) => {
    startTransition(async () => {
      setError(null);
      const result = await createStop({
        itinerary_id: itinerary.id,
        type: "other",
        title: `Back to ${target.label}`,
        location_id: target.location_id,
        customer_id: target.customer_id,
        customer_site_id: target.customer_site_id,
      });
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      const newStop = result.value;
      const precedingStop = sortedStops[sortedStops.length - 1];
      if (precedingStop) {
        await upsertTransition({
          itinerary_id: itinerary.id,
          from_stop_id: precedingStop.id,
          to_stop_id: newStop.id,
        });
      }
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
                          {stop.is_time_fixed ? (
                            <span title="Time is fixed (anchor)" aria-label="anchor">
                              📌{" "}
                            </span>
                          ) : null}
                          {fmtTime(stop.start_time, timezone)}
                          {stop.end_time && stop.end_time !== stop.start_time
                            ? ` – ${fmtTime(stop.end_time, timezone)}`
                            : ""}
                        </p>
                        {i === 0 &&
                        !stop.is_time_fixed &&
                        stop.start_time ? (
                          <p className="tiny" style={{ color: "var(--rust)" }}>
                            Leave by {fmtTime(stop.start_time, timezone)}
                          </p>
                        ) : null}
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
                    <LegCard
                      transition={transitionToNext}
                      legs={legsByTransition.get(transitionToNext.id) ?? []}
                      pending={pending}
                      onSetMode={(mode) =>
                        handleSetMode(transitionToNext.id, mode)
                      }
                    />
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
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="btn-terra"
            disabled={pending}
          >
            + Add point
          </button>
          {returnToTarget ? (
            <button
              type="button"
              onClick={() => handleReturnTo(returnToTarget)}
              className="btn-ghost"
              disabled={pending}
              title="Add a back-hop to the previous place"
            >
              ↩ Return to {returnToTarget.label}
            </button>
          ) : null}
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

const LEG_TYPE_ICON: Record<string, string> = {
  walk: "🚶",
  drive: "🚗",
  taxi: "🚕",
  bus: "🚌",
  train: "🚆",
  wait: "⏱",
  meeting: "🤝",
  buffer: "·",
};

function LegCard({
  transition,
  legs,
  pending,
  onSetMode,
}: {
  transition: TransitionRow;
  legs: JourneyLegRow[];
  pending: boolean;
  onSetMode: (mode: TransitionMode) => void;
}) {
  const mapSrc = transition.overview_polyline
    ? buildClientStaticMapUrl({
        width: 480,
        height: 140,
        paths: [
          {
            encoded: transition.overview_polyline,
            color: "c25c3a",
            weight: 4,
          },
        ],
      })
    : null;

  return (
    <div className="my-3 ml-4 rounded-md border border-rule/60 bg-card-2/40 p-3 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <span className="uc">via</span>
        <select
          value={transition.mode}
          disabled={pending}
          onChange={(e) => onSetMode(e.target.value as TransitionMode)}
          className="input-base"
          style={{ width: "auto", padding: "4px 8px", fontSize: 12 }}
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
        {transition.computed_duration_minutes ? (
          <span className="mono text-ink-dim">
            {transition.computed_duration_minutes} min
          </span>
        ) : null}
        {transition.distance_miles ? (
          <span className="mono text-ink-dim">
            {Number(transition.distance_miles).toFixed(1)} mi
          </span>
        ) : null}
      </div>

      {legs.length > 1 ? (
        <ol className="mb-2 flex flex-col gap-1">
          {legs.map((l) => (
            <li
              key={l.id}
              className="flex items-baseline gap-2 text-xs"
              style={{ color: "var(--ink-dim)" }}
            >
              <span aria-hidden>{LEG_TYPE_ICON[l.leg_type] ?? "·"}</span>
              <span className="mono">
                {l.duration_minutes ? `${l.duration_minutes}m` : ""}
              </span>
              <span className="truncate">
                {l.service_number
                  ? `${l.service_number}: ${l.start_location_name ?? ""} → ${l.end_location_name ?? ""}`
                  : (l.instructions ?? l.start_location_name ?? l.leg_type)}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {mapSrc ? (
        <img
          src={mapSrc}
          alt="Route map"
          className="block w-full rounded border border-rule"
          style={{ aspectRatio: "480 / 140", objectFit: "cover" }}
        />
      ) : null}
    </div>
  );
}

// Client-safe builder for /api/maps/static URLs (mirrors the server-side
// StaticMap component but uses btoa instead of Buffer).
function buildClientStaticMapUrl(spec: {
  width: number;
  height: number;
  zoom?: number;
  center?: { lat: number; lng: number };
  paths?: { encoded: string; color?: string; weight?: number }[];
}): string {
  const json = JSON.stringify({ ...spec, markers: [] });
  // base64url encode
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `/api/maps/static?s=${b64}`;
}

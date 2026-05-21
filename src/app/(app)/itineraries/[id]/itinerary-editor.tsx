"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, useMemo, useEffect, useRef } from "react";
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
import {
  AddTransportBookingForm,
  type TransportBookingMode,
} from "./add-transport-booking-form";
import { AddAccommodationBookingForm } from "./add-accommodation-booking-form";
import { DeleteItineraryButton } from "@/components/delete-itinerary-button";
import { TransportIcon, StopIcon } from "@/components/icons";

// Inline icons — line-art style matching the warm editorial design.
const Icon = {
  home: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" /></svg>
  ),
  train: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="3" width="14" height="14" rx="3" /><path d="M5 11h14M9 21l-2-3M15 21l2-3" /><circle cx="9" cy="14" r="0.8" fill="currentColor" /><circle cx="15" cy="14" r="0.8" fill="currentColor" /></svg>
  ),
  car: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 13l2-5a3 3 0 0 1 3-2h8a3 3 0 0 1 3 2l2 5v5h-3v-2H6v2H3z" /><circle cx="7.5" cy="15" r="1.2" /><circle cx="16.5" cy="15" r="1.2" /></svg>
  ),
  walk: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="13" cy="4.5" r="1.5" /><path d="M9 21l3-6 2 2 3 4M9 13l3-4 3 2" /></svg>
  ),
  pin: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s-7-7.5-7-13a7 7 0 1 1 14 0c0 5.5-7 13-7 13z" /><circle cx="12" cy="9" r="2.3" /></svg>
  ),
  bed: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5M3 18h18M3 18v2M21 18v2M7 11V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3" /></svg>
  ),
  fork: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v8a3 3 0 0 0 3 3v7M8 3v5M11 3v5M16 3c-2 0-2 5 0 8v10" /></svg>
  ),
  ticket: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-2z" /><path d="M9 7v10" strokeDasharray="2 2" /></svg>
  ),
  flag: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 22V4M5 4h11l-2 3 2 3H5" /></svg>
  ),
  plane: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 14l20-7-7 18-3-7z" /></svg>
  ),
  handshake: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10l4-4 3 3 3-3 4 4M3 14l5 5 4-4 4 4 5-5" /></svg>
  ),
  plus: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
  ),
  arrow: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  ),
  back: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
  ),
  copy: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V6a2 2 0 0 1 2-2h10" /></svg>
  ),
};

const STOP_ICON: Record<StopType, React.ReactNode> = {
  start: Icon.home,
  end: Icon.flag,
  appointment: Icon.handshake,
  accommodation: Icon.bed,
  event: Icon.ticket,
  meal: Icon.fork,
  transport_booked: Icon.train,
  transit_arrival: Icon.plane,
  other: Icon.pin,
};

const STOP_LABEL: Record<StopType, string> = {
  start: "Start",
  end: "End",
  appointment: "On-site",
  accommodation: "Check-in",
  event: "Event",
  meal: "Meal",
  transport_booked: "Transport",
  transit_arrival: "Arrive",
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

const MODE_ICON: Record<TransitionMode, React.ReactNode> = {
  walk: Icon.walk,
  drive: Icon.car,
  taxi: Icon.car,
  bus: Icon.car,
  tube: Icon.train,
  train: Icon.train,
  flight: Icon.plane,
  mixed: Icon.arrow,
};

const STATUS_SB: Record<ItineraryStatus, string> = {
  draft: "sb-draft",
  planning: "sb-planning",
  planned: "sb-planned",
  in_progress: "sb-progress",
  completed: "sb-done",
  cancelled: "sb-cancelled",
};

// 'draft' is retired in migration 0013 — kept in the type union for
// legacy rows, but the flow / labels no longer surface it. Anything
// still holding 'draft' will fall through STATUS_LABEL's lookup and
// display as the type's string itself; advance-status won't offer it
// as a next step either.
const STATUS_FLOW: ItineraryStatus[] = [
  "planning",
  "planned",
  "in_progress",
  "completed",
];

const STATUS_LABEL: Record<ItineraryStatus, string> = {
  draft: "Planning",
  planning: "Planning",
  planned: "Planned",
  in_progress: "Live now",
  completed: "Completed",
  cancelled: "Cancelled",
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
  location: {
    name?: string;
    type?: string;
    address?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  customer: { name?: string } | null;
  customer_site: {
    name?: string;
    address?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
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
  totals,
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
  totals: { cost: number; currency: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [transportBookingFor, setTransportBookingFor] = useState<{
    stopId: string;
    label: string;
    mode: TransportBookingMode;
  } | null>(null);
  const [accommodationBookingFor, setAccommodationBookingFor] = useState<{
    afterStopId?: string;
    afterStopLabel?: string;
    existingStopId?: string;
  } | null>(null);

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
      // Legacy draft rows fold straight into planning, same as any
      // brief submit would today.
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

  // ------------------------------------------------------------------
  // Derived data for the editorial masthead + digest panel
  // ------------------------------------------------------------------

  // Primary "subject" of the itinerary: pull customer / customer-site
  // from the first appointment we find. Falls back to itinerary.title.
  const subject = useMemo(() => {
    const appt = sortedStops.find(
      (s) => s.type === "appointment" && (s.customer?.name || s.customer_site?.name),
    );
    const customerName = appt?.customer?.name ?? null;
    const siteName = appt?.customer_site?.name ?? null;
    const siteAddress = appt?.customer_site?.address ?? null;
    // Try to extract a "city · region" from the site address tail.
    let placePart: string | null = null;
    if (siteAddress) {
      const parts = siteAddress.split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        // Last two parts (e.g. "Belper", "Derbyshire") — drop postcode-y ones.
        const tail = parts.slice(-2).filter((p) => !/^[A-Z]{1,2}\d/.test(p));
        placePart = tail.join(" · ") || null;
      } else if (parts[0]) {
        placePart = parts[0];
      }
    }
    return { customerName, siteName, placePart };
  }, [sortedStops]);

  // Tally totals from transitions
  const totalMinutes = useMemo(
    () =>
      transitions.reduce(
        (sum, t) => sum + (Number(t.computed_duration_minutes) || 0),
        0,
      ),
    [transitions],
  );
  const totalMiles = useMemo(
    () =>
      transitions.reduce(
        (sum, t) => sum + (Number(t.distance_miles) || 0),
        0,
      ),
    [transitions],
  );
  const stopCount = useMemo(
    () =>
      sortedStops.filter(
        (s) => s.type !== "start" && s.type !== "end",
      ).length,
    [sortedStops],
  );

  // On-site window — first / last appointment times
  const onSiteWindow = useMemo(() => {
    const appts = sortedStops.filter((s) => s.type === "appointment");
    if (appts.length === 0) return null;
    const first = appts[0].start_time;
    const last =
      appts[appts.length - 1].end_time ?? appts[appts.length - 1].start_time;
    return { from: first, to: last };
  }, [sortedStops]);

  // Map URL — markers from stops w/ coords + paths from transition polylines.
  // Coordinates come from customer_site → location.
  const mapUrl = useMemo(() => {
    const markers: { lat: number; lng: number; label?: string }[] = [];
    sortedStops.forEach((s, i) => {
      const lat =
        s.customer_site?.latitude ?? s.location?.latitude ?? null;
      const lng =
        s.customer_site?.longitude ?? s.location?.longitude ?? null;
      if (lat != null && lng != null) {
        markers.push({
          lat: Number(lat),
          lng: Number(lng),
          label: String(i + 1),
        });
      }
    });
    const paths = transitions
      .filter((t) => t.overview_polyline)
      .map((t) => ({
        encoded: t.overview_polyline!,
        color: "c25c3a",
        weight: 3,
      }));
    if (markers.length === 0 && paths.length === 0) return null;
    return buildClientStaticMapUrl({
      width: 320,
      height: 320,
      markers,
      paths,
    });
  }, [sortedStops, transitions]);

  const currentStatusIndex = STATUS_FLOW.indexOf(itinerary.status);
  const canAdvance =
    itinerary.status !== "completed" &&
    itinerary.status !== "cancelled" &&
    currentStatusIndex >= 0 &&
    currentStatusIndex < STATUS_FLOW.length - 1;
  const nextStatus =
    canAdvance ? STATUS_FLOW[currentStatusIndex + 1] : null;

  const dateLabel = formatDate(itinerary.date_start, timezone, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const dateNumeric = formatDate(itinerary.date_start, timezone, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div>
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-7">
        <FormError message={error ?? undefined} />

        {/* ── Eyebrow: back link + status flow ───────────────────────── */}
        <div className="eyebrow-row">
          <Link
            href="/itineraries"
            className="action-link"
            style={{ padding: 0 }}
          >
            {Icon.back}
            <span>All itineraries</span>
          </Link>
          <span className="eyebrow-rule" />
          <div className="statusflow">
            {STATUS_FLOW.map((s, i) => {
              const state =
                i < currentStatusIndex
                  ? "past"
                  : i === currentStatusIndex
                    ? "current"
                    : "future";
              return (
                <span key={s} className="contents">
                  <span
                    className="statusflow-step"
                    data-state={state}
                  >
                    {STATUS_LABEL[s]}
                  </span>
                  {i < STATUS_FLOW.length - 1 ? (
                    <span className="statusflow-sep">›</span>
                  ) : null}
                </span>
              );
            })}
          </div>
        </div>

        {/* ── Masthead: headline + standfirst + stat columns ─────────── */}
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
          <div className="flex flex-col gap-4">
            <h1 className="masthead-title">
              <MastheadHeadline
                customerName={subject.customerName}
                placePart={subject.placePart}
                fallback={itinerary.title}
                date={dateLabel}
              />
            </h1>
            {itinerary.notes ? (
              <p className="standfirst">{itinerary.notes}</p>
            ) : null}
          </div>

          <div className="flex items-end justify-start gap-6 lg:justify-end">
            <div className="stat-col">
              <span className="v">{stopCount}</span>
              <span className="l">{stopCount === 1 ? "stop" : "stops"}</span>
            </div>
            <div className="stat-col">
              <span className="v">{Math.round(totalMiles)}</span>
              <span className="l">miles</span>
            </div>
            <div className="stat-col">
              <span className="v">{fmtDuration(totalMinutes)}</span>
              <span className="l">time</span>
            </div>
            {totals.cost > 0 ? (
              <div className="stat-col">
                <span className="v">{fmtCurrency(totals.cost, totals.currency)}</span>
                <span className="l">cost</span>
              </div>
            ) : null}
          </div>
        </section>

        {/* ── Primary action row ─────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          {nextStatus ? (
            <button
              type="button"
              onClick={handleAdvanceStatus}
              disabled={pending}
              className="btn-primary"
            >
              Advance to {STATUS_LABEL[nextStatus].toLowerCase()}
              {Icon.arrow}
            </button>
          ) : null}
          <span className={`sb ${STATUS_SB[itinerary.status]}`}>
            {STATUS_LABEL[itinerary.status]}
          </span>
          <span style={{ marginLeft: "auto" }}>
            <DeleteItineraryButton
              id={itinerary.id}
              title={itinerary.title ?? "this itinerary"}
              redirectTo="/itineraries"
            />
          </span>
        </div>

        {/* ── Two-column body: timeline + map/digest sidebar ─────────── */}
        <div className="editor-grid">
          {/* Left: day header + stops timeline */}
          <div className="flex flex-col">
            <div className="day-header">
              <span className="label">Day 1</span>
              <span className="title">{dateLabel.split(",")[0]}</span>
              <span className="meta">{dateNumeric}</span>
            </div>

            {sortedStops.length === 0 ? (
              <div className="j-card-soft mt-4 p-6 text-center">
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
                  return (
                    <li key={stop.id} className="flex flex-col">
                      <StopRowView
                        stop={stop}
                        index={i}
                        isFirst={i === 0}
                        isLast={!next}
                        timezone={timezone}
                        pending={pending}
                        onDelete={handleDelete}
                        onAddTransport={(mode, label) =>
                          setTransportBookingFor({
                            stopId: stop.id,
                            label,
                            mode,
                          })
                        }
                        onAddAccommodation={(label) =>
                          setAccommodationBookingFor({
                            afterStopId: stop.id,
                            afterStopLabel: label,
                            existingStopId:
                              stop.type === "accommodation"
                                ? stop.id
                                : undefined,
                          })
                        }
                      />
                      {next && transitionToNext ? (
                        <TransitionRowView
                          transition={transitionToNext}
                          legs={legsByTransition.get(transitionToNext.id) ?? []}
                          pending={pending}
                          onSetMode={(mode) =>
                            handleSetMode(transitionToNext.id, mode)
                          }
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}

            {/* Footer actions */}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule pt-5">
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
                <>
                  <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="btn-terra"
                    disabled={pending}
                  >
                    {Icon.plus}
                    Add point
                  </button>
                  {returnToTarget ? (
                    <button
                      type="button"
                      onClick={() => handleReturnTo(returnToTarget)}
                      className="btn-ghost"
                      disabled={pending}
                      title="Add a back-hop to the previous place"
                    >
                      {Icon.back}
                      Return to {returnToTarget.label}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {/* Right: map + day digest */}
          <aside className="flex flex-col gap-5">
            {mapUrl ? (
              <div className="overflow-hidden rounded-md border border-rule bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mapUrl}
                  alt="Route map"
                  className="block w-full"
                  style={{ aspectRatio: "1 / 1", objectFit: "cover" }}
                />
              </div>
            ) : (
              <div
                className="flex h-[320px] items-center justify-center rounded-md border border-dashed border-rule-2 bg-card-2 text-center"
              >
                <span className="small px-6">
                  Map appears once stops have addresses.
                </span>
              </div>
            )}

            <div className="digest-panel">
              <div className="h">Day · digest</div>
              {onSiteWindow ? (
                <div className="row">
                  <span className="l">On-site window</span>
                  <span className="v">
                    {fmtTime(onSiteWindow.from, timezone)}
                    {onSiteWindow.to && onSiteWindow.to !== onSiteWindow.from
                      ? ` – ${fmtTime(onSiteWindow.to, timezone)}`
                      : ""}
                  </span>
                </div>
              ) : null}
              <div className="row">
                <span className="l">Travel time</span>
                <span className="v">{fmtDuration(totalMinutes)}</span>
              </div>
              <div className="row">
                <span className="l">Distance</span>
                <span className="v">{totalMiles.toFixed(1)} mi</span>
              </div>
              {totals.cost > 0 ? (
                <div className="row total">
                  <span className="l">Costs</span>
                  <span className="v">
                    {fmtCurrency(totals.cost, totals.currency)}
                  </span>
                </div>
              ) : (
                <div className="row">
                  <span className="l">Costs</span>
                  <span className="v" style={{ color: "var(--ink-faint)" }}>
                    —
                  </span>
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* Booking modal — transport */}
        {transportBookingFor ? (
          <div
            className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-ink/35 p-4 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setTransportBookingFor(null);
            }}
          >
            <div className="my-8 w-full max-w-3xl">
              <AddTransportBookingForm
                fromStopId={transportBookingFor.stopId}
                fromStopLabel={transportBookingFor.label}
                initialMode={transportBookingFor.mode}
                customers={customers}
                customerSites={customerSites}
                locations={locations}
                onCancel={() => setTransportBookingFor(null)}
                onDone={() => {
                  setTransportBookingFor(null);
                  router.refresh();
                }}
              />
            </div>
          </div>
        ) : null}

        {/* Booking modal — accommodation */}
        {accommodationBookingFor ? (
          <div
            className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-ink/35 p-4 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setAccommodationBookingFor(null);
            }}
          >
            <div className="my-8 w-full max-w-3xl">
              <AddAccommodationBookingForm
                afterStopId={accommodationBookingFor.afterStopId}
                afterStopLabel={accommodationBookingFor.afterStopLabel}
                existingStopId={accommodationBookingFor.existingStopId}
                customers={customers}
                customerSites={customerSites}
                locations={locations}
                onCancel={() => setAccommodationBookingFor(null)}
                onDone={() => {
                  setAccommodationBookingFor(null);
                  router.refresh();
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MastheadHeadline({
  customerName,
  placePart,
  fallback,
  date,
}: {
  customerName: string | null;
  placePart: string | null;
  fallback: string | null;
  date: string;
}) {
  if (customerName) {
    return (
      <>
        <em>{customerName}</em>
        {placePart ? (
          <>
            <span style={{ color: "var(--ink)" }}>,</span>{" "}
            <span style={{ color: "var(--ink)" }}>{placePart}.</span>
          </>
        ) : (
          <span style={{ color: "var(--ink)" }}>.</span>
        )}
      </>
    );
  }
  if (fallback) {
    return <>{fallback}</>;
  }
  return <em>{date}</em>;
}

function StopRowView({
  stop,
  index,
  isFirst,
  isLast,
  timezone,
  pending,
  onDelete,
  onAddTransport,
  onAddAccommodation,
}: {
  stop: StopRow;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  timezone: string;
  pending: boolean;
  onDelete: (id: string) => void;
  onAddTransport: (mode: TransportBookingMode, label: string) => void;
  onAddAccommodation: (label: string) => void;
}) {
  const customerLabel = stop.customer?.name ?? null;
  const siteLabel = stop.customer_site?.name ?? null;
  const locationLabel = stop.location?.name ?? null;
  const addressLabel =
    stop.customer_site?.address ?? stop.location?.address ?? null;

  const isAppointment = stop.type === "appointment";
  const titleLine =
    stop.title ??
    siteLabel ??
    customerLabel ??
    locationLabel ??
    STOP_LABEL[stop.type];

  // Subline: place reference (address / station code etc.)
  const subline =
    customerLabel && titleLine !== customerLabel
      ? customerLabel
      : addressLabel
        ? addressLabel
        : null;

  const dotClass = isAppointment ? "tl-dot terra" : "tl-dot";

  return (
    <div className="tl">
      <div className="tl-time">
        {fmtTime(stop.start_time, timezone)}
      </div>
      <div className="tl-rail">
        <span className={dotClass}>{STOP_ICON[stop.type]}</span>
      </div>
      <div className="tl-content">
        <div className={isAppointment ? "appt-block" : ""}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="tl-eyebrow">
                {STOP_LABEL[stop.type]}
                {isFirst ? " · home" : null}
                {isLast && !isFirst ? " · finish" : null}
              </p>
              <h3 className="tl-title">
                {isAppointment ? <em>{titleLine}</em> : titleLine}
              </h3>
              {subline ? <p className="tl-sub">{subline}</p> : null}
              {stop.duration_minutes && isAppointment ? (
                <p className="tl-sub mono">
                  {fmtDuration(stop.duration_minutes)}
                  {siteLabel && titleLine !== siteLabel
                    ? ` · ${siteLabel}`
                    : ""}
                </p>
              ) : null}
              {stop.external_reference ? (
                <p className="tl-sub mono">
                  Ref {stop.external_reference}
                </p>
              ) : null}
              {(stop.metadata?.flight_iata as string | undefined) ? (
                <p className="tl-sub mono">
                  Flight {String(stop.metadata?.flight_iata)}
                </p>
              ) : null}
              {stop.notes ? (
                <p className="tl-sub line-clamp-3">{stop.notes}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {stop.end_time && stop.end_time !== stop.start_time ? (
                <p className="mono text-xs text-ink-dim">
                  → {fmtTime(stop.end_time, timezone)}
                </p>
              ) : null}
              {stop.is_time_fixed ? (
                <span
                  className="mono text-[10px] uppercase tracking-wider text-ink-dim"
                  title="Time is fixed"
                >
                  fixed
                </span>
              ) : null}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
            <StopBookingMenu
              stop={stop}
              pending={pending}
              onAddTransport={onAddTransport}
              onAddAccommodation={onAddAccommodation}
            />
            {!isFirst ? (
              <button
                type="button"
                className="text-xs text-ink-dim hover:text-rust hover:underline disabled:opacity-50"
                onClick={() => onDelete(stop.id)}
                disabled={pending}
              >
                Delete
              </button>
            ) : null}
            <span className="sr-only">Stop {index + 1}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StopBookingMenu({
  stop,
  pending,
  onAddTransport,
  onAddAccommodation,
}: {
  stop: StopRow;
  pending: boolean;
  onAddTransport: (mode: TransportBookingMode, label: string) => void;
  onAddAccommodation: (label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const label =
    stop.customer_site?.name ??
    stop.customer?.name ??
    stop.location?.name ??
    stop.title ??
    "this point";

  const isStation = stop.location?.type === "station";

  const items: { mode: TransportBookingMode; label: string }[] = [
    { mode: "train", label: "Train" },
    { mode: "flight", label: "Flight" },
    { mode: "taxi", label: "Taxi" },
    { mode: "bus", label: "Bus" },
    { mode: "tube", label: "Tube" },
    { mode: "drive", label: "Car hire" },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="text-xs hover:underline disabled:opacity-50"
        style={{ color: "var(--gold-2)" }}
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
      >
        + Add booking
      </button>
      {open ? (
        <div
          className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-md border border-rule bg-card shadow-lg"
          role="menu"
        >
          {isStation ? (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-xs hover:bg-gold-soft/40"
              style={{ background: "var(--gold-soft)" }}
              onClick={() => {
                setOpen(false);
                onAddTransport("train", label);
              }}
            >
              <span className="mr-2 inline-flex align-middle" style={{ color: "var(--gold-2)" }}>
                <TransportIcon.train size={13} />
              </span>
              Train (from {stop.location?.name ?? "station"})
            </button>
          ) : null}
          {items.map((it) => {
            const ItemIcon =
              it.mode === "train"
                ? TransportIcon.train
                : it.mode === "flight"
                  ? TransportIcon.flight
                  : it.mode === "taxi"
                    ? TransportIcon.taxi
                    : it.mode === "bus"
                      ? TransportIcon.bus
                      : it.mode === "tube"
                        ? TransportIcon.tube
                        : TransportIcon.drive;
            return (
              <button
                key={it.mode}
                type="button"
                role="menuitem"
                className="block w-full border-t border-rule/50 px-3 py-2 text-left text-xs hover:bg-card-2"
                onClick={() => {
                  setOpen(false);
                  onAddTransport(it.mode, label);
                }}
              >
                <span
                  className="mr-2 inline-flex align-middle"
                  style={{ color: "var(--ink-dim)" }}
                >
                  <ItemIcon size={13} />
                </span>
                {it.label}
              </button>
            );
          })}
          <button
            type="button"
            role="menuitem"
            className="block w-full border-t border-rule/50 px-3 py-2 text-left text-xs hover:bg-card-2"
            onClick={() => {
              setOpen(false);
              onAddAccommodation(label);
            }}
          >
            <span
              className="mr-2 inline-flex align-middle"
              style={{ color: "var(--ink-dim)" }}
            >
              <StopIcon.stay size={13} />
            </span>
            {stop.type === "accommodation" ? "Edit stay" : "Hotel / stay"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TransitionRowView({
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
  const isTrain = transition.mode === "train" || transition.mode === "tube";
  const mins = transition.computed_duration_minutes ?? 0;
  const miles = Number(transition.distance_miles ?? 0);

  // For train transitions, surface service info from the first leg
  const trainLeg = legs.find((l) => l.leg_type === "train");

  return (
    <div className="tl-transition">
      <div></div>
      <div className="tl-rail" style={{ minHeight: 36 }} />
      <div className="tl-transition-body">
        <span className="inline-flex items-center gap-1.5 text-ink-2">
          {MODE_ICON[transition.mode]}
          <span className="tl-transition-mode">
            {MODE_LABEL[transition.mode]}
          </span>
        </span>
        {mins ? (
          <span className="tl-transition-meta">{fmtDuration(mins)}</span>
        ) : null}
        {miles ? (
          <span className="tl-transition-meta">
            {miles.toFixed(1)} mi
          </span>
        ) : null}
        {isTrain && trainLeg ? (
          <span className="tl-transition-meta">
            {trainLeg.start_location_name && trainLeg.end_location_name
              ? `${trainLeg.start_location_name} → ${trainLeg.end_location_name}`
              : (trainLeg.service_number ?? "")}
          </span>
        ) : null}
        {transition.is_locked ? (
          <span className="sb sb-booked">Booked</span>
        ) : (
          <select
            value={transition.mode}
            disabled={pending}
            onChange={(e) => onSetMode(e.target.value as TransitionMode)}
            className="input-base"
            style={{
              width: "auto",
              padding: "2px 6px",
              fontSize: 11,
              background: "transparent",
              border: "1px solid var(--rule)",
            }}
          >
            {(
              ["walk", "drive", "taxi", "bus", "tube", "train", "flight"] as TransitionMode[]
            ).map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </select>
        )}
        <span className="tl-transition-chev">›</span>
      </div>
    </div>
  );
}

function fmtDuration(minutes: number): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}

function formatDate(
  iso: string,
  tz: string,
  opts: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: tz }).format(
    new Date(iso),
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

// Inline icon component for journey-leg sub-rows. Hands back a tiny
// SVG (or a · for "buffer") so we never render an emoji into the UI.
function LegTypeIcon({ leg }: { leg: string }) {
  const props = { size: 12 } as const;
  switch (leg) {
    case "walk":
      return <TransportIcon.walk {...props} />;
    case "drive":
      return <TransportIcon.drive {...props} />;
    case "taxi":
      return <TransportIcon.taxi {...props} />;
    case "bus":
      return <TransportIcon.bus {...props} />;
    case "train":
      return <TransportIcon.train {...props} />;
    case "wait":
      return <StopIcon.wait {...props} />;
    case "meeting":
      return <StopIcon.appointment {...props} />;
    default:
      return <span aria-hidden>·</span>;
  }
}

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
        {transition.is_locked ? (
          <span
            className="uc"
            title="Locked — driven by a booked ticket"
            style={{ color: "var(--rust)" }}
          >
            🔒 booked
          </span>
        ) : null}
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
              <span aria-hidden style={{ display: "inline-flex", color: "var(--ink-dim)" }}>
                <LegTypeIcon leg={l.leg_type} />
              </span>
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
  markers?: { lat: number; lng: number; color?: string; label?: string }[];
  paths?: { encoded: string; color?: string; weight?: number }[];
}): string {
  const json = JSON.stringify({
    ...spec,
    markers: spec.markers ?? [],
    paths: spec.paths ?? [],
    // Pin the inline route maps to the Journies map style so the warm
    // editorial palette carries into every embedded map.
    style: "journies",
  });
  // base64url encode
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `/api/maps/static?s=${b64}`;
}

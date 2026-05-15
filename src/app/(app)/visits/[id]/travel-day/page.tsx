import { notFound } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { formatDateInTz, formatTimeInTz } from "@/lib/types/time";
import { annotateLegs, pacing, type Leg } from "@/lib/state/trip-progress";
import { TripControls } from "./trip-controls";

const LEG_ICON: Record<string, string> = {
  walk: "🚶",
  drive: "🚗",
  train: "🚆",
  bus: "🚌",
  taxi: "🚖",
  wait: "⏳",
  meeting: "🤝",
  buffer: "·",
};

export default async function TravelDayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const wsCfg = await getWorkspaceConfig(ctx.workspaceId);

  const { data: visit } = await supabase
    .from("visit_plans")
    .select(
      `id, title, status, proposed_start_time,
       customer:customers(name),
       customer_site:customer_sites(name, address),
       saved_trip:saved_trips(id, status, selected_travel_option_id)`,
    )
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  if (!visit) notFound();

  const tripData = visit.saved_trip as unknown as {
    id: string;
    status: "upcoming" | "ready" | "in_progress" | "completed" | "cancelled";
    selected_travel_option_id: string | null;
  } | null;

  if (!tripData) {
    return (
      <PageShell
        title="Travel day"
        description="Available once you confirm a travel option for this visit."
        actions={
          <Link href={`/visits/${id}`} className="btn-ghost">
            Back to visit
          </Link>
        }
      >
        <div className="j-card-soft p-6">
          <p className="body">
            This visit hasn&apos;t been confirmed yet. Pick a travel option and
            confirm it, then come back here on the day.
          </p>
          <Link href={`/visits/${id}`} className="btn-terra mt-3 inline-flex">
            Open visit
          </Link>
        </div>
      </PageShell>
    );
  }

  const { data: option } = await supabase
    .from("travel_options")
    .select(
      `id, mode,
       leave_origin_at, arrive_site_at, meeting_start_at, meeting_end_at,
       leave_site_at, arrive_return_location_at,
       total_cost_estimate, currency,
       journey_legs(
         id, sequence, leg_type, start_location_name, end_location_name,
         start_time, end_time, duration_minutes, distance_miles, instructions,
         provider, service_number
       )`,
    )
    .eq("id", tripData.selected_travel_option_id ?? "")
    .maybeSingle();

  if (!option) {
    return (
      <PageShell title="Travel day" description="Selected travel option not found.">
        <div className="j-card-soft p-6">
          <p className="body">
            We couldn&apos;t find the selected travel option. Try opening the
            visit and confirming again.
          </p>
        </div>
      </PageShell>
    );
  }

  const customer =
    (visit.customer as unknown as { name?: string } | null)?.name ?? "Customer";
  const site = visit.customer_site as unknown as
    | { name?: string; address?: string }
    | null;

  const now = new Date();
  const annotated = annotateLegs(
    ((option.journey_legs ?? []) as unknown as Leg[]),
    now,
  );
  const trip = pacing(annotated, now);

  const focusLeg =
    annotated.find((l) => l.phase === "current") ??
    annotated.find((l) => l.phase === "next") ??
    annotated[0];

  const tripStatus = tripData.status;
  const isUpcoming = tripStatus === "upcoming" || tripStatus === "ready";
  const isInProgress = tripStatus === "in_progress";
  const isComplete = tripStatus === "completed";

  return (
    <PageShell
      title="Travel day"
      description={`${customer}${
        visit.proposed_start_time
          ? ` · ${formatDateInTz(new Date(visit.proposed_start_time), wsCfg.timezone)}`
          : ""
      }`}
      actions={
        <Link href={`/visits/${id}`} className="btn-ghost">
          Back to visit
        </Link>
      }
    >
      {/* Hero / current step */}
      <section
        className="rounded-md p-6"
        style={{
          background: isComplete
            ? "var(--sage-2)"
            : isInProgress
              ? "var(--ink)"
              : "var(--card)",
          color: isInProgress ? "var(--paper)" : "var(--ink)",
          border: isInProgress ? "none" : "1px solid var(--rule)",
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p
              className="uc"
              style={{
                color: isInProgress ? "rgba(244,240,231,0.7)" : "var(--ink-dim)",
              }}
            >
              {isComplete
                ? "Trip completed"
                : isInProgress
                  ? "In progress"
                  : trip.status === "before"
                    ? "Not started"
                    : "Confirmed"}
            </p>
            <h2 className="h2" style={{ color: "inherit" }}>
              {isComplete
                ? "Done."
                : focusLeg
                  ? buildHeroTitle(focusLeg, wsCfg.timezone)
                  : "Plan is empty"}
            </h2>
            {focusLeg && !isComplete ? (
              <p
                className="body"
                style={{
                  color: isInProgress
                    ? "rgba(244,240,231,0.85)"
                    : undefined,
                }}
              >
                {buildHeroSubtitle(focusLeg, trip.message, wsCfg.timezone)}
              </p>
            ) : null}
          </div>
          <TripControls
            savedTripId={tripData.id}
            canStart={isUpcoming}
            canComplete={isInProgress}
          />
        </div>
      </section>

      {/* Visit context */}
      <section className="j-card grid gap-4 p-5 sm:grid-cols-3">
        <div>
          <p className="uc mb-1">Customer</p>
          <p className="font-medium">{customer}</p>
          {site?.name ? <p className="small">{site.name}</p> : null}
          {site?.address ? <p className="small">{site.address}</p> : null}
        </div>
        <div>
          <p className="uc mb-1">Meeting</p>
          <p className="mono text-lg">
            {fmt(option.meeting_start_at, wsCfg.timezone)} –{" "}
            {fmt(option.meeting_end_at, wsCfg.timezone)}
          </p>
        </div>
        <div>
          <p className="uc mb-1">Home by</p>
          <p className="mono text-lg">
            {fmt(option.arrive_return_location_at, wsCfg.timezone)}
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section className="flex flex-col gap-3">
        <h2 className="h3">Step by step</h2>
        <ol className="flex flex-col">
          {annotated.map((l, i) => {
            const isCurrent = l.phase === "current" || l.phase === "next";
            const isPast = l.phase === "past";
            return (
              <li key={l.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium"
                    style={{
                      background: isCurrent
                        ? "var(--terra)"
                        : isPast
                          ? "var(--rule-2)"
                          : "var(--card-2)",
                      color: isCurrent
                        ? "#fff8ef"
                        : isPast
                          ? "var(--ink-dim)"
                          : "var(--ink-2)",
                      border: isCurrent ? "none" : "1px solid var(--rule)",
                    }}
                  >
                    {isPast ? "✓" : i + 1}
                  </div>
                  {i < annotated.length - 1 ? (
                    <div
                      className="w-px flex-1"
                      style={{
                        background: isPast ? "var(--rule-2)" : "var(--rule)",
                      }}
                    />
                  ) : null}
                </div>
                <div
                  className={`mb-3 flex-1 rounded-md border p-4 ${
                    isCurrent
                      ? "border-terra"
                      : isPast
                        ? "border-rule bg-card-2"
                        : "border-rule bg-card"
                  }`}
                  style={{ opacity: isPast ? 0.7 : 1 }}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">
                      <span className="mr-2">{LEG_ICON[l.leg_type] ?? "•"}</span>
                      <span className="capitalize">{l.leg_type}</span>
                      {l.start_location_name && l.end_location_name ? (
                        <span className="text-ink-dim">
                          {" "}
                          · {l.start_location_name} → {l.end_location_name}
                        </span>
                      ) : null}
                    </p>
                    <p className="mono text-xs">
                      {fmt(l.start_time, wsCfg.timezone)}–
                      {fmt(l.end_time, wsCfg.timezone)}
                      {l.duration_minutes ? ` · ${l.duration_minutes}m` : ""}
                    </p>
                  </div>
                  {l.service_number ? (
                    <p className="small mono mt-1">{l.service_number}</p>
                  ) : null}
                  {l.distance_miles ? (
                    <p className="small mt-1">
                      {l.distance_miles.toFixed(1)} miles
                    </p>
                  ) : null}
                  {l.instructions && !isPast ? (
                    <p className="small mt-1 italic">{l.instructions}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </PageShell>
  );
}

function buildHeroTitle(
  leg: ReturnType<typeof annotateLegs>[number],
  tz: string,
): string {
  const verb =
    leg.phase === "current" ? "Now" : leg.phase === "next" ? "Up next" : "Then";
  if (leg.leg_type === "meeting") {
    return `${verb}: meeting · ${fmt(leg.start_time, tz)}`;
  }
  if (leg.leg_type === "train") {
    return leg.start_location_name && leg.end_location_name
      ? `${verb}: train ${leg.start_location_name} → ${leg.end_location_name}`
      : `${verb}: train`;
  }
  if (leg.leg_type === "walk") {
    return `${verb}: walk to ${leg.end_location_name ?? "the next stop"}`;
  }
  if (leg.leg_type === "drive") {
    return `${verb}: drive to ${leg.end_location_name ?? "destination"}`;
  }
  return `${verb}: ${leg.leg_type}`;
}

function buildHeroSubtitle(
  leg: ReturnType<typeof annotateLegs>[number],
  pacingMessage: string,
  tz: string,
): string {
  if (leg.phase === "current") return pacingMessage;
  if (leg.phase === "next" && leg.start_time) {
    return `Leaves at ${fmt(leg.start_time, tz)} · ${pacingMessage}`;
  }
  return pacingMessage;
}

function fmt(iso: string | null, tz: string): string {
  if (!iso) return "—";
  return formatTimeInTz(new Date(iso), tz);
}

import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { isWelcomed } from "@/lib/welcome";
import { ActiveTile } from "@/components/concierge";
import type { AnchorVM, AnchorType, TicketVM } from "@/components/concierge";
import { projectToday, type ProjectionStop, type TodayUrgency } from "@/lib/planning/today";
import { loadJourneyTickets } from "@/lib/actions/wallet";
import { ticketUseMoment } from "@/components/concierge";
import { TodayDocument } from "@/components/today/today-document";
import { TodayPasses } from "@/components/today/today-passes";
import { OfflineTicketSync } from "@/components/offline/offline-ticket-sync";
import { NextMove } from "@/components/today/next-move";
import { TodaySpine } from "@/components/today/today-spine";
import { navModeForTransition, stationLabel, roleOf, type SpineAnchor } from "@/components/today/spine-model";
import { foldStopsToLegTickets } from "@/lib/tickets/from-stops";
import { TodayDemo } from "@/components/today/today-demo";
import { isDemoModeActive } from "@/lib/demo-mode";

const londonHHMM = (iso?: string | null) =>
  iso
    ? new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))
    : null;

// Today / Live — the day-of surface, rendered purely as a PROJECTION of the plan
// (proposal §7 / brief §8). Today projects EVERY Event whose span covers today —
// no "publish" toggle, no status trap (the lifecycle dead-end is gone) — and
// COMPOSES overlapping Events into one timeline (E1). The engine picks the state.

function mapStopType(type: string): AnchorType {
  if (type.includes("appointment")) return "appointment";
  if (type.includes("flight")) return "flight";
  if (type.includes("arrival") || type.includes("transit")) return "transport_arrival";
  if (type.includes("checkin") || type.includes("check_in")) return "accommodation_check_in";
  if (type.includes("checkout") || type.includes("check_out")) return "accommodation_check_out";
  if (type.includes("hotel") || type.includes("accommodation")) return "accommodation_check_in";
  return "custom";
}

type Geo = { name?: string; latitude?: number | null; longitude?: number | null } | null;
type Hub = (Geo & { code?: string | null; kind?: string | null }) | null;
type StopRow = {
  id: string;
  type: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  location: Geo;
  customer_site: Geo;
  transport_hub: Hub;
};

// First available coordinate — customer site, then saved location, then hub
// (mirrors pickPoint in transitions.ts). Drives true leave-by + Navigate.
function coordOf(s: StopRow): { lat: number; lng: number } | null {
  for (const c of [s.customer_site, s.location, s.transport_hub]) {
    if (c && c.latitude != null && c.longitude != null) return { lat: c.latitude, lng: c.longitude };
  }
  return null;
}
function placeOf(s: StopRow): string | undefined {
  return s.location?.name ?? s.customer_site?.name ?? s.transport_hub?.name ?? undefined;
}

const STATE_HEADLINE: Record<string, string> = {
  dormant: "Nothing in motion right now",
  readiness: "Getting you ready",
  "in-transit": "On your way",
  arrived: "You're here",
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isToday(iso: string | null, today: string): boolean {
  if (!iso) return false;
  return new Date(iso).toISOString().slice(0, 10) === today || ymd(new Date(iso)) === today;
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const ctx = await requireUserContext();

  // Staff day-of preview: a representative fixture so the live components can be
  // reviewed without a real plan in the DB. Reached via the Settings demo toggle
  // (global demo mode) or an explicit ?demo=1 (mirrors /wallet?demo=1).
  const sp = await searchParams;
  if ((ctx.isStaff && sp?.demo === "1") || (await isDemoModeActive())) return <TodayDemo />;

  const supabase = await createClient();

  if (!(await isWelcomed())) {
    const { count } = await supabase.from("itineraries").select("id", { count: "exact", head: true });
    if (!count) redirect("/welcome" as Route);
  }

  const now = new Date();
  const today = ymd(now);

  // Every Event whose span covers today — any active status (no publish toggle).
  const { data: events } = await supabase
    .from("itineraries")
    .select("id, title, mode, date_start, date_end, status")
    .eq("mode", ctx.activeMode)
    .lte("date_start", today)
    .gte("date_end", today)
    .in("status", ["draft", "planning", "planned", "in_progress"])
    .order("date_start", { ascending: true });

  const covering = events ?? [];

  // Compose today's slice across all covering Events (E1).
  const allStops: StopRow[] = [];
  const legFromStops = new Set<string>();
  // The plan's leg leading INTO a stop: travel minutes + mode, the offline
  // fallback for true leave-by and the default Navigate mode.
  const travelByToStop = new Map<string, { minutes: number | null; mode: string | null }>();
  let tickets: TicketVM[] = [];
  for (const ev of covering) {
    const [{ data: s }, { data: t }, jt] = await Promise.all([
      supabase
        .from("stops")
        .select(
          "id, type, title, start_time, end_time, location:locations(name, latitude, longitude), customer_site:customer_sites(name, latitude, longitude), transport_hub:transport_hubs(name, code, kind, latitude, longitude)",
        )
        .eq("itinerary_id", ev.id)
        .order("sequence"),
      supabase
        .from("transitions")
        .select("from_stop_id, to_stop_id, mode, computed_duration_minutes")
        .eq("itinerary_id", ev.id),
      loadJourneyTickets(ev.id),
    ]);
    for (const st of (s ?? []) as unknown as StopRow[]) {
      if (isToday(st.start_time, today)) allStops.push(st);
    }
    for (const tr of (t ?? []) as Array<{ from_stop_id: string; to_stop_id: string; mode: string | null; computed_duration_minutes: number | null }>) {
      legFromStops.add(tr.from_stop_id);
      if (tr.to_stop_id) travelByToStop.set(tr.to_stop_id, { minutes: tr.computed_duration_minutes, mode: tr.mode });
    }
    tickets = tickets.concat(jt);
  }

  allStops.sort((a, b) => {
    const ta = a.start_time ? new Date(a.start_time).getTime() : Infinity;
    const tb = b.start_time ? new Date(b.start_time).getTime() : Infinity;
    return ta - tb;
  });

  const anchors: AnchorVM[] = allStops.map((s) => ({
    id: s.id,
    type: mapStopType(s.type),
    title: s.title ?? placeOf(s) ?? "Stop",
    place: placeOf(s),
    time: s.start_time ? { from: s.start_time, to: s.end_time ?? undefined } : undefined,
    fixed: true,
  }));

  // Spine view-model: coordinates + planned leg time + nav mode per anchor.
  // Station stops resolve to the HUB — you walk to Harpenden Station, not to the
  // town centroid — so its coordinate is the nav target and its name the label.
  const spineAnchors: SpineAnchor[] = allStops.map((s) => {
    const leg = travelByToStop.get(s.id);
    const hub = s.transport_hub;
    const station =
      hub?.name
        ? { name: hub.name, code: hub.code ?? null, kind: (hub.kind === "airport" ? "airport" : "rail_station") as "airport" | "rail_station" }
        : null;
    const stationCoord =
      station && hub?.latitude != null && hub?.longitude != null ? { lat: hub.latitude, lng: hub.longitude } : null;
    return {
      id: s.id,
      type: mapStopType(s.type),
      title: station ? stationLabel(station.name, station.kind) : s.title ?? placeOf(s) ?? "Stop",
      place: station ? undefined : placeOf(s),
      arriveByIso: s.start_time,
      endIso: s.end_time,
      coord: stationCoord ?? coordOf(s),
      plannedTravelMinutes: leg?.minutes ?? null,
      navMode: navModeForTransition(leg?.mode),
      station,
      role: roleOf(s.type),
    };
  });

  const projStops: ProjectionStop[] = allStops.map((s) => ({
    id: s.id,
    title: s.title ?? s.location?.name ?? "Stop",
    start: s.start_time,
    end: s.end_time,
    hasLegAfter: legFromStops.has(s.id),
  }));
  const proj = projectToday(projStops, now.getTime());
  const nextAnchor = proj.nextIndex != null ? anchors[proj.nextIndex] : undefined;

  // True leave-by takes over the hero when the next anchor has the data to back
  // it (a location to route to, or a planned leg time). Otherwise the ActiveTile
  // keeps its planned leave-by so there's no regression on coordinate-less plans.
  const nextSpine = proj.nextIndex != null ? spineAnchors[proj.nextIndex] : null;
  const canLeaveBy = !!(nextSpine?.arriveByIso && (nextSpine.coord || nextSpine.plannedTravelMinutes != null));

  const nowMs = now.getTime();
  const nextTicket =
    tickets
      .map((tk) => ({ tk, m: ticketUseMoment(tk) }))
      .filter((x): x is { tk: TicketVM; m: string } => Boolean(x.m))
      .filter((x) => new Date(x.m).getTime() >= nowMs - 30 * 60000)
      .sort((a, b) => a.m.localeCompare(b.m))[0]?.tk ?? tickets[0];

  // Per-leg rail cards for the surfaced journey: each booked hop (the ticket id IS
  // the run's departure stop id) as its own live card — boarding station CRS +
  // planned departure feed the live Darwin lookup on the card itself.
  let legCards: Array<{ key: string; ticket: TicketVM; crs: string | null; time: string | null; dest: string | null }> | undefined;
  if (nextTicket) {
    const { data: depRow } = await supabase.from("stops").select("itinerary_id").eq("id", nextTicket.id).maybeSingle();
    if (depRow?.itinerary_id) {
      const { data: runStops } = await supabase
        .from("stops")
        .select("id, type, title, start_time, end_time, metadata, transport_hub:transport_hubs(code)")
        .eq("itinerary_id", depRow.itinerary_id)
        .order("sequence");
      const rows = (runStops ?? []) as unknown as Array<{
        id: string; type: string; title: string | null; start_time: string | null; end_time: string | null;
        metadata: Record<string, unknown> | null; transport_hub: { code?: string | null } | null;
      }>;
      const byId = new Map(rows.map((s) => [s.id, s]));
      legCards = foldStopsToLegTickets(
        rows.map((s) => ({ id: s.id, type: s.type, title: s.title, start_time: s.start_time, end_time: s.end_time, code: s.transport_hub?.code ?? null, metadata: s.metadata })),
      )
        .filter((lt) => lt.runDepartureStopId === nextTicket.id)
        .map((lt) => {
          const o = byId.get(lt.originStopId);
          const iso = o?.type === "transit_changeover" ? o.end_time : o?.start_time;
          return {
            key: lt.originStopId,
            ticket: lt.ticket,
            crs: o?.transport_hub?.code ?? null,
            time: londonHHMM(iso),
            dest: lt.ticket.legs[0]?.destination.code ?? null,
          };
        });
    }
  }

  const sub =
    covering.length === 1
      ? covering[0].title ?? undefined
      : covering.length > 1
        ? `${covering.length} plans today`
        : undefined;

  return (
    <div className="cc-screen">
      {/* Keep today's tickets on-device for the barrier (no-signal Aztec). */}
      <OfflineTicketSync tickets={tickets} />
      <header>
        <span className="cc-eyebrow">{ctx.activeMode === "work" ? "Work" : "Personal"} · Today</span>
        <h1 className="cc-screen-title" style={{ marginTop: 6 }}>
          Right now
        </h1>
      </header>

      {anchors.length ? (
        <>
          <ActiveTile
            headline={STATE_HEADLINE[proj.state] ?? "Your day"}
            sub={sub}
            nextAnchor={nextAnchor}
            leaveBy={canLeaveBy ? undefined : proj.leaveByIso ?? undefined}
            urgency={proj.urgency as TodayUrgency}
          />

          {canLeaveBy && nextSpine ? <NextMove anchor={nextSpine} /> : null}

          {(proj.state === "readiness" || proj.state === "in-transit") && nextTicket ? (
            legCards?.length ? (
              <TodayPasses legs={legCards} />
            ) : (
              <TodayDocument ticket={nextTicket} />
            )
          ) : null}

          <TodaySpine anchors={spineAnchors} nextId={nextSpine?.id ?? null} />

          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <Link href={"/plan" as Route} className="cc-btn cc-btn-gold">
              Open the plan
            </Link>
            <Link href={"/navigate" as Route} className="cc-btn">
              Navigate
            </Link>
          </div>
        </>
      ) : (
        <div className="cc-active-tile" data-urgency="comfortable">
          <span className="cc-at-status">
            <span className="cc-at-dot" />
            At rest
          </span>
          <h2 className="cc-at-headline">Nothing on today</h2>
          <p className="cc-at-sub">
            When a day you&apos;ve planned arrives, Khonsera brings it here — the next move, the
            leave-by, and the chain ahead.
          </p>
          <div style={{ marginTop: "var(--space-4)" }}>
            <Link href={"/plan" as Route} className="cc-btn cc-btn-gold">
              Open the plan
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

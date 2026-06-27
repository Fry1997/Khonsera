import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { isWelcomed } from "@/lib/welcome";
import type { AnchorVM, AnchorType, TicketVM } from "@/components/concierge";
import { projectToday, type ProjectionStop, type TodayUrgency } from "@/lib/planning/today";
import { loadJourneyTickets } from "@/lib/actions/wallet";
import { buildDayReview } from "@/lib/actions/review";
import { DayReviewCard } from "@/components/plan/day-review";
import { PlanCreate } from "@/components/plan/plan-create";
import { TflLineStatus } from "@/components/today/tfl-line-status";
import { getLocalWeather } from "@/lib/actions/weather";
import { TodayDisruption, type TodayDisruptionItem } from "@/components/today/today-disruption";
import { liveDeparture } from "@/lib/integrations/darwin";
import { delayConsequence } from "@/lib/live/engine";
import { ticketUseMoment } from "@/components/concierge";
import { TodayDocument } from "@/components/today/today-document";
import { OfflineTicketSync } from "@/components/offline/offline-ticket-sync";
import { LiveDay } from "@/components/today/live-day";
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
  // Stamped from the parent Event's work/personal tag as stops are composed —
  // the per-item classification the spine surfaces via ModeTag.
  mode?: "work" | "personal" | null;
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
    .lte("date_start", today)
    .gte("date_end", today)
    .in("status", ["draft", "planning", "planned", "in_progress"])
    .order("date_start", { ascending: true });

  const covering = events ?? [];

  // Night-before review (B3.6): a plan that BEGINS tomorrow gets a calm preview —
  // "here's tomorrow, here's when you leave, you're ready" — discharged the evening
  // before. (Only days starting tomorrow, so an in-progress trip isn't repeated.)
  const tomorrow = ymd(new Date(now.getTime() + 86_400_000));
  const { data: tmrwRows } = await supabase
    .from("itineraries")
    .select("id")
    .eq("date_start", tomorrow)
    .in("status", ["draft", "planning", "planned", "in_progress"])
    .order("date_start", { ascending: true })
    .limit(1);
  const tomorrowReview =
    tmrwRows && tmrwRows.length ? await buildDayReview(tmrwRows[0].id as string) : null;

  // Compose today's slice across all covering Events (E1).
  const allStops: StopRow[] = [];
  const legFromStops = new Set<string>();
  // The plan's leg leading INTO a stop: travel minutes + mode, the offline
  // fallback for true leave-by and the default Navigate mode.
  const travelByToStop = new Map<string, { minutes: number | null; mode: string | null }>();
  // The day's base — your home/office origin (the `start` stop carries no time;
  // it's where you leave FROM, not a thing you arrive at). It's the fallback
  // "from" for the first leave-by when live location isn't granted, so the day
  // never loses its start point.
  let baseCoord: { lat: number; lng: number } | null = null;
  let tickets: TicketVM[] = [];
  // Per-leg rail/air passes keyed by their BOARDING stop id — folded once here
  // from each event's booked transit run, so the spine can drop each pass inline
  // at the leg it belongs to (the run's departure / each changeover stop).
  const legCardByOriginId = new Map<string, { ticket: TicketVM; crs: string | null; time: string | null; dest: string | null }>();
  for (const ev of covering) {
    const [{ data: s }, { data: t }, jt] = await Promise.all([
      supabase
        .from("stops")
        .select(
          "id, type, title, start_time, end_time, metadata, location:locations(name, latitude, longitude), customer_site:customer_sites(name, latitude, longitude), transport_hub:transport_hubs(name, code, kind, latitude, longitude)",
        )
        .eq("itinerary_id", ev.id)
        .order("sequence"),
      supabase
        .from("transitions")
        .select("from_stop_id, to_stop_id, mode, computed_duration_minutes")
        .eq("itinerary_id", ev.id),
      loadJourneyTickets(ev.id),
    ]);
    const evMode = (ev as { mode?: string | null }).mode === "work" ? "work" : (ev as { mode?: string | null }).mode === "personal" ? "personal" : null;
    const evStops = (s ?? []) as unknown as Array<StopRow & { metadata?: Record<string, unknown> | null }>;
    for (const st of evStops) {
      if (st.type === "start" && !baseCoord) baseCoord = coordOf(st);
      if (isToday(st.start_time, today)) allStops.push({ ...st, mode: evMode });
    }
    for (const tr of (t ?? []) as Array<{ from_stop_id: string; to_stop_id: string; mode: string | null; computed_duration_minutes: number | null }>) {
      legFromStops.add(tr.from_stop_id);
      if (tr.to_stop_id) travelByToStop.set(tr.to_stop_id, { minutes: tr.computed_duration_minutes, mode: tr.mode });
    }
    tickets = tickets.concat(jt);

    // Fold this event's booked transit runs into one pass per boarded hop, keyed
    // by the boarding (origin) stop id — the spine matches these to its departure
    // / changeover nodes. Only hops whose boarding stop is part of today's slice
    // surface; a changeover's true departure is its end_time.
    const byId = new Map(evStops.map((st) => [st.id, st]));
    const legs = foldStopsToLegTickets(
      evStops.map((st) => ({
        id: st.id,
        type: st.type,
        title: st.title,
        start_time: st.start_time,
        end_time: st.end_time,
        code: st.transport_hub?.code ?? null,
        metadata: st.metadata ?? null,
      })),
    );
    for (const lt of legs) {
      const o = byId.get(lt.originStopId);
      if (!o || !isToday(o.start_time, today)) continue;
      const iso = o.type === "transit_changeover" ? o.end_time : o.start_time;
      legCardByOriginId.set(lt.originStopId, {
        ticket: lt.ticket,
        crs: o.transport_hub?.code ?? null,
        time: londonHHMM(iso),
        dest: lt.ticket.legs[0]?.destination.code ?? null,
      });
    }
  }

  allStops.sort((a, b) => {
    const ta = a.start_time ? new Date(a.start_time).getTime() : Infinity;
    const tb = b.start_time ? new Date(b.start_time).getTime() : Infinity;
    return ta - tb;
  });

  // Disruption state (P10) — a live break on today's rail legs → Today's disruption
  // character. Server-side via Darwin; dormant (no call returns data) without the
  // key, so no false alarms. Rail departures = a rail-station hub with an onward leg.
  const disruptions: TodayDisruptionItem[] = [];
  for (let i = 0; i < allStops.length; i++) {
    const st = allStops[i];
    const code = st.transport_hub?.code;
    if (st.transport_hub?.kind !== "rail_station" || !legFromStops.has(st.id) || !code || !st.start_time) continue;
    const live = await liveDeparture(code, londonHHMM(st.start_time) ?? "");
    if (!live) continue;
    const m = /\+(\d+)/.exec(live.detail ?? "");
    const delayMin = live.label === "Cancelled" ? 999 : m ? Number(m[1]) : 0;
    if (delayMin <= 0) continue;
    const next = allStops.slice(i + 1).find((s) => s.start_time);
    const text = next?.start_time
      ? delayConsequence(
          { id: next.id, intoName: next.title ?? "your next stop", arriveIso: next.start_time, deadlineIso: next.start_time, kind: "commitment" },
          delayMin === 999 ? 60 : delayMin,
        ).text
      : live.label;
    disruptions.push({ title: `${st.transport_hub?.name ?? st.title ?? "Your train"} · ${live.label}`, text, severe: delayMin >= 16 || delayMin === 999 });
  }

  // Greater London — show live TfL line status when today touches London (Phase 8).
  const inLondon = [baseCoord, ...allStops.map((s) => coordOf(s))].some(
    (c) => c != null && (c.lat !== 0 || c.lng !== 0) &&
      c.lat >= 51.28 && c.lat <= 51.7 && c.lng >= -0.52 && c.lng <= 0.34,
  );

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
      mode: s.mode ?? null,
      pass: legCardByOriginId.get(s.id) ?? null,
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

  // The next obligation for the spine highlight + the ticket-surfacing window.
  const nextSpine = proj.nextIndex != null ? spineAnchors[proj.nextIndex] : null;

  const nowMs = now.getTime();
  const nextTicket =
    tickets
      .map((tk) => ({ tk, m: ticketUseMoment(tk) }))
      .filter((x): x is { tk: TicketVM; m: string } => Boolean(x.m))
      .filter((x) => new Date(x.m).getTime() >= nowMs - 30 * 60000)
      .sort((a, b) => a.m.localeCompare(b.m))[0]?.tk ?? tickets[0];

  // Rail/air passes now ride INLINE on the spine at each leg's boarding node
  // (legCardByOriginId → spineAnchors.pass). The standalone surface stays only
  // for the document that has NO spine leg to sit on — a stay (check-in/out is a
  // constraint, not a journey hop) that's the next thing needed.
  const nextTicketInline = nextTicket ? legCardByOriginId.has(nextTicket.id) : false;
  const showNextDocument = !!nextTicket && !nextTicketInline && nextTicket.kind === "stay";

  const sub =
    covering.length === 1
      ? covering[0].title ?? undefined
      : covering.length > 1
        ? `${covering.length} plans today`
        : undefined;

  // Weather where you are — the integration, made visible (cached → renders whole).
  const weather = await getLocalWeather();

  return (
    <div className="cc-screen" data-disrupted={disruptions.length ? "true" : undefined}>
      {/* Keep today's tickets on-device for the barrier (no-signal Aztec). */}
      <OfflineTicketSync tickets={tickets} />
      <header className="cc-today-head">
        <div>
          <span className="cc-eyebrow">Today</span>
          <h1 className="cc-screen-title" style={{ marginTop: 6 }}>
            Right now
          </h1>
        </div>
        {weather ? (
          <div className="cc-weather" data-day={weather.isDay ? "true" : "false"}>
            <span className="cc-weather-temp">{weather.tempC}&deg;</span>
            <span className="cc-weather-meta">
              <span className="cc-weather-headline">{weather.headline}</span>
              <span className="cc-weather-place">{weather.place}</span>
            </span>
          </div>
        ) : null}
      </header>

      {weather && weather.hours.length > 0 ? (
        <div className="cc-weather-hours" aria-label="Today's forecast by the hour">
          {weather.hours.map((h) => (
            <div key={h.label} className="cc-weather-hour" title={h.headline}>
              <span className="cc-weather-hour-time">{h.label}</span>
              <span className="cc-weather-hour-temp">{h.tempC}&deg;</span>
              <span className="cc-weather-hour-cond">{h.headline}</span>
            </div>
          ))}
        </div>
      ) : null}

      <TodayDisruption items={disruptions} />

      {inLondon ? <TflLineStatus /> : null}

      {anchors.length ? (
        <>
          <LiveDay anchors={spineAnchors} sub={sub} base={baseCoord} />

          {(proj.state === "readiness" || proj.state === "in-transit") && showNextDocument && nextTicket ? (
            <TodayDocument ticket={nextTicket} />
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
          <h2 className="cc-at-headline">Let&apos;s set up your day</h2>
          <p className="cc-at-sub">
            Add what&apos;s coming up — your trains, stays and meetings — or import the bookings
            from your inbox, and Khonsera threads the day: the next move, the leave-by, the chain ahead.
          </p>
          <div style={{ marginTop: "var(--space-4)", display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <PlanCreate label="Plan a day" />
            <Link href={"/plan" as Route} className="cc-btn">
              Open the plan
            </Link>
          </div>
        </div>
      )}

      {tomorrowReview ? <DayReviewCard review={tomorrowReview} eyebrow="Tomorrow" /> : null}
    </div>
  );
}

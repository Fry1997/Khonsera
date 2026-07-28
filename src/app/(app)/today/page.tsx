import Link from "next/link";
import { AppScreen } from "@/components/ui/page-shell";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { isWelcomed } from "@/lib/welcome";
import type { AnchorVM, AnchorType, TicketVM } from "@/components/concierge";
import { projectToday, type ProjectionStop } from "@/lib/planning/today";
import { loadJourneyTickets } from "@/lib/actions/wallet";
import { buildDayReview } from "@/lib/actions/review";
import { DayReviewCard } from "@/components/plan/day-review";
import { PlanCreate } from "@/components/plan/plan-create";
import { TflLineStatus } from "@/components/today/tfl-line-status";
import { getLocalWeather } from "@/lib/actions/weather";
import {
  TodayDisruption,
  type TodayDisruptionItem,
} from "@/components/today/today-disruption";
import { liveDeparture } from "@/lib/integrations/darwin";
import { delayConsequence } from "@/lib/live/engine";
import { ticketUseMoment } from "@/components/concierge";
import { TodayDocument } from "@/components/today/today-document";
import { OfflineTicketSync } from "@/components/offline/offline-ticket-sync";
import { LiveDay } from "@/components/today/live-day";
import { TodaySpine } from "@/components/today/today-spine";
import {
  navModeForTransition,
  stationLabel,
  roleOf,
  type SpineAnchor,
  type TransitionProgressState,
} from "@/components/today/spine-model";
import { foldStopsToLegTickets } from "@/lib/tickets/from-stops";
import { TodayDemo } from "@/components/today/today-demo";
import { isDemoModeActive } from "@/lib/demo-mode";
import { PlanMap } from "@/components/plan/plan-map";
import {
  buildJourneyFromStops,
  type StopForMap,
  type TransitionForMap,
} from "@/components/journey-map/from-stops";
import { PlanAdd } from "@/components/plan/plan-add";
import type {
  PlacePickerLocation,
  PlacePickerCustomer,
  PlacePickerCustomerSite,
} from "@/components/place-picker";

const londonHHMM = (iso?: string | null) =>
  iso
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(iso))
    : null;

function mapStopType(type: string): AnchorType {
  if (type === "shift") return "shift";
  if (type.includes("appointment")) return "appointment";
  if (type.includes("flight")) return "flight";
  if (type.includes("arrival") || type.includes("transit"))
    return "transport_arrival";
  if (type.includes("checkin") || type.includes("check_in"))
    return "accommodation_check_in";
  if (type.includes("checkout") || type.includes("check_out"))
    return "accommodation_check_out";
  if (type.includes("hotel") || type.includes("accommodation"))
    return "accommodation_check_in";
  return "custom";
}

type Geo = {
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
} | null;
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
  mode?: "work" | "personal" | null;
};
type TransitionRow = {
  id: string;
  from_stop_id: string;
  to_stop_id: string;
  mode: string | null;
  computed_duration_minutes: number | null;
  overview_polyline?: string | null;
  commitment_state: TransitionProgressState | null;
  actual_started_at: string | null;
  actual_arrived_at: string | null;
};
type InboundLeg = {
  id: string;
  minutes: number | null;
  mode: string | null;
  state: TransitionProgressState | null;
  actualStartedAt: string | null;
  actualArrivedAt: string | null;
  notBeforeIso: string | null;
};

function coordOf(s: StopRow): { lat: number; lng: number } | null {
  for (const c of [s.customer_site, s.location, s.transport_hub]) {
    if (c && c.latitude != null && c.longitude != null)
      return { lat: c.latitude, lng: c.longitude };
  }
  return null;
}
function placeOf(s: StopRow): string | undefined {
  return (
    s.location?.name ??
    s.customer_site?.name ??
    s.transport_hub?.name ??
    undefined
  );
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isToday(iso: string | null, today: string): boolean {
  if (!iso) return false;
  return (
    new Date(iso).toISOString().slice(0, 10) === today ||
    ymd(new Date(iso)) === today
  );
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const ctx = await requireUserContext();
  const sp = await searchParams;
  if ((ctx.isStaff && sp?.demo === "1") || (await isDemoModeActive()))
    return <TodayDemo />;

  const supabase = await createClient();
  if (!(await isWelcomed())) {
    const { count } = await supabase
      .from("itineraries")
      .select("id", { count: "exact", head: true });
    if (!count) redirect("/welcome" as Route);
  }

  const now = new Date();
  const today = ymd(now);
  const { data: events } = await supabase
    .from("itineraries")
    .select("id, title, mode, date_start, date_end, status")
    .lte("date_start", today)
    .gte("date_end", today)
    .in("status", ["draft", "planning", "planned", "in_progress"])
    .order("date_start", { ascending: true });
  const covering = events ?? [];

  const tomorrow = ymd(new Date(now.getTime() + 86_400_000));
  const { data: tmrwRows } = await supabase
    .from("itineraries")
    .select("id")
    .eq("date_start", tomorrow)
    .in("status", ["draft", "planning", "planned", "in_progress"])
    .order("date_start", { ascending: true })
    .limit(1);
  const tomorrowReview =
    tmrwRows && tmrwRows.length
      ? await buildDayReview(tmrwRows[0].id as string)
      : null;

  const allStops: StopRow[] = [];
  const legFromStops = new Set<string>();
  const travelByToStop = new Map<string, InboundLeg>();
  let baseCoord: { lat: number; lng: number } | null = null;
  let baseLabel: string | null = null;
  let tickets: TicketVM[] = [];
  let mapStops: StopForMap[] = [];
  let mapTransitions: TransitionForMap[] = [];
  const legCardByOriginId = new Map<
    string,
    {
      ticket: TicketVM;
      crs: string | null;
      time: string | null;
      dest: string | null;
    }
  >();

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
        .select(
          "id, from_stop_id, to_stop_id, mode, computed_duration_minutes, overview_polyline, commitment_state, actual_started_at, actual_arrived_at",
        )
        .eq("itinerary_id", ev.id),
      loadJourneyTickets(ev.id),
    ]);

    const evMode =
      (ev as { mode?: string | null }).mode === "work"
        ? "work"
        : (ev as { mode?: string | null }).mode === "personal"
          ? "personal"
          : null;
    const evStops = (s ?? []) as unknown as Array<
      StopRow & { metadata?: Record<string, unknown> | null }
    >;
    const byId = new Map(evStops.map((st) => [st.id, st]));

    for (const st of evStops) {
      if (st.type === "start" && !baseCoord) baseCoord = coordOf(st);
      if (st.type === "start" && !baseLabel)
        baseLabel = placeOf(st) ?? st.title ?? null;
      // Base bookends remain part of routing, but they are context — never Today stops.
      if (
        st.type !== "start" &&
        st.type !== "end" &&
        isToday(st.start_time, today)
      ) {
        allStops.push({ ...st, mode: evMode });
      }
    }

    const evTransitions = (t ?? []) as unknown as TransitionRow[];
    for (const tr of evTransitions) {
      legFromStops.add(tr.from_stop_id);
      const from = byId.get(tr.from_stop_id);
      travelByToStop.set(tr.to_stop_id, {
        id: tr.id,
        minutes: tr.computed_duration_minutes,
        mode: tr.mode,
        state: tr.commitment_state,
        actualStartedAt: tr.actual_started_at,
        actualArrivedAt: tr.actual_arrived_at,
        notBeforeIso: from?.type === "shift" ? from.end_time : null,
      });
    }

    if (covering.length === 1) {
      const geo = (g: Geo) =>
        g
          ? {
              name: g.name ?? null,
              latitude: g.latitude ?? null,
              longitude: g.longitude ?? null,
            }
          : null;
      mapStops = evStops.map((st) => ({
        id: st.id,
        title: st.title,
        location: geo(st.location),
        customer_site: geo(st.customer_site),
        transport_hub: st.transport_hub
          ? {
              code: st.transport_hub.code ?? null,
              name: st.transport_hub.name ?? null,
              latitude: st.transport_hub.latitude ?? null,
              longitude: st.transport_hub.longitude ?? null,
            }
          : null,
      }));
      mapTransitions = evTransitions.map((tr) => ({
        from_stop_id: tr.from_stop_id,
        mode: tr.mode ?? "walk",
        overview_polyline: tr.overview_polyline ?? null,
        computed_duration_minutes: tr.computed_duration_minutes ?? null,
      }));
    }

    tickets = tickets.concat(jt);
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
      const origin = byId.get(lt.originStopId);
      if (!origin || !isToday(origin.start_time, today)) continue;
      const iso =
        origin.type === "transit_changeover"
          ? origin.end_time
          : origin.start_time;
      legCardByOriginId.set(lt.originStopId, {
        ticket: lt.ticket,
        crs: origin.transport_hub?.code ?? null,
        time: londonHHMM(iso),
        dest: lt.ticket.legs[0]?.destination.code ?? null,
      });
    }
  }

  allStops.sort(
    (a, b) =>
      (a.start_time ? new Date(a.start_time).getTime() : Infinity) -
      (b.start_time ? new Date(b.start_time).getTime() : Infinity),
  );

  const disruptions: TodayDisruptionItem[] = [];
  for (let i = 0; i < allStops.length; i++) {
    const st = allStops[i];
    const code = st.transport_hub?.code;
    if (
      st.transport_hub?.kind !== "rail_station" ||
      !legFromStops.has(st.id) ||
      !code ||
      !st.start_time
    )
      continue;
    const live = await liveDeparture(code, londonHHMM(st.start_time) ?? "");
    if (!live) continue;
    const m = /\+(\d+)/.exec(live.detail ?? "");
    const delayMin = live.label === "Cancelled" ? 999 : m ? Number(m[1]) : 0;
    if (delayMin <= 0) continue;
    const next = allStops
      .slice(i + 1)
      .find((candidate) => candidate.start_time);
    const text = next?.start_time
      ? delayConsequence(
          {
            id: next.id,
            intoName: next.title ?? "your next stop",
            arriveIso: next.start_time,
            deadlineIso: next.start_time,
            kind: "commitment",
          },
          delayMin === 999 ? 60 : delayMin,
        ).text
      : live.label;
    disruptions.push({
      title: `${st.transport_hub?.name ?? st.title ?? "Your train"} · ${live.label}`,
      text,
      severe: delayMin >= 16 || delayMin === 999,
    });
  }

  const inLondon = [baseCoord, ...allStops.map((s) => coordOf(s))].some(
    (c) =>
      c != null &&
      (c.lat !== 0 || c.lng !== 0) &&
      c.lat >= 51.28 &&
      c.lat <= 51.7 &&
      c.lng >= -0.52 &&
      c.lng <= 0.34,
  );

  const anchors: AnchorVM[] = allStops.map((s) => ({
    id: s.id,
    type: mapStopType(s.type),
    title: s.title ?? placeOf(s) ?? "Stop",
    place: placeOf(s),
    time: s.start_time
      ? { from: s.start_time, to: s.end_time ?? undefined }
      : undefined,
    fixed: true,
  }));

  const spineAnchors: SpineAnchor[] = allStops.map((s) => {
    const leg = travelByToStop.get(s.id);
    const hub = s.transport_hub;
    const station = hub?.name
      ? {
          name: hub.name,
          code: hub.code ?? null,
          kind: (hub.kind === "airport" ? "airport" : "rail_station") as
            | "airport"
            | "rail_station",
        }
      : null;
    const stationCoord =
      station && hub?.latitude != null && hub?.longitude != null
        ? { lat: hub.latitude, lng: hub.longitude }
        : null;
    return {
      id: s.id,
      type: mapStopType(s.type),
      title: station
        ? stationLabel(station.name, station.kind)
        : (s.title ?? placeOf(s) ?? "Stop"),
      place: station ? undefined : placeOf(s),
      arriveByIso: s.start_time,
      endIso: s.end_time,
      coord: stationCoord ?? coordOf(s),
      plannedTravelMinutes: leg?.minutes ?? null,
      travelMode: leg?.mode ?? null,
      bufferMinutes: s.type === "shift" ? 0 : undefined,
      notBeforeIso: leg?.notBeforeIso ?? null,
      inboundTransitionId: leg?.id ?? null,
      transitionState: leg?.state ?? null,
      actualStartedAt: leg?.actualStartedAt ?? null,
      actualArrivedAt: leg?.actualArrivedAt ?? null,
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
  const nextSpine =
    proj.nextIndex != null ? spineAnchors[proj.nextIndex] : null;

  const nowMs = now.getTime();
  const nextTicket =
    tickets
      .map((tk) => ({ tk, m: ticketUseMoment(tk) }))
      .filter((x): x is { tk: TicketVM; m: string } => Boolean(x.m))
      .filter((x) => new Date(x.m).getTime() >= nowMs - 30 * 60000)
      .sort((a, b) => a.m.localeCompare(b.m))[0]?.tk ?? tickets[0];
  const nextTicketInline = nextTicket
    ? legCardByOriginId.has(nextTicket.id)
    : false;
  const showNextDocument =
    !!nextTicket && !nextTicketInline && nextTicket.kind === "stay";
  const sub =
    covering.length > 1
      ? `${covering.length} plans today`
      : baseLabel
        ? `From ${baseLabel}`
        : undefined;
  const weather = await getLocalWeather();
  const dateEyebrow = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "2-digit",
    month: "short",
  })
    .format(now)
    .toUpperCase();
  const isEventStop = (s: StopRow) =>
    roleOf(s.type) === "stop" && s.type !== "start" && s.type !== "end";
  const primaryAnchor =
    allStops.find((s) => s.type === "shift") ??
    allStops.find((s) => s.type.includes("appointment")) ??
    allStops.find(isEventStop) ??
    null;
  const dayPurpose =
    (covering.length === 1 ? covering[0].title?.trim() : null) ||
    primaryAnchor?.title?.trim() ||
    "Your day";

  let dayNote: string | null = null;
  if (covering.length === 1) {
    const { data: intent } = await supabase
      .from("intentions")
      .select("description")
      .eq("itinerary_id", covering[0].id)
      .limit(1)
      .maybeSingle();
    dayNote =
      (intent as { description?: string | null } | null)?.description?.trim() ||
      null;
  }

  const todayJourney =
    covering.length === 1
      ? buildJourneyFromStops(mapStops, mapTransitions, {
          id: covering[0].id,
          eyebrow: `${dateEyebrow} · DOOR TO DOOR`,
        })
      : null;
  const toolsEvent = covering.length === 1 ? covering[0] : null;
  let toolPickers: {
    customers: PlacePickerCustomer[];
    customerSites: PlacePickerCustomerSite[];
    locations: PlacePickerLocation[];
  } | null = null;
  if (toolsEvent) {
    const [{ data: pc }, { data: psite }, { data: ploc }] = await Promise.all([
      supabase
        .from("customers")
        .select("id, name")
        .eq("workspace_id", ctx.workspaceId)
        .order("name"),
      supabase
        .from("customer_sites")
        .select("id, customer_id, name, address")
        .eq("workspace_id", ctx.workspaceId),
      supabase
        .from("locations")
        .select("id, name, type, address")
        .eq("workspace_id", ctx.workspaceId)
        .order("type")
        .order("name"),
    ]);
    toolPickers = {
      customers: (pc ?? []) as PlacePickerCustomer[],
      customerSites: (psite ?? []) as PlacePickerCustomerSite[],
      locations: (ploc ?? []) as PlacePickerLocation[],
    };
  }
  return (
    <AppScreen
      eyebrow={anchors.length ? dateEyebrow : "Today"}
      title={anchors.length ? dayPurpose : "Right now"}
      titleAs="h1"
      description={
        anchors.length && baseLabel ? (
          <>
            From <strong>{baseLabel}</strong>
          </>
        ) : undefined
      }
      headerClassName="cc-today-head"
      data-disrupted={disruptions.length ? "true" : undefined}
      actions={
        weather ? (
          <div
            className="cc-weather"
            data-day={weather.isDay ? "true" : "false"}
          >
            <span className="cc-weather-temp">{weather.tempC}&deg;</span>
            <span className="cc-weather-meta">
              <span className="cc-weather-headline">{weather.headline}</span>
              <span className="cc-weather-place">{weather.place}</span>
            </span>
          </div>
        ) : null
      }
    >
      <OfflineTicketSync tickets={tickets} />
      <div className="cc-day-dashboard">
        <div className="cc-day-forecast" aria-label="Day conditions">
          {weather && weather.hours.length > 0 ? (
            <div
              className="cc-weather-hours"
              aria-label="Today's forecast by the hour"
            >
              {weather.hours.map((h) => (
                <div
                  key={h.label}
                  className="cc-weather-hour"
                  title={h.headline}
                >
                  <span className="cc-weather-hour-time">{h.label}</span>
                  <span className="cc-weather-hour-temp">{h.tempC}&deg;</span>
                  <span className="cc-weather-hour-cond">{h.headline}</span>
                </div>
              ))}
            </div>
          ) : null}
          <TodayDisruption items={disruptions} />
          {inLondon ? <TflLineStatus /> : null}
        </div>

        {anchors.length ? (
          <>
            <section
              className="cc-day-primary"
              aria-label={`Live itinerary for ${dayPurpose}`}
            >
              {dayNote ? (
                <div className="cc-day-point cc-day-point--today">
                  <span className="cc-day-point-eyebrow">
                    The point of the day
                  </span>
                  <p className="cc-standfirst">{dayNote}</p>
                </div>
              ) : null}
              <LiveDay anchors={spineAnchors} sub={sub} base={baseCoord} />
              <TodaySpine
                anchors={spineAnchors}
                nextId={nextSpine?.id ?? null}
              />
            </section>

            <aside
              className="cc-day-context"
              aria-label="Day tools and documents"
            >
              {tickets.length > 0 ? (
                <div className="cc-context-actions">
                  <span className="cc-context-label">Tickets today</span>
                  <Link
                    href={"/wallet" as Route}
                    className="cc-btn cc-btn-ghost"
                  >
                    Open wallet
                  </Link>
                </div>
              ) : null}
              {todayJourney ? <PlanMap journey={todayJourney} /> : null}
              {showNextDocument && nextTicket ? (
                <TodayDocument ticket={nextTicket} />
              ) : null}
              {toolsEvent && toolPickers ? (
                <div className="cc-context-actions cc-context-actions--planner">
                  <div className="cc-context-copy">
                    <span className="cc-context-label">Plan this day</span>
                    <span className="cc-context-detail">
                      Add a stop here or open the full planner.
                    </span>
                  </div>
                  <div className="cc-context-buttons">
                    <Link
                      href={`/plan/${toolsEvent.id}` as Route}
                      className="cc-btn cc-btn-ghost"
                    >
                      Open planner
                    </Link>
                    <PlanAdd
                      variant="primary"
                      journeyId={toolsEvent.id}
                      journeyDate={toolsEvent.date_start as string}
                      customers={toolPickers.customers}
                      customerSites={toolPickers.customerSites}
                      locations={toolPickers.locations}
                    />
                  </div>
                </div>
              ) : (
                <PlanCreate />
              )}
            </aside>
          </>
        ) : (
          <section
            className="cc-day-primary cc-day-empty"
            aria-label="Plan your next day"
          >
            {tomorrowReview ? <DayReviewCard review={tomorrowReview} /> : null}
            <PlanCreate />
          </section>
        )}
      </div>
    </AppScreen>
  );
}

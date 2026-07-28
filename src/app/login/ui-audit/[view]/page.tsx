import { AppScreen } from "@/components/ui/page-shell";
import { PlanSpine, type SpineNode } from "@/components/plan/plan-spine";
import { TodaySpine } from "@/components/today/today-spine";
import type { SpineAnchor } from "@/components/today/spine-model";
import type { LegVM, TicketVM } from "@/components/concierge";

const day = "2026-07-28";
const at = (time: string) => `${day}T${time}:00+01:00`;

function ticket(
  id: string,
  from: { place: string; code: string; time: string },
  to: { place: string; code: string; time: string },
): TicketVM {
  const durationMinutes = Math.round(
    (Date.parse(at(to.time)) - Date.parse(at(from.time))) / 60_000,
  );
  return {
    id,
    kind: "rail",
    operator: "Thameslink",
    reference: id.toUpperCase(),
    source: "inbox",
    legs: [
      {
        id: `${id}-leg`,
        origin: {
          place: from.place,
          code: from.code,
          time: at(from.time),
        },
        destination: {
          place: to.place,
          code: to.code,
          time: at(to.time),
        },
        durationMinutes,
        status: { status: "on_time" },
        barcodes: [
          {
            format: "aztec",
            value: `AUDIT-${id}`,
            passengerLabel: "Adult 1",
          },
        ],
      },
    ],
  };
}

const welLut = ticket(
  "wel-lut",
  { place: "Wellingborough", code: "WEL", time: "07:25" },
  { place: "Luton", code: "LUT", time: "07:55" },
);
const lutHpd = ticket(
  "lut-hpd",
  { place: "Luton", code: "LUT", time: "08:13" },
  { place: "Harpenden", code: "HPD", time: "08:21" },
);
const hpdLut = ticket(
  "hpd-lut",
  { place: "Harpenden", code: "HPD", time: "17:22" },
  { place: "Luton", code: "LUT", time: "17:32" },
);
const lutWel = ticket(
  "lut-wel",
  { place: "Luton", code: "LUT", time: "17:42" },
  { place: "Wellingborough", code: "WEL", time: "18:08" },
);

const todayAnchors: SpineAnchor[] = [
  {
    id: "wel-out",
    type: "transport_arrival",
    title: "Wellingborough Station",
    arriveByIso: at("07:25"),
    endIso: at("07:25"),
    coord: { lat: 52.3038, lng: -0.6766 },
    plannedTravelMinutes: 39,
    navMode: "walk",
    station: {
      name: "Wellingborough",
      code: "WEL",
      kind: "rail_station",
    },
    role: "departure",
    pass: { ticket: welLut, crs: null, time: null, dest: null },
  },
  {
    id: "lut-out",
    type: "transport_arrival",
    title: "Luton Station",
    arriveByIso: at("07:55"),
    endIso: at("08:13"),
    coord: { lat: 51.8823, lng: -0.4147 },
    plannedTravelMinutes: 30,
    navMode: "walk",
    station: { name: "Luton", code: "LUT", kind: "rail_station" },
    role: "changeover",
    pass: { ticket: lutHpd, crs: null, time: null, dest: null },
  },
  {
    id: "hpd-arrive",
    type: "transport_arrival",
    title: "Harpenden Station",
    arriveByIso: at("08:21"),
    endIso: at("08:21"),
    coord: { lat: 51.8148, lng: -0.3515 },
    plannedTravelMinutes: 8,
    navMode: "walk",
    station: { name: "Harpenden", code: "HPD", kind: "rail_station" },
    role: "arrival",
  },
  {
    id: "work",
    type: "shift",
    title: "Work",
    place: "Breww Office",
    arriveByIso: at("09:00"),
    endIso: at("17:00"),
    coord: { lat: 51.8172, lng: -0.356 },
    plannedTravelMinutes: 9,
    navMode: "walk",
    station: null,
    role: "stop",
    mode: "work",
  },
  {
    id: "hpd-return",
    type: "transport_arrival",
    title: "Harpenden Station",
    arriveByIso: at("17:22"),
    endIso: at("17:22"),
    coord: { lat: 51.8148, lng: -0.3515 },
    plannedTravelMinutes: 9,
    notBeforeIso: at("17:00"),
    navMode: "walk",
    station: { name: "Harpenden", code: "HPD", kind: "rail_station" },
    role: "departure",
    pass: { ticket: hpdLut, crs: null, time: null, dest: null },
  },
  {
    id: "lut-return",
    type: "transport_arrival",
    title: "Luton Station",
    arriveByIso: at("17:32"),
    endIso: at("17:42"),
    coord: { lat: 51.8823, lng: -0.4147 },
    plannedTravelMinutes: 10,
    navMode: "walk",
    station: { name: "Luton", code: "LUT", kind: "rail_station" },
    role: "changeover",
    pass: { ticket: lutWel, crs: null, time: null, dest: null },
  },
  {
    id: "wel-return",
    type: "transport_arrival",
    title: "Wellingborough Station",
    arriveByIso: at("18:08"),
    endIso: at("18:08"),
    coord: { lat: 52.3038, lng: -0.6766 },
    plannedTravelMinutes: 26,
    navMode: "walk",
    station: {
      name: "Wellingborough",
      code: "WEL",
      kind: "rail_station",
    },
    role: "arrival",
  },
];

function leg(
  id: string,
  fromLabel: string,
  toLabel: string,
  departure: string,
  arrival: string,
): LegVM {
  return {
    id,
    mode: "walk",
    fromLabel,
    toLabel,
    departure: at(departure),
    arrival: at(arrival),
    bookingStatus: "unbooked_stub",
    buffer: { state: "ok", slackMinutes: 13 },
  };
}

const planNodes: SpineNode[] = [
  {
    key: "home-start",
    isBase: true,
    anchor: {
      id: "home-start",
      type: "custom",
      title: "20 Wilce Avenue",
      place: "20 Wilce Avenue",
      fixed: true,
    },
    after: {
      kind: "leg",
      leg: leg(
        "walk-to-station",
        "20 Wilce Avenue",
        "Wellingborough Station",
        "06:46",
        "07:18",
      ),
      itineraryId: "audit",
      fromStopId: "home-start",
      toStopId: "wel-out",
    },
  },
  { key: "wel-lut", pass: welLut },
  { key: "lut-hpd", pass: lutHpd },
  {
    key: "work",
    anchor: {
      id: "work",
      type: "shift",
      title: "Work",
      place: "Breww Office",
      time: { from: at("09:00"), to: at("17:00") },
      mode: "work",
      fixed: true,
    },
    after: {
      kind: "leg",
      leg: leg(
        "walk-to-return",
        "Breww Office",
        "Harpenden Station",
        "17:00",
        "17:09",
      ),
      itineraryId: "audit",
      fromStopId: "work",
      toStopId: "hpd-return",
    },
  },
  { key: "hpd-lut", pass: hpdLut },
  {
    key: "lut-wel",
    pass: lutWel,
    after: {
      kind: "leg",
      leg: leg(
        "walk-home",
        "Wellingborough Station",
        "20 Wilce Avenue",
        "18:08",
        "18:47",
      ),
      itineraryId: "audit",
      fromStopId: "wel-return",
      toStopId: "home-end",
    },
  },
  {
    key: "home-end",
    isBase: true,
    anchor: {
      id: "home-end",
      type: "custom",
      title: "20 Wilce Avenue",
      place: "20 Wilce Avenue",
      fixed: true,
    },
  },
];

function Brand() {
  return (
    <span className="cc-lockup">
      <span className="cc-brand-dot" />
      <span className="wm">KHONSERA</span>
    </span>
  );
}

function AuditShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="khonsera-app">
      <div className="cc-app-mobile lg:hidden">
        <header className="cc-appbar">
          <Brand />
          <span className="cc-iconbtn">•••</span>
        </header>
        <main className="cc-mobile-main">{children}</main>
      </div>
      <div className="cc-app-desktop hidden lg:block">
        <div className="cc-shell">
          <aside className="cc-rail">
            <Brand />
          </aside>
          <div className="cc-shell-main">
            <div className="cc-shell-canvas">
              <main className="cc-shell-col">{children}</main>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TodayAudit() {
  return (
    <AppScreen
      eyebrow="TUE 28 JUL"
      title="Breww Office Day"
      description={
        <>
          From <strong>20 Wilce Avenue</strong>
        </>
      }
      actions={
        <div className="cc-weather">
          <span className="cc-weather-temp">25°</span>
          <span className="cc-weather-meta">
            <span className="cc-weather-headline">Mostly clear</span>
            <span className="cc-weather-place">20 Wilce Avenue</span>
          </span>
        </div>
      }
      headerClassName="cc-today-head"
    >
      <div className="cc-day-dashboard">
        <div className="cc-day-forecast">
          <div className="cc-weather-hours">
            {["11:00", "12:00", "13:00", "14:00", "15:00"].map((time, index) => (
              <div className="cc-weather-hour" key={time}>
                <span className="cc-weather-hour-time">{time}</span>
                <span className="cc-weather-hour-temp">{24 + index}°</span>
                <span className="cc-weather-hour-cond">Mostly clear</span>
              </div>
            ))}
          </div>
        </div>
        <section className="cc-day-primary">
          <section className="cc-active-tile cc-setoff" data-urgency="comfortable">
            <span className="cc-at-status">
              <span className="cc-at-dot" />
              Next move
            </span>
            <div className="pg cc-setoff-sheet">
              <div className="cc-setoff-eyb">
                <span className="cc-setoff-kicker">Leave by</span>
                <span className="cc-setoff-for">for Harpenden</span>
              </div>
              <div className="mono engr-deep cc-setoff-figure">
                <span>17</span>
                <span className="cc-setoff-colon">:</span>
                <span>00</span>
              </div>
              <p className="cc-setoff-move">
                Leave in 4h 6m · 9 min walk · arrive 13 min early.
              </p>
            </div>
            <button className="cc-btn cc-btn-gold">I&apos;m on my way</button>
          </section>
          <TodaySpine
            anchors={todayAnchors}
            nextId="work"
            nowOverride={Date.parse(at("12:54"))}
          />
        </section>
        <aside className="cc-day-context">
          <div className="cc-context-actions">
            <span className="cc-context-label">Tickets today</span>
            <button className="cc-btn cc-btn-ghost">Open wallet</button>
          </div>
        </aside>
      </div>
    </AppScreen>
  );
}

function PlanAudit() {
  return (
    <div className="cc-plan-detail">
      <div className="cc-plan-grid">
        <section className="cc-plan-primary">
          <header className="cc-day-header">
            <span className="cc-day-header-eyebrow">TUE 28 JUL</span>
            <h1 className="cc-day-purpose">Breww Office Day</h1>
            <p className="cc-day-origin">
              From <strong>20 Wilce Avenue</strong>
            </p>
          </header>
          <div className="cc-decision-clock">
            <span>Leave by</span>
            <strong>06:31</strong>
            <small>for Wellingborough</small>
          </div>
          <PlanSpine
            nodes={planNodes}
            journeyDate={day}
            eventId="audit"
            isWork
            customers={[]}
            customerSites={[]}
            locations={[]}
          />
        </section>
        <aside className="cc-plan-context">
          <div className="cc-route-map">
            <div className="cc-context-actions">
              <span className="cc-context-label">Route map</span>
              <button className="cc-btn cc-btn-ghost">Show route</button>
            </div>
          </div>
          <section className="cc-plan-context-bundle">
            <input
              id="audit-day-tools"
              className="cc-plan-context-toggle"
              type="checkbox"
            />
            <label htmlFor="audit-day-tools">
              <span>
                <strong>Day tools</strong>
                <small>Budget, sharing, constraints and additions</small>
              </span>
              <span>+</span>
            </label>
            <div className="cc-plan-context-body">
              <div className="cc-context-actions">Tool stack</div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default async function UiAuditPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  return (
    <AuditShell>
      {view === "plan" ? <PlanAudit /> : <TodayAudit />}
    </AuditShell>
  );
}

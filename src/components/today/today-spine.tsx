"use client";

import { useEffect, useMemo, useState } from "react";
import type { SpineAnchor } from "./spine-model";
import { londonClock, navigateHref, roleLabel } from "./spine-model";
import {
  pickNextIndex,
  READINESS_BUFFER_MIN,
  STATION_BUFFER_MIN,
  type EngineAnchor,
} from "@/lib/today/engine";
import { LivePass } from "@/components/plan/live-pass";
import { ScanView } from "@/components/concierge";
import type { BarcodeVM, TicketVM } from "@/components/concierge";

const TYPE_LABEL: Record<SpineAnchor["type"], string> = {
  appointment: "Appointment",
  shift: "Shift",
  reservation: "Reservation",
  accommodation_check_in: "Check-in",
  accommodation_check_out: "Check-out",
  transport_arrival: "Arrival",
  flight: "Flight",
  custom: "Stop",
};

type State = "past" | "next" | "future";
type TimedLeg = {
  departIso: string | null;
  arriveIso: string | null;
  spareMinutes: number | null;
};
type SpineIconKind =
  | "now"
  | "walk"
  | "cycle"
  | "drive"
  | "hub"
  | "train"
  | "change"
  | "appointment";

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : null;
}

function iso(value: number | null): string | null {
  return value == null ? null : new Date(value).toISOString();
}

function normalisePlace(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\b(station|railway|airport)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function previousPassEndsAt(
  previous: SpineAnchor | null,
  anchor: SpineAnchor,
): boolean {
  const destination = previous?.pass?.ticket.legs[0]?.destination;
  if (!destination || !anchor.station) return false;

  const destinationCode = destination.code?.trim().toUpperCase();
  const stationCode = anchor.station.code?.trim().toUpperCase();
  if (destinationCode && stationCode && destinationCode === stationCode) {
    return true;
  }

  return normalisePlace(destination.place) === normalisePlace(anchor.station.name);
}

function movementTimes(
  anchor: SpineAnchor,
  previous: SpineAnchor | null,
): TimedLeg {
  const minutes = anchor.plannedTravelMinutes;
  const targetMs = ms(anchor.arriveByIso);
  if (minutes == null || targetMs == null) {
    return { departIso: null, arriveIso: null, spareMinutes: null };
  }

  const durationMs = minutes * 60_000;
  const bufferMinutes =
    anchor.bufferMinutes ??
    (anchor.station ? STATION_BUFFER_MIN : READINESS_BUFFER_MIN);
  const preferredArrivalMs = targetMs - bufferMinutes * 60_000;
  const preferredDepartureMs = preferredArrivalMs - durationMs;
  const previousEndMs = previous ? ms(previous.endIso ?? previous.arriveByIso) : null;
  const explicitNotBeforeMs = ms(anchor.notBeforeIso);
  const notBeforeMs =
    explicitNotBeforeMs ?? (previous?.type === "shift" ? previousEndMs : null);

  if (anchor.station) {
    const departMs =
      notBeforeMs == null
        ? preferredDepartureMs
        : Math.max(preferredDepartureMs, notBeforeMs);
    const arriveMs = departMs + durationMs;
    const spare = Math.round((targetMs - arriveMs) / 60_000);
    return {
      departIso: iso(departMs),
      arriveIso: iso(arriveMs),
      spareMinutes: spare,
    };
  }

  if (previousEndMs != null) {
    const arriveMs = previousEndMs + durationMs;
    const spare = Math.round((targetMs - arriveMs) / 60_000);
    return {
      departIso: iso(previousEndMs),
      arriveIso: iso(arriveMs),
      spareMinutes: spare,
    };
  }

  const departMs =
    notBeforeMs == null
      ? preferredDepartureMs
      : Math.max(preferredDepartureMs, notBeforeMs);
  const arriveMs = departMs + durationMs;
  return {
    departIso: iso(departMs),
    arriveIso: iso(arriveMs),
    spareMinutes: Math.round((targetMs - arriveMs) / 60_000),
  };
}

function hasImplicitHubArrival(anchor: SpineAnchor): boolean {
  return Boolean(
    anchor.pass &&
      anchor.station &&
      anchor.role === "departure" &&
      anchor.plannedTravelMinutes != null &&
      anchor.arriveByIso,
  );
}

function SpineIcon({
  kind,
  active = false,
}: {
  kind: SpineIconKind;
  active?: boolean;
}) {
  return (
    <span
      className="cc-spine-icon"
      data-kind={kind}
      data-active={active || undefined}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {kind === "now" ? (
          <>
            <circle cx="12" cy="12" r="7.5" />
            <path d="M12 8v4l2.7 1.8" />
          </>
        ) : kind === "walk" ? (
          <>
            <circle cx="13" cy="4.5" r="1.6" />
            <path d="m10.2 9 2.2-2.1 2.5 1.5 2 2.1M12.4 7l-1.1 5-3 3M13.1 11.5l2.1 3 .7 4M11.3 12l2.4 2.2-1.8 4" />
          </>
        ) : kind === "cycle" ? (
          <>
            <circle cx="6.5" cy="16.5" r="3.2" />
            <circle cx="17.5" cy="16.5" r="3.2" />
            <path d="m8.5 8.5 3.3 8h-5.3l3.8-5.2h4.7l2.5 5.2M8.5 8.5h3" />
          </>
        ) : kind === "drive" ? (
          <>
            <path d="m5 15 1.3-5.1A2 2 0 0 1 8.2 8.5h7.6a2 2 0 0 1 1.9 1.4L19 15" />
            <path d="M4 15h16v3H4zM7 18v1.5M17 18v1.5M7.5 13h.01M16.5 13h.01" />
          </>
        ) : kind === "hub" ? (
          <>
            <path d="M5 20V9l7-4 7 4v11" />
            <path d="M8 20v-6h8v6M8 10h.01M12 10h.01M16 10h.01" />
          </>
        ) : kind === "train" ? (
          <>
            <rect x="6" y="3.5" width="12" height="14" rx="2.5" />
            <path d="M8.5 7.5h7M9 17.5l-2 3M15 17.5l2 3M9 13h.01M15 13h.01" />
          </>
        ) : kind === "change" ? (
          <>
            <path d="M5 8h12l-3-3M19 16H7l3 3" />
          </>
        ) : (
          <>
            <rect x="5" y="7" width="14" height="12" rx="2" />
            <path d="M9 7V5h6v2M8 11h8M12 11v4" />
          </>
        )}
      </svg>
    </span>
  );
}

export function TodaySpine({
  anchors,
  nextId,
  nowOverride,
}: {
  anchors: SpineAnchor[];
  nextId?: string | null;
  nowOverride?: number | null;
}) {
  const [internalNow, setInternalNow] = useState(() => Date.now());
  const [showPast, setShowPast] = useState(false);
  const [showLater, setShowLater] = useState(false);
  const [scan, setScan] = useState<{
    summary: string;
    barcodes: BarcodeVM[];
  } | null>(null);

  useEffect(() => {
    if (nowOverride != null) return;
    const timer = setInterval(() => setInternalNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [nowOverride]);

  const now = nowOverride ?? internalNow;
  const activeNextId = useMemo(() => {
    const engineAnchors: EngineAnchor[] = anchors.map((anchor) => ({
      id: anchor.id,
      startMs: ms(anchor.arriveByIso),
      endMs: ms(anchor.endIso),
      plannedTravelMinutes: anchor.plannedTravelMinutes,
      isStation: !!anchor.station,
      bufferMinutes: anchor.bufferMinutes,
      notBeforeMs: ms(anchor.notBeforeIso),
      isBlockingSpan: anchor.type === "shift",
    }));
    const index = pickNextIndex(engineAnchors, now);
    return index == null
      ? (nextId ?? null)
      : (anchors[index]?.id ?? nextId ?? null);
  }, [anchors, nextId, now]);

  if (!anchors.length) return null;

  const nextIndex = Math.max(
    0,
    anchors.findIndex((anchor) => anchor.id === activeNextId),
  );
  const past = anchors.slice(0, nextIndex);
  const currentAndNear = anchors.slice(
    nextIndex,
    Math.min(anchors.length, nextIndex + 5),
  );
  const later = anchors.slice(Math.min(anchors.length, nextIndex + 5));
  const visualPointCount =
    anchors.length + anchors.filter(hasImplicitHubArrival).length;

  const openTicket = (ticket: TicketVM) => {
    const leg = ticket.legs[0];
    if (!leg?.barcodes?.length) return;
    setScan({
      summary: `${ticket.operator} · ${leg.origin.place} → ${leg.destination.place}`,
      barcodes: leg.barcodes,
    });
  };

  return (
    <section>
      <div className="cc-spine-heading">
        <span className="cc-eyebrow">Your itinerary</span>
        <span>
          {visualPointCount} timed point{visualPointCount === 1 ? "" : "s"}
        </span>
      </div>
      <div className="cc-spine">
        <div className="cc-spine-rail" />
        {past.length ? (
          <Toggle
            label={`${past.length} earlier`}
            open={showPast}
            onClick={() => setShowPast((value) => !value)}
          />
        ) : null}
        {showPast
          ? past.map((anchor, index) => (
              <Entry
                key={anchor.id}
                anchor={anchor}
                previous={index ? past[index - 1] : null}
                state="past"
                onShowTicket={openTicket}
              />
            ))
          : null}
        <div className="cc-node cc-node--now">
          <div className="cc-node-dot">
            <SpineIcon kind="now" active />
          </div>
          <span className="cc-now-row">
            Now · {londonClock(new Date(now).toISOString())}
          </span>
        </div>
        {currentAndNear.map((anchor, index) => {
          const absoluteIndex = nextIndex + index;
          return (
            <Entry
              key={anchor.id}
              anchor={anchor}
              previous={absoluteIndex > 0 ? anchors[absoluteIndex - 1] : null}
              state={index === 0 ? "next" : "future"}
              onShowTicket={openTicket}
            />
          );
        })}
        {later.length ? (
          <>
            <Toggle
              label={`${later.length} later`}
              open={showLater}
              onClick={() => setShowLater((value) => !value)}
            />
            {showLater
              ? later.map((anchor, index) => {
                  const absoluteIndex = anchors.length - later.length + index;
                  return (
                    <Entry
                      key={anchor.id}
                      anchor={anchor}
                      previous={absoluteIndex > 0 ? anchors[absoluteIndex - 1] : null}
                      state="future"
                      onShowTicket={openTicket}
                    />
                  );
                })
              : null}
          </>
        ) : null}
      </div>
      {scan ? (
        <ScanView
          summary={scan.summary}
          barcodes={scan.barcodes}
          onClose={() => setScan(null)}
        />
      ) : null}
    </section>
  );
}

function Entry({
  anchor,
  previous,
  state,
  onShowTicket,
}: {
  anchor: SpineAnchor;
  previous: SpineAnchor | null;
  state: State;
  onShowTicket: (ticket: TicketVM) => void;
}) {
  const movement = movementTimes(anchor, previous);
  const isAppointment =
    anchor.type === "appointment" ||
    anchor.type === "reservation" ||
    anchor.type === "shift";
  const showMovement =
    anchor.plannedTravelMinutes != null &&
    !!navigateHref(anchor) &&
    state !== "past";
  const passOwnsStation = !!anchor.pass && anchor.role !== "changeover";
  const arrivalCoveredByPass =
    anchor.role === "arrival" && previousPassEndsAt(previous, anchor);
  const showAnchor = !passOwnsStation && !arrivalCoveredByPass;
  const showHubArrival =
    showMovement &&
    hasImplicitHubArrival(anchor) &&
    movement.arriveIso != null;

  return (
    <>
      {showMovement ? (
        <MovementCard
          anchor={anchor}
          movement={movement}
          active={state === "next"}
        />
      ) : null}
      {showHubArrival ? (
        <HubArrivalCard anchor={anchor} movement={movement} state={state} />
      ) : null}
      {showAnchor && anchor.role === "changeover" ? (
        <ChangeCard anchor={anchor} state={state} />
      ) : showAnchor && isAppointment ? (
        <AppointmentCard anchor={anchor} state={state} />
      ) : showAnchor ? (
        <AnchorCard anchor={anchor} state={state} />
      ) : null}
      {anchor.pass ? (
        <PassCard
          pass={anchor.pass}
          state={state}
          onShowTicket={onShowTicket}
        />
      ) : null}
    </>
  );
}

function MovementCard({
  anchor,
  movement,
  active,
}: {
  anchor: SpineAnchor;
  movement: TimedLeg;
  active: boolean;
}) {
  const mode =
    anchor.navMode === "drive"
      ? "Drive"
      : anchor.navMode === "cycle"
        ? "Cycle"
        : "Walk";
  const iconKind: SpineIconKind =
    mode === "Drive" ? "drive" : mode === "Cycle" ? "cycle" : "walk";
  const destination = anchor.station
    ? anchor.title
    : (anchor.place ?? anchor.title);

  return (
    <div className="cc-node" data-state={active ? "next" : "future"}>
      <div className="cc-node-dot">
        <SpineIcon kind={iconKind} active={active} />
      </div>
      <div className="pg cc-walk">
        <div className="cc-walk-head">
          <span className="cc-walk-mode">{mode}</span>
          <span className="cc-walk-mins mono engr">
            {anchor.plannedTravelMinutes} min
          </span>
        </div>
        {movement.departIso && movement.arriveIso ? (
          <div className="cc-walk-window">
            <span className="mono cc-walk-time">
              {londonClock(movement.departIso)}
            </span>
            <span className="cc-walk-rule" aria-hidden />
            <span className="mono cc-walk-time">
              {londonClock(movement.arriveIso)}
            </span>
          </div>
        ) : null}
        <div className="cc-walk-dest">
          <span>→ {destination}</span>
          {movement.spareMinutes != null && movement.spareMinutes > 0 ? (
            <span className="cc-walk-spare">
              {movement.spareMinutes} min spare
            </span>
          ) : movement.spareMinutes != null && movement.spareMinutes < 0 ? (
            <span className="cc-walk-spare">
              {Math.abs(movement.spareMinutes)} min late
            </span>
          ) : null}
        </div>
        <div className="cc-walk-foot">
          <span className="sb">Planned</span>
        </div>
      </div>
    </div>
  );
}

function HubArrivalCard({
  anchor,
  movement,
  state,
}: {
  anchor: SpineAnchor;
  movement: TimedLeg;
  state: State;
}) {
  const arrival = movement.arriveIso
    ? londonClock(movement.arriveIso)
    : null;
  const departure = londonClock(anchor.arriveByIso);
  const dwell = movement.spareMinutes;

  return (
    <div className="cc-node" data-state={state}>
      <div className="cc-node-dot">
        <SpineIcon kind="hub" />
      </div>
      <div
        className="cc-hub-arrival"
        data-past={state === "past" || undefined}
      >
        <div className="cc-hub-arrival-copy">
          <span className="cc-eyebrow">Arrive at station</span>
          <strong>{anchor.title}</strong>
        </div>
        <div className="cc-hub-arrival-window">
          <span>
            <small>Arrive</small>
            <strong className="mono">{arrival ?? "—"}</strong>
          </span>
          <span className="cc-hub-arrival-arrow" aria-hidden>
            →
          </span>
          <span>
            <small>Train</small>
            <strong className="mono">{departure}</strong>
          </span>
        </div>
        {dwell != null && dwell > 0 ? (
          <span className="cc-hub-arrival-buffer">
            {dwell} min at station
          </span>
        ) : null}
      </div>
    </div>
  );
}

function AppointmentCard({
  anchor,
  state,
}: {
  anchor: SpineAnchor;
  state: State;
}) {
  return (
    <div className="cc-node" data-state={state}>
      <div className="cc-node-dot">
        <SpineIcon kind="appointment" />
      </div>
      <div className="pg cc-appt" data-past={state === "past" || undefined}>
        <div className="cc-appt-head">
          <span className="cc-eyebrow">{TYPE_LABEL[anchor.type]}</span>
        </div>
        <h3 className="cc-appt-title">{anchor.title}</h3>
        {anchor.place && anchor.place !== anchor.title ? (
          <p className="cc-appt-sub">{anchor.place}</p>
        ) : null}
        <div className="cc-appt-times">
          {anchor.arriveByIso ? (
            <span className="cc-appt-time">
              <span className="cc-eyebrow">Starts</span>
              <span className="mono engr cc-appt-clock">
                {londonClock(anchor.arriveByIso)}
              </span>
            </span>
          ) : null}
          {anchor.endIso ? (
            <span className="cc-appt-time">
              <span className="cc-eyebrow">Ends</span>
              <span className="mono engr cc-appt-clock">
                {londonClock(anchor.endIso)}
              </span>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AnchorCard({
  anchor,
  state,
}: {
  anchor: SpineAnchor;
  state: State;
}) {
  const station = anchor.station;
  const eyebrow = station
    ? roleLabel(anchor.role, station)
    : TYPE_LABEL[anchor.type];

  return (
    <div className="cc-node" data-state={state}>
      <div className="cc-node-dot">
        <SpineIcon kind={station ? "hub" : "appointment"} />
      </div>
      <div
        className="cc-station-card"
        data-past={state === "past" || undefined}
      >
        <div className="cc-station-card-head">
          <span className="cc-eyebrow">{eyebrow}</span>
          <span className="mono cc-station-time">
            {londonClock(anchor.arriveByIso)}
          </span>
        </div>
        <strong className="cc-station-title">{anchor.title}</strong>
      </div>
    </div>
  );
}

function ChangeCard({
  anchor,
  state,
}: {
  anchor: SpineAnchor;
  state: State;
}) {
  const arrive = ms(anchor.arriveByIso);
  const depart = ms(anchor.endIso);
  const minutes =
    arrive != null && depart != null
      ? Math.max(0, Math.round((depart - arrive) / 60_000))
      : null;

  return (
    <div className="cc-node" data-state={state}>
      <div className="cc-node-dot">
        <SpineIcon kind="change" />
      </div>
      <div
        className="cc-transfer"
        data-past={state === "past" || undefined}
      >
        <div className="cc-transfer-main">
          <span className="cc-eyebrow">Change at</span>
          <strong>{anchor.station?.name ?? anchor.title}</strong>
        </div>
        {minutes != null ? (
          <div className="cc-transfer-duration">
            <strong className="mono">{minutes} min</strong>
            <span>connection</span>
          </div>
        ) : null}
        <div className="cc-transfer-window">
          <span>
            <small>Arrive</small>
            <strong className="mono">
              {londonClock(anchor.arriveByIso)}
            </strong>
          </span>
          <span className="cc-transfer-arrow" aria-hidden>
            →
          </span>
          <span>
            <small>Depart</small>
            <strong className="mono">{londonClock(anchor.endIso)}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}

function PassCard({
  pass,
  state,
  onShowTicket,
}: {
  pass: NonNullable<SpineAnchor["pass"]>;
  state: State;
  onShowTicket: (ticket: TicketVM) => void;
}) {
  return (
    <div
      className="cc-node"
      data-state={state}
      data-past={state === "past" || undefined}
    >
      <div className="cc-node-dot">
        <SpineIcon kind="train" active={state === "next"} />
      </div>
      <LivePass
        ticket={pass.ticket}
        crs={pass.crs}
        time={pass.time}
        dest={pass.dest}
        docked
        onShow={onShowTicket}
      />
    </div>
  );
}

function Toggle({
  label,
  open,
  onClick,
}: {
  label: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="cc-spine-toggle" onClick={onClick}>
      {open ? "Hide" : "Show"} {label}
    </button>
  );
}

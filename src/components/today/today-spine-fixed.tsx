"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bike,
  BriefcaseBusiness,
  CarFront,
  Footprints,
  MapPin,
  Plane,
  RefreshCw,
  Ticket,
  TrainFront,
} from "lucide-react";
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
import { loadEndContextForStop } from "@/lib/actions/today-bookend";

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

  return (
    normalisePlace(destination.place) === normalisePlace(anchor.station.name)
  );
}

function movementTimes(
  anchor: SpineAnchor,
  previous: SpineAnchor | null,
): TimedLeg {
  const minutes = anchor.plannedTravelMinutes;
  const targetMs = ms(anchor.arriveByIso);
  if (minutes == null || targetMs == null)
    return { departIso: null, arriveIso: null, spareMinutes: null };

  const durationMs = minutes * 60_000;
  const bufferMinutes =
    anchor.bufferMinutes ??
    (anchor.station ? STATION_BUFFER_MIN : READINESS_BUFFER_MIN);
  const preferredArrivalMs = targetMs - bufferMinutes * 60_000;
  const preferredDepartureMs = preferredArrivalMs - durationMs;
  const previousEndMs = previous
    ? ms(previous.endIso ?? previous.arriveByIso)
    : null;
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

export function TodaySpine({
  anchors,
  nextId,
  nowOverride,
  toolbar,
  resolveEndContext = true,
}: {
  anchors: SpineAnchor[];
  nextId?: string | null;
  nowOverride?: number | null;
  toolbar?: ReactNode;
  resolveEndContext?: boolean;
}) {
  const [internalNow, setInternalNow] = useState(() => Date.now());
  const [showPast, setShowPast] = useState(false);
  const [showLater, setShowLater] = useState(false);
  const [scan, setScan] = useState<{
    summary: string;
    barcodes: BarcodeVM[];
  } | null>(null);
  const [endContext, setEndContext] = useState<SpineAnchor | null>(null);
  const finalVisibleId = anchors[anchors.length - 1]?.id ?? null;

  useEffect(() => {
    if (nowOverride != null) return;
    const timer = setInterval(() => setInternalNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [nowOverride]);

  useEffect(() => {
    let active = true;
    setEndContext(null);
    if (!resolveEndContext || !finalVisibleId)
      return () => {
        active = false;
      };
    void loadEndContextForStop(finalVisibleId).then((context) => {
      if (active) setEndContext(context);
    });
    return () => {
      active = false;
    };
  }, [finalVisibleId, resolveEndContext]);

  const resolvedAnchors = useMemo(() => {
    if (!endContext || anchors.some((anchor) => anchor.id === endContext.id))
      return anchors;
    return [...anchors, endContext];
  }, [anchors, endContext]);

  const now = nowOverride ?? internalNow;
  const activeNextId = useMemo(() => {
    const engineAnchors: EngineAnchor[] = resolvedAnchors.map((anchor) => ({
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
      : (resolvedAnchors[index]?.id ?? nextId ?? null);
  }, [resolvedAnchors, nextId, now]);

  if (!resolvedAnchors.length) return null;

  const nextIndex = Math.max(
    0,
    resolvedAnchors.findIndex((anchor) => anchor.id === activeNextId),
  );
  const past = resolvedAnchors.slice(0, nextIndex);
  const currentAndNear = resolvedAnchors.slice(
    nextIndex,
    Math.min(resolvedAnchors.length, nextIndex + 5),
  );
  const later = resolvedAnchors.slice(
    Math.min(resolvedAnchors.length, nextIndex + 5),
  );

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
          {resolvedAnchors.length} timed point
          {resolvedAnchors.length === 1 ? "" : "s"}
        </span>
      </div>
      {toolbar ? <div className="cc-spine-toolbar">{toolbar}</div> : null}
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
        <div className="cc-node">
          <div className="cc-node-dot">
            <span className="cc-dot-now" />
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
              previous={
                absoluteIndex > 0 ? resolvedAnchors[absoluteIndex - 1] : null
              }
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
                  const absoluteIndex =
                    resolvedAnchors.length - later.length + index;
                  return (
                    <Entry
                      key={anchor.id}
                      anchor={anchor}
                      previous={
                        absoluteIndex > 0
                          ? resolvedAnchors[absoluteIndex - 1]
                          : null
                      }
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
  const showAnchor =
    !anchor.contextOnly && !passOwnsStation && !arrivalCoveredByPass;

  return (
    <>
      {showMovement ? (
        <MovementCard
          anchor={anchor}
          movement={movement}
          active={state === "next"}
        />
      ) : null}
      {showAnchor && anchor.role === "changeover" ? (
        <ChangeCard anchor={anchor} state={state} />
      ) : showAnchor && isAppointment ? (
        <AppointmentCard anchor={anchor} state={state} />
      ) : showAnchor ? (
        <AnchorCard anchor={anchor} state={state} />
      ) : null}
      {!anchor.contextOnly && anchor.pass ? (
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
  const destination = anchor.station
    ? anchor.title
    : (anchor.place ?? anchor.title);
  return (
    <div className="cc-node" data-state={active ? "next" : "future"}>
      <div className="cc-node-dot">
        <TimelineGlyph
          kind={
            anchor.navMode === "drive"
              ? "drive"
              : anchor.navMode === "cycle"
                ? "cycle"
                : "walk"
          }
        />
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
            <span className="cc-walk-rule" aria-hidden>
              →
            </span>
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
        <TimelineGlyph kind="appointment" />
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

function AnchorCard({ anchor, state }: { anchor: SpineAnchor; state: State }) {
  const station = anchor.station;
  const eyebrow = station
    ? roleLabel(anchor.role, station)
    : TYPE_LABEL[anchor.type];
  return (
    <div className="cc-node" data-state={state}>
      <div className="cc-node-dot">
        <TimelineGlyph kind="place" />
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

function ChangeCard({ anchor, state }: { anchor: SpineAnchor; state: State }) {
  const arrive = ms(anchor.arriveByIso);
  const depart = ms(anchor.endIso);
  const minutes =
    arrive != null && depart != null
      ? Math.max(0, Math.round((depart - arrive) / 60_000))
      : null;
  return (
    <div className="cc-node" data-state={state}>
      <div className="cc-node-dot">
        <TimelineGlyph kind="change" />
      </div>
      <div className="cc-transfer" data-past={state === "past" || undefined}>
        <div className="cc-transfer-head">
          <span>
            <span className="cc-eyebrow">Change</span>
            <strong>{anchor.station?.name ?? anchor.title}</strong>
          </span>
          {minutes != null ? (
            <span className="mono engr">{minutes}m</span>
          ) : null}
        </div>
        <p className="cc-transfer-time">
          {londonClock(anchor.arriveByIso)} arrival ·{" "}
          {londonClock(anchor.endIso)} onward
        </p>
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
        <TimelineGlyph
          kind={
            pass.ticket.kind === "rail"
              ? "rail"
              : pass.ticket.kind === "air"
                ? "air"
                : "ticket"
          }
        />
      </div>
      <LivePass
        ticket={pass.ticket}
        crs={pass.crs}
        time={pass.time}
        dest={pass.dest}
        docked
        today
        onShow={onShowTicket}
      />
    </div>
  );
}

function TimelineGlyph({
  kind,
}: {
  kind:
    | "walk"
    | "cycle"
    | "drive"
    | "rail"
    | "air"
    | "ticket"
    | "change"
    | "appointment"
    | "place";
}) {
  const Icon =
    kind === "walk"
      ? Footprints
      : kind === "cycle"
        ? Bike
        : kind === "drive"
          ? CarFront
          : kind === "rail"
            ? TrainFront
            : kind === "air"
              ? Plane
              : kind === "change"
                ? RefreshCw
                : kind === "appointment"
                  ? BriefcaseBusiness
                  : kind === "place"
                    ? MapPin
                    : Ticket;

  return (
    <span className="cc-timeline-icon" data-kind={kind}>
      <Icon aria-hidden />
    </span>
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

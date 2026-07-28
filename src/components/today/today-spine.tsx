"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SpineAnchor } from "./spine-model";
import { londonClock, navigateHref, roleLabel } from "./spine-model";
import { pickNextIndex, READINESS_BUFFER_MIN, STATION_BUFFER_MIN, type EngineAnchor } from "@/lib/today/engine";
import { LivePass } from "@/components/plan/live-pass";
import { ScanView } from "@/components/concierge";
import type { BarcodeVM, TicketVM } from "@/components/concierge";

const TYPE_LABEL: Record<SpineAnchor["type"], string> = {
  appointment: "Appointment",
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

/**
 * Turn a stored duration into an honest chronological movement.
 *
 * A station anchor's timestamp is the train departure, so the walking leg must
 * finish before the user's boarding buffer. For ordinary commitments we prefer
 * to set off as soon as the preceding fixed point finishes; this shows the real
 * journey (08:21–08:30), not a misleading latest-safe window (08:51–09:00).
 */
function movementTimes(anchor: SpineAnchor, previous: SpineAnchor | null): TimedLeg {
  const minutes = anchor.plannedTravelMinutes;
  const targetMs = ms(anchor.arriveByIso);
  if (minutes == null || targetMs == null) return { departIso: null, arriveIso: null, spareMinutes: null };

  const durationMs = minutes * 60_000;
  const bufferMinutes = anchor.bufferMinutes ?? (anchor.station ? STATION_BUFFER_MIN : READINESS_BUFFER_MIN);
  const latestArrivalMs = targetMs - bufferMinutes * 60_000;
  const previousEndMs = previous ? ms(previous.endIso ?? previous.arriveByIso) : null;

  if (anchor.station) {
    const arriveMs = latestArrivalMs;
    return {
      departIso: iso(arriveMs - durationMs),
      arriveIso: iso(arriveMs),
      spareMinutes: bufferMinutes,
    };
  }

  if (previousEndMs != null) {
    const arriveMs = previousEndMs + durationMs;
    const spare = Math.max(0, Math.round((targetMs - arriveMs) / 60_000));
    return {
      departIso: iso(previousEndMs),
      arriveIso: iso(arriveMs),
      spareMinutes: spare,
    };
  }

  return {
    departIso: iso(latestArrivalMs - durationMs),
    arriveIso: iso(latestArrivalMs),
    spareMinutes: bufferMinutes,
  };
}

export function TodaySpine({ anchors, nextId, nowOverride }: { anchors: SpineAnchor[]; nextId?: string | null; nowOverride?: number | null }) {
  const [internalNow, setInternalNow] = useState(() => Date.now());
  const [showPast, setShowPast] = useState(false);
  const [showLater, setShowLater] = useState(false);
  const [scan, setScan] = useState<{ summary: string; barcodes: BarcodeVM[] } | null>(null);

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
    }));
    const index = pickNextIndex(engineAnchors, now);
    return index == null ? nextId ?? null : anchors[index]?.id ?? nextId ?? null;
  }, [anchors, nextId, now]);

  if (!anchors.length) return null;

  const nextIndex = Math.max(0, anchors.findIndex((anchor) => anchor.id === activeNextId));
  const past = anchors.slice(0, nextIndex);
  const currentAndNear = anchors.slice(nextIndex, Math.min(anchors.length, nextIndex + 5));
  const later = anchors.slice(Math.min(anchors.length, nextIndex + 5));

  const openTicket = (ticket: TicketVM) => {
    const leg = ticket.legs[0];
    if (!leg?.barcodes?.length) return;
    setScan({ summary: `${ticket.operator} · ${leg.origin.place} → ${leg.destination.place}`, barcodes: leg.barcodes });
  };

  return (
    <section>
      <div className="cc-eyebrow" style={{ marginBottom: "var(--space-3)" }}>Your day</div>
      <div className="cc-spine cc-spine-v7">
        <div className="cc-spine-rail" />

        {past.length ? (
          <Toggle label={`${past.length} earlier`} open={showPast} onClick={() => setShowPast((value) => !value)} />
        ) : null}
        {showPast ? past.map((anchor, index) => (
          <Entry key={anchor.id} anchor={anchor} previous={index ? past[index - 1] : null} state="past" onShowTicket={openTicket} />
        )) : null}

        <div className="cc-node">
          <div className="cc-node-dot"><span className="cc-dot-now" /></div>
          <span className="cc-eyebrow" style={{ alignSelf: "center", color: "var(--gold-2)" }}>Now · {londonClock(new Date(now).toISOString())}</span>
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
            <Toggle label={`${later.length} later`} open={showLater} onClick={() => setShowLater((value) => !value)} />
            {showLater ? later.map((anchor, index) => {
              const absoluteIndex = anchors.length - later.length + index;
              return <Entry key={anchor.id} anchor={anchor} previous={absoluteIndex > 0 ? anchors[absoluteIndex - 1] : null} state="future" onShowTicket={openTicket} />;
            }) : null}
          </>
        ) : null}
      </div>
      {scan ? <ScanView summary={scan.summary} barcodes={scan.barcodes} onClose={() => setScan(null)} /> : null}
    </section>
  );
}

function Entry({ anchor, previous, state, onShowTicket }: { anchor: SpineAnchor; previous: SpineAnchor | null; state: State; onShowTicket: (ticket: TicketVM) => void }) {
  const movement = movementTimes(anchor, previous);
  const isAppointment = anchor.type === "appointment" || anchor.type === "reservation";
  const showMovement = anchor.plannedTravelMinutes != null && !!navigateHref(anchor) && state !== "past";

  return (
    <>
      {showMovement ? <MovementCard anchor={anchor} movement={movement} active={state === "next"} /> : null}
      {anchor.role === "changeover" ? <ChangeCard anchor={anchor} state={state} /> : isAppointment ? <AppointmentCard anchor={anchor} state={state} /> : <AnchorCard anchor={anchor} state={state} />}
      {anchor.pass ? <PassCard pass={anchor.pass} state={state} onShowTicket={onShowTicket} /> : null}
    </>
  );
}

function MovementCard({ anchor, movement, active }: { anchor: SpineAnchor; movement: TimedLeg; active: boolean }) {
  const href = navigateHref(anchor)!;
  const mode = anchor.navMode === "drive" ? "Drive" : anchor.navMode === "cycle" ? "Cycle" : "Walk";
  const destination = anchor.station ? anchor.title : anchor.place ?? anchor.title;
  return (
    <div className="cc-node" data-state={active ? "next" : "future"}>
      <div className="cc-node-dot"><span className="cc-med-leg" /></div>
      <div className="pg cc-walk">
        <div className="cc-walk-head">
          <span className="cc-walk-mode">{mode}</span>
          <span className="cc-walk-mins mono engr">{anchor.plannedTravelMinutes} min</span>
          {active ? <Link href={href} className="cc-btn cc-btn-gold cc-walk-nav">Navigate</Link> : null}
        </div>
        {movement.departIso && movement.arriveIso ? (
          <div className="cc-walk-window">
            <span className="mono cc-walk-time">{londonClock(movement.departIso)}</span>
            <span className="cc-walk-rule" aria-hidden />
            <span className="mono cc-walk-time">{londonClock(movement.arriveIso)}</span>
          </div>
        ) : null}
        <div className="cc-walk-dest">
          <span>→ {destination}</span>
          {movement.spareMinutes != null && movement.spareMinutes > 0 ? <span className="cc-walk-spare">{movement.spareMinutes} min spare</span> : null}
        </div>
        <div className="cc-walk-foot"><span className="sb">Planned</span></div>
      </div>
    </div>
  );
}

function AppointmentCard({ anchor, state }: { anchor: SpineAnchor; state: State }) {
  return (
    <div className="cc-node" data-state={state}>
      <div className="cc-node-dot"><span className="cc-med-anchor" /></div>
      <div className="pg cc-appt" data-past={state === "past" || undefined}>
        <div className="cc-appt-head"><span className="cc-eyebrow">{TYPE_LABEL[anchor.type]}</span></div>
        <h3 className="cc-appt-title">{anchor.title}</h3>
        {anchor.place && anchor.place !== anchor.title ? <p className="cc-appt-sub">{anchor.place}</p> : null}
        <div className="cc-appt-times">
          {anchor.arriveByIso ? <span className="cc-appt-time"><span className="cc-eyebrow">Starts</span><span className="mono engr cc-appt-clock">{londonClock(anchor.arriveByIso)}</span></span> : null}
          {anchor.endIso ? <span className="cc-appt-time"><span className="cc-eyebrow">Ends</span><span className="mono engr cc-appt-clock">{londonClock(anchor.endIso)}</span></span> : null}
        </div>
      </div>
    </div>
  );
}

function AnchorCard({ anchor, state }: { anchor: SpineAnchor; state: State }) {
  const station = anchor.station;
  const eyebrow = station ? roleLabel(anchor.role, station) : TYPE_LABEL[anchor.type];
  const href = navigateHref(anchor);
  return (
    <div className="cc-node" data-state={state}>
      <div className="cc-node-dot"><span className="cc-med-anchor" /></div>
      <div className="pg" style={{ padding: "var(--space-3) var(--space-4)", opacity: state === "past" ? 0.6 : 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span className="cc-eyebrow">{eyebrow}</span>
          <span className="mono">{londonClock(anchor.arriveByIso)}</span>
        </div>
        <strong style={{ display: "block", marginTop: 6 }}>{anchor.title}</strong>
        {state === "next" && href && anchor.plannedTravelMinutes == null ? <Link href={href} className="cc-btn cc-btn-gold" style={{ display: "inline-flex", marginTop: 10 }}>Navigate</Link> : null}
      </div>
    </div>
  );
}

function ChangeCard({ anchor, state }: { anchor: SpineAnchor; state: State }) {
  const arrive = ms(anchor.arriveByIso);
  const depart = ms(anchor.endIso);
  const minutes = arrive != null && depart != null ? Math.max(0, Math.round((depart - arrive) / 60_000)) : null;
  return (
    <div className="cc-node" data-state={state}>
      <div className="cc-node-dot"><span className="cc-med-change" /></div>
      <div className="pg" style={{ padding: "var(--space-3) var(--space-4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <strong>Change at {anchor.station?.name ?? anchor.title}</strong>
          {minutes != null ? <span className="mono engr">{minutes}m</span> : null}
        </div>
        <p style={{ margin: "8px 0 0", color: "var(--ink-dim)" }}>{londonClock(anchor.arriveByIso)} arrival · {londonClock(anchor.endIso)} onward</p>
      </div>
    </div>
  );
}

function PassCard({ pass, state, onShowTicket }: { pass: NonNullable<SpineAnchor["pass"]>; state: State; onShowTicket: (ticket: TicketVM) => void }) {
  return (
    <div className="cc-node" data-state={state} style={{ opacity: state === "past" ? 0.6 : 1 }}>
      <div className="cc-node-dot"><span className="cc-med-pass" /></div>
      <div className="cc-pass-inline"><LivePass ticket={pass.ticket} crs={pass.crs} time={pass.time} dest={pass.dest} onShow={onShowTicket} /></div>
    </div>
  );
}

function Toggle({ label, open, onClick }: { label: string; open: boolean; onClick: () => void }) {
  return (
    <div className="cc-node">
      <div className="cc-node-dot"><span className="cc-med-leg" /></div>
      <button type="button" onClick={onClick} aria-expanded={open} className="cc-btn cc-btn-ghost">{open ? "Hide" : "Show"} {label}</button>
    </div>
  );
}

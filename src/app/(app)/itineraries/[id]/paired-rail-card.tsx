"use client";

// PairedRailCard (Phase 5 follow-up) — wires getRailCandidatesForGap into the
// stepper card. Fetches outbound + return candidates for the rail pair, lets
// the user step through alternatives (chevrons), shows the consequence band
// (on-site window), the pair fare, and a Stage-0 "Book pair on Trainline"
// deeplink. When the timetable provider isn't connected it says so honestly
// rather than inventing times.

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Train } from "lucide-react";
import {
  getRailCandidatesForGap,
  type RailCandidatesResult,
} from "@/lib/actions/planning";
import {
  pairFare,
  type OutboundCandidate,
  type ReturnCandidate,
} from "@/lib/planning/rail-candidates";
import { trainlineDeeplink } from "@/lib/planning/booking-lifecycle";
import { formatTimeInTz } from "@/lib/types/time";
import type { RailPair } from "./planning-data";

const mono = { fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums" as const };

export function PairedRailCard({ railPair, timezone }: { railPair: RailPair; timezone: string }) {
  const [out, setOut] = useState<OutboundCandidate[] | null>(null);
  const [ret, setRet] = useState<ReturnCandidate[] | null>(null);
  const [outIdx, setOutIdx] = useState(0);
  const [retIdx, setRetIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    (async () => {
      const calls: Promise<void>[] = [];
      if (railPair.outbound) {
        calls.push(
          getRailCandidatesForGap({
            from_stop_id: railPair.outbound.fromStopId,
            to_stop_id: railPair.outbound.toStopId,
            direction: "outbound",
            arrive_by: railPair.outbound.arriveBy ?? null,
          }).then((res) => {
            if (live && res.ok) {
              setOut(res.value.candidates as OutboundCandidate[]);
              noteReason(res.value);
            }
          }),
        );
      }
      if (railPair.return?.departAfter) {
        calls.push(
          getRailCandidatesForGap({
            from_stop_id: railPair.return.fromStopId,
            to_stop_id: railPair.return.toStopId,
            direction: "return",
            depart_after: railPair.return.departAfter,
          }).then((res) => {
            if (live && res.ok) {
              setRet(res.value.candidates as ReturnCandidate[]);
              noteReason(res.value);
            }
          }),
        );
      }
      await Promise.all(calls);
      if (live) setLoading(false);
    })();
    function noteReason(v: RailCandidatesResult) {
      if (v.mode === "unavailable") setReason(v.reason ?? "Timetable not connected");
    }
    return () => {
      live = false;
    };
  }, [railPair]);

  const o = out?.[outIdx] ?? null;
  const r = ret?.[retIdx] ?? null;
  const fmt = (iso: string | null | undefined) =>
    iso ? formatTimeInTz(new Date(iso), timezone) : "—";

  const fare = o && r ? pairFare(o, r) : null;
  const hasCandidates = (out?.length ?? 0) > 0 || (ret?.length ?? 0) > 0;

  return (
    <div style={{ borderRadius: 10, background: "var(--card)", border: "1px solid var(--rule)", boxShadow: "0 8px 26px -18px rgba(30,24,18,0.4)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 16px 0" }}>
        <Train size={14} color="var(--ink-2)" />
        <span style={{ ...mono, fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-2)", fontWeight: 600 }}>
          Rail · outbound{railPair.return ? " + return" : ""}
        </span>
      </div>

      <div style={{ padding: "12px 16px 16px" }}>
        {loading && <Muted>Checking the timetable…</Muted>}

        {!loading && !hasCandidates && (
          <div>
            <Muted>{reason ?? "No times found for this journey."}</Muted>
            {railPair.outbound?.fromCode && railPair.outbound?.toCode && (
              <TrainlineButton railPair={railPair} />
            )}
          </div>
        )}

        {!loading && hasCandidates && (
          <>
            {out && out.length > 0 && o && (
              <Leg
                eyebrow="Outbound"
                main={`${fmt(o.dep)} → ${fmt(o.arr)}`}
                sub={`leave home ${fmt(o.leaveHome)} · ${o.changes} change${o.changes === 1 ? "" : "s"}`}
                idx={outIdx}
                max={out.length - 1}
                onStep={setOutIdx}
              />
            )}

            {o && r && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, margin: "14px 0", padding: 10, borderRadius: 6, background: "var(--gold-soft)", border: "1px solid var(--gold)", ...mono, fontSize: 12, color: "var(--ink)" }}>
                on-site {fmt(o.onSiteStart)}–{fmt(r.leaveAppointmentBy)}
                <span style={{ color: "var(--gold-2)", fontWeight: 500 }}>· {durStr(o.onSiteStart, r.leaveAppointmentBy)}</span>
              </div>
            )}

            {ret && ret.length > 0 && r && (
              <Leg
                eyebrow="Return"
                main={`${fmt(r.dep)} ← ${fmt(r.arr)}`}
                sub={`leave appointment by ${fmt(r.leaveAppointmentBy)} · home ${fmt(r.arriveHome)}`}
                idx={retIdx}
                max={ret.length - 1}
                onStep={setRetIdx}
              />
            )}

            <div style={{ marginTop: 16, paddingTop: 15, borderTop: "1px solid var(--rule)" }}>
              {fare && (
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--ink-2)" }}>
                    {fare.qualifiesForReturnFare ? "Return ticket" : "Two singles"}
                    {fare.savingsVsTwoSinglesPence > 0 && (
                      <span style={{ ...mono, fontSize: 10.5, color: "var(--ink-dim)" }}> · saves £{(fare.savingsVsTwoSinglesPence / 100).toFixed(0)}</span>
                    )}
                  </span>
                  {fare.returnTicketPricePence != null && (
                    <span style={{ fontFamily: "var(--display)", fontSize: 19, fontWeight: 500, color: "var(--ink)" }}>~£{(fare.returnTicketPricePence / 100).toFixed(0)}</span>
                  )}
                </div>
              )}
              <TrainlineButton railPair={railPair} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Leg({ eyebrow, main, sub, idx, max, onStep }: { eyebrow: string; main: string; sub: string; idx: number; max: number; onStep: (n: number) => void }) {
  const atFirst = idx === 0;
  const atLast = idx >= max;
  return (
    <div>
      <div style={{ ...mono, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-dim)", marginBottom: 8 }}>{eyebrow}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <StepBtn dir="left" disabled={atFirst} onClick={() => !atFirst && onStep(idx - 1)} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ ...mono, fontSize: 17, color: "var(--ink)" }}>{main}</div>
          <div style={{ ...mono, fontSize: 10, color: "var(--ink-dim)", marginTop: 3 }}>{sub}</div>
        </div>
        <StepBtn dir="right" disabled={atLast} onClick={() => !atLast && onStep(idx + 1)} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "0 4px", marginTop: 5 }}>
        <span style={{ ...mono, fontSize: 8.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-faint)" }}>earlier</span>
        <span style={{ ...mono, fontSize: 8.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-faint)" }}>later</span>
      </div>
    </div>
  );
}

function StepBtn({ dir, disabled, onClick }: { dir: "left" | "right"; disabled: boolean; onClick: () => void }) {
  return (
    <button disabled={disabled} onClick={onClick} style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--rule-2)", background: "var(--paper)", cursor: disabled ? "default" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: disabled ? 0.3 : 1 }}>
      {dir === "left" ? <ChevronLeft size={15} color="var(--ink-2)" /> : <ChevronRight size={15} color="var(--ink-2)" />}
    </button>
  );
}

function TrainlineButton({ railPair }: { railPair: RailPair }) {
  const leg = railPair.outbound ?? railPair.return;
  if (!leg?.fromCode || !leg?.toCode) return null;
  const href = trainlineDeeplink({
    originCode: leg.fromCode,
    destinationCode: leg.toCode,
    outwardDate: railPair.outwardDate,
    returnDate: railPair.returnDate,
  });
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: "block", width: "100%", textAlign: "center", padding: "13px", borderRadius: 4, background: "var(--ink)", color: "var(--paper)", textDecoration: "none", fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 500 }}>
      Book {railPair.return ? "pair" : "outbound"} on Trainline →
    </a>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: "var(--serif)", fontSize: 13.5, color: "var(--ink-dim)", padding: "4px 0 10px" }}>{children}</div>;
}

function durStr(aIso: string, bIso: string): string {
  let d = Math.round((new Date(bIso).getTime() - new Date(aIso).getTime()) / 60_000);
  if (d < 0) d += 1440;
  const h = Math.floor(d / 60);
  const m = d % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

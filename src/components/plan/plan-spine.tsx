"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnchorCard, LegCard, GapCard } from "@/components/concierge";
import type {
  AnchorVM,
  AnchorVariableKind,
  AnchorVariableSlot,
  LegVM,
  GapVM,
} from "@/components/concierge";
import { setAnchorVariable } from "@/lib/actions/plan-edit";

// The interactive planner spine (planner master brief §5). Renders the
// chronological rail of anchors + the leg/gap between each pair, and hosts the
// AnchorCard three-variable editor (§5.3): tap a variable → pick its kind +
// value → persist → the engine re-solves and the derived value recomputes.

export type SpineNode = {
  anchor: AnchorVM;
  after?: { kind: "leg"; leg: LegVM } | { kind: "gap"; gap: GapVM } | null;
};

type EditTarget = { anchor: AnchorVM; slot: AnchorVariableSlot };

export function PlanSpine({
  nodes,
  journeyDate,
}: {
  nodes: SpineNode[];
  journeyDate: string;
}) {
  const [edit, setEdit] = useState<EditTarget | null>(null);

  return (
    <>
      <div className="cc-spine">
        <span className="cc-spine-rail" />
        {nodes.map((n) => (
          <div key={n.anchor.id}>
            <div className="cc-node">
              <div className="cc-node-dot">
                <span className="cc-dot-anchor" />
              </div>
              <div>
                <AnchorCard
                  anchor={n.anchor}
                  onEditVariable={(id, slot) => setEdit({ anchor: n.anchor, slot })}
                />
              </div>
            </div>
            {n.after ? (
              <div className="cc-node">
                <div className="cc-node-dot">
                  <span className={n.after.kind === "leg" ? "cc-dot-leg" : "cc-dot-gap"} />
                </div>
                <div>
                  {n.after.kind === "leg" ? (
                    <LegCard leg={n.after.leg} />
                  ) : (
                    <GapCard gap={n.after.gap} />
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {edit ? (
        <VariableEditor
          target={edit}
          journeyDate={journeyDate}
          onClose={() => setEdit(null)}
        />
      ) : null}
    </>
  );
}

// Which kinds are offered per slot (planner master brief §5.3).
const KINDS_FOR: Record<AnchorVariableSlot, { kind: AnchorVariableKind; label: string }[]> = {
  arriveBy: [
    { kind: "precise", label: "At" },
    { kind: "approximate", label: "Around" },
    { kind: "by-a-time", label: "By" },
  ],
  leaveBy: [
    { kind: "precise", label: "At" },
    { kind: "by-a-time", label: "By" },
    { kind: "maximise", label: "As long as possible" },
  ],
  duration: [
    { kind: "precise", label: "Exactly" },
    { kind: "approximate", label: "About" },
    { kind: "maximise", label: "As long as possible" },
  ],
};

const SLOT_TITLE: Record<AnchorVariableSlot, string> = {
  arriveBy: "Arrive by",
  duration: "How long",
  leaveBy: "Leave by",
};

function VariableEditor({
  target,
  journeyDate,
  onClose,
}: {
  target: EditTarget;
  journeyDate: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { anchor, slot } = target;
  const existing = anchor.vars?.[slot];
  const isDuration = slot === "duration";

  const [kind, setKind] = useState<AnchorVariableKind>(
    existing && existing.kind !== "derived" ? existing.kind : KINDS_FOR[slot][0].kind,
  );
  const [time, setTime] = useState<string>(isoToHHMM(existing?.iso));
  const [hours, setHours] = useState<number>(Math.floor((existing?.minutes ?? 60) / 60));
  const [mins, setMins] = useState<number>((existing?.minutes ?? 60) % 60);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const needsValue = kind !== "maximise";

  function save() {
    setError(null);
    const payload: Parameters<typeof setAnchorVariable>[0] = { stopId: anchor.id, slot, kind };
    if (isDuration) {
      if (needsValue) payload.minutes = hours * 60 + mins;
    } else if (needsValue) {
      if (!time) {
        setError("Pick a time.");
        return;
      }
      payload.iso = hhmmToIso(baseDate(anchor, slot, journeyDate), time);
    }
    startTransition(async () => {
      const res = await setAnchorVariable(payload);
      if (!res.ok) {
        setError(res.error ?? "Couldn't save.");
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="cc-sheet-scrim" onClick={onClose}>
      <div className="cc-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="cc-sheet-grip" />
        <header className="cc-sheet-head">
          <span className="cc-eyebrow">{anchor.title}</span>
          <h3 className="cc-sheet-title">{SLOT_TITLE[slot]}</h3>
        </header>

        <div className="cc-kind-row">
          {KINDS_FOR[slot].map((k) => (
            <button
              key={k.kind}
              type="button"
              className="cc-kind-chip"
              data-active={k.kind === kind ? "" : undefined}
              onClick={() => setKind(k.kind)}
            >
              {k.label}
            </button>
          ))}
        </div>

        {needsValue ? (
          isDuration ? (
            <div className="cc-dur-row">
              <label>
                <span className="cc-var-label">Hours</span>
                <input type="number" min={0} max={23} value={hours}
                  onChange={(e) => setHours(clamp(+e.target.value, 0, 23))} />
              </label>
              <label>
                <span className="cc-var-label">Minutes</span>
                <input type="number" min={0} max={59} step={5} value={mins}
                  onChange={(e) => setMins(clamp(+e.target.value, 0, 59))} />
              </label>
            </div>
          ) : (
            <label className="cc-time-field">
              <span className="cc-var-label">Time</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          )
        ) : (
          <p className="cc-sheet-note">
            Khonsera will hold this as elastic and bound it by your constraints.
          </p>
        )}

        {error ? <p className="cc-sheet-error">{error}</p> : null}

        <div className="cc-sheet-actions">
          <button type="button" className="cc-btn cc-btn-ghost" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="cc-btn cc-btn-gold" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Set"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* helpers */
function clamp(n: number, lo: number, hi: number): number {
  return Number.isNaN(n) ? lo : Math.min(hi, Math.max(lo, n));
}
function isoToHHMM(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function baseDate(anchor: AnchorVM, slot: AnchorVariableSlot, journeyDate: string): string {
  const iso =
    anchor.vars?.[slot]?.iso ??
    anchor.vars?.arriveBy?.iso ??
    anchor.vars?.leaveBy?.iso ??
    anchor.time?.from;
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }
  return journeyDate;
}
function hhmmToIso(dateStr: string, hhmm: string): string {
  // Local-time construction (matches the codebase's existing loose tz handling);
  // workspace-tz correctness is a follow-up.
  const d = new Date(`${dateStr}T${hhmm}:00`);
  return d.toISOString();
}

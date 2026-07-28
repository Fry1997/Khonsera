"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnchorCard, LegCard, GapCard, ScanView } from "@/components/concierge";
import { formatClock } from "@/components/concierge/types";
import { LivePass } from "@/components/plan/live-pass";
import type {
  AnchorVM,
  AnchorVariableKind,
  AnchorVariableSlot,
  LegVM,
  GapVM,
  TicketVM,
  BarcodeVM,
} from "@/components/concierge";
import { wallClockToIso } from "@/lib/time-zone";
import { AccommodationCard } from "@/components/plan/accommodation-card";
import { NotesPanel } from "@/components/plan/notes-panel";
import { TflLegPlan } from "@/components/plan/tfl-leg-plan";
import { PlanAdd } from "@/components/plan/plan-add";
import { Sheet } from "@/components/ui/sheet";
import type {
  PlacePickerCustomer,
  PlacePickerCustomerSite,
  PlacePickerLocation,
} from "@/components/place-picker";
import { RecoveryCard } from "@/components/plan/recovery-card";
import type { RecoveryOption } from "@/lib/recovery/engine";
import type { TflLegPlanVM } from "@/lib/integrations/tfl";
import type { NoteVM } from "@/lib/actions/notes";
import type { AccommodationDetails } from "@/lib/accommodation/types";
import {
  setAnchorVariable,
  compareLeg,
  chooseLeg,
  createLeg,
  removeStop,
  deleteBookedRun,
  type LegOption,
} from "@/lib/actions/plan-edit";
import { updateStop } from "@/lib/actions/stops";
import { setStopMode } from "@/lib/actions/plan-edit";

// The interactive planner spine (planner master brief §5). Renders the
// chronological rail of anchors + the leg/gap between each pair, and hosts the
// AnchorCard three-variable editor (§5.3) and the leg ComparisonMatrix (§5.7):
// tap a leg/gap → the engine ranks transport options door-to-door → choosing
// commits the leg and re-solves (hardening the anchors).

type LegBetween = { transitionId?: string; itineraryId: string; fromStopId: string; toStopId: string };

export type SpineNode = {
  key: string;
  anchor?: AnchorVM; // a normal anchor node
  isBase?: boolean; // a home/base node (the `start`/`end` stop) — the day's origin or
  // return-home. Renders as a fixed home card, not an editable, removable anchor.
  baseEyebrow?: string; // override the base eyebrow (e.g. "Back to your car" waypoint)
  accommodation?: AccommodationDetails | null; // ED1 — the stay's arrival payload, rendered below
  // the anchor (wifi, access, parking, cancellation…) so the Hilton/Booking app is redundant.
  notes?: NoteVM[]; // P3 — prep + outcome notes bound to this commitment
  pass?: TicketVM; // a booked-travel node → the docked Pass (proposal §8), ONE rail hop
  // Live status (Darwin) for this hop's boarding station: CRS + planned departure
  // (London HH:MM) + the hop's destination CRS (disambiguates same-minute
  // departures). Fetched client-side; the static card stands without a token.
  live?: { crs: string | null; time: string | null; dest: string | null };
  // Present only on the FIRST leg of a booked run — removing clears the whole run
  // (every hop) from the day + Wallet via the run's departure stop id.
  passDelete?: string | null;
  dayStart?: string; // a day divider label ("Day 2 · Thu 26 Jun") on multi-day Events
  after?:
    | ({ kind: "leg"; leg: LegVM; tflPlan?: TflLegPlanVM; liveAlert?: { title: string; text: string; state: "minor" | "severe" }; recovery?: { options: RecoveryOption[]; sample: boolean } } & LegBetween)
    | ({ kind: "gap"; gap: GapVM } & LegBetween)
    | null;
};

type EditTarget = { anchor: AnchorVM; slot: AnchorVariableSlot };
type CompareTarget = LegBetween & { title: string };
type ScanTarget = { summary: string; barcodes: BarcodeVM[] };
type RenameTarget = { id: string; title: string };

export function PlanSpine({
  nodes,
  journeyDate,
  eventId,
  isWork,
  customers,
  customerSites,
  locations,
}: {
  nodes: SpineNode[];
  journeyDate: string;
  eventId: string;
  isWork: boolean;
  // Threaded through so the inline "+ Add here" between items can open the
  // same add sheet, seeded with the surrounding time.
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
}) {
  const router = useRouter();

  // A new thing dropped into the gap after an anchor starts around when that
  // anchor wraps (its leave time, else its arrive time) — add IN context.
  // formatClock renders in the display timezone (Europe/London) and returns
  // "—" when there's no time to show.
  function seedTimeAfter(n: SpineNode): string | undefined {
    const iso = n.anchor?.time?.to ?? n.anchor?.time?.from;
    if (!iso) return undefined;
    const hhmm = formatClock(iso);
    return hhmm === "—" ? undefined : hhmm;
  }
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [compare, setCompare] = useState<CompareTarget | null>(null);
  const [scan, setScan] = useState<ScanTarget | null>(null);
  const [rename, setRename] = useState<RenameTarget | null>(null);

  const resolving = edit != null || compare != null;

  function remove(anchor: AnchorVM) {
    if (!window.confirm(`Remove "${anchor.title}" from this day?`)) return;
    void removeStop(anchor.id, eventId).then((res) => {
      if (res.ok) router.refresh();
    });
  }

  function removeBooking(operator: string, runDepartureStopId: string) {
    if (!window.confirm(`Remove the ${operator} booking from this day? It clears from the Wallet too.`)) return;
    void deleteBookedRun(runDepartureStopId).then((res) => {
      if (res.ok) router.refresh();
    });
  }

  function openScan(ticket: TicketVM) {
    const leg = ticket.legs[0];
    if (!leg?.barcodes?.length) return;
    setScan({ summary: `${ticket.operator} · ${leg.origin.place} → ${leg.destination.place}`, barcodes: leg.barcodes });
  }

  return (
    <>
      <div className="cc-spine" data-resolving={resolving ? "" : undefined}>
        <span className="cc-spine-rail" />
        {nodes.map((n) => (
          <div key={n.key} className="cc-spine-entry">
            {n.dayStart ? <div className="cc-day-divider">{n.dayStart}</div> : null}
            <div className="cc-node">
              <div className="cc-node-dot">
                <span className={n.pass ? "cc-dot-leg" : "cc-dot-anchor"} />
              </div>
              <div>
                {n.isBase && n.anchor ? (
                  <div className="cc-node-anchor cc-base-node">
                    <span className="cc-base-eyebrow">{n.baseEyebrow ?? (n.after ? "Home · start" : "Home")}</span>
                    <span className="cc-base-title">{n.anchor.place ?? n.anchor.title}</span>
                    {n.anchor.time ? (
                      <span className="cc-base-time">by {formatClock(n.anchor.time.from)}</span>
                    ) : null}
                  </div>
                ) : n.pass ? (
                  <div className="cc-node-anchor">
                    <LivePass ticket={n.pass} crs={n.live?.crs} time={n.live?.time} dest={n.live?.dest} docked onShow={openScan} />
                    {n.passDelete ? (
                      <button
                        type="button"
                        className="cc-node-remove"
                        onClick={() => removeBooking(n.pass!.operator, n.passDelete!)}
                        aria-label="Remove booking"
                        title="Remove booking"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                ) : n.anchor ? (
                  <div className="cc-node-anchor">
                    <AnchorCard
                      anchor={n.anchor}
                      onEditVariable={(id, slot) => setEdit({ anchor: n.anchor!, slot })}
                      onRename={(id) => setRename({ id, title: n.anchor!.title === "Stop" ? "" : n.anchor!.title })}
                      onFlipMode={(id, next) => { void setStopMode({ stopId: id, itineraryId: eventId, mode: next }).then((r) => { if (r.ok) router.refresh(); }); }}
                    />
                    <button
                      type="button"
                      className="cc-node-remove"
                      onClick={() => remove(n.anchor!)}
                      aria-label={`Remove ${n.anchor.title}`}
                      title="Remove"
                    >
                      ×
                    </button>
                    {n.accommodation ? <AccommodationCard a={n.accommodation} /> : null}
                    {n.anchor ? (
                      <NotesPanel stopId={n.anchor.id} itineraryId={eventId} isWork={isWork} notes={n.notes ?? []} />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            {/* Inline "+ Add here" in the gap after this item — opens the add
                sheet seeded with the surrounding time (add IN context). Shown
                wherever there's an onward leg (i.e. a real gap to fill). */}
            {n.after ? (
              <div className="cc-node">
                <div className="cc-node-dot" aria-hidden />
                <div>
                  <PlanAdd
                    variant="inline"
                    seedTime={seedTimeAfter(n)}
                    journeyId={eventId}
                    journeyDate={journeyDate}
                    customers={customers}
                    customerSites={customerSites}
                    locations={locations}
                  />
                </div>
              </div>
            ) : null}
            {n.after ? (
              <div className="cc-node">
                <div className="cc-node-dot">
                  <span className={n.after.kind === "leg" ? "cc-dot-leg" : "cc-dot-gap"} />
                </div>
                <div>
                  {n.after.kind === "leg" ? (
                    <>
                      <LegCard
                        leg={n.after.leg}
                        onCompare={() =>
                          setCompare({
                            transitionId: n.after!.transitionId,
                            itineraryId: n.after!.itineraryId,
                            fromStopId: n.after!.fromStopId,
                            toStopId: n.after!.toStopId,
                            title: n.anchor?.title ?? "",
                          })
                        }
                      />
                      {n.after.liveAlert ? (
                        <div className="cc-live-alert" data-state={n.after.liveAlert.state}>
                          <span className="cc-live-alert-title">{n.after.liveAlert.title}</span>
                          <span className="cc-live-alert-conseq">{n.after.liveAlert.text}</span>
                        </div>
                      ) : null}
                      {n.after.recovery ? <RecoveryCard options={n.after.recovery.options} sample={n.after.recovery.sample} /> : null}
                      {n.after.tflPlan ? <TflLegPlan data={n.after.tflPlan} /> : null}
                    </>
                  ) : (
                    <GapCard
                      gap={n.after.gap}
                      onResolve={() =>
                        setCompare({
                          itineraryId: n.after!.itineraryId,
                          fromStopId: n.after!.fromStopId,
                          toStopId: n.after!.toStopId,
                          title: n.after!.kind === "gap" ? n.after!.gap.toLabel ?? "this leg" : "this leg",
                        })
                      }
                    />
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {edit ? (
        <VariableEditor target={edit} journeyDate={journeyDate} onClose={() => setEdit(null)} />
      ) : null}

      {compare ? (
        <CompareSheet target={compare} onClose={() => setCompare(null)} />
      ) : null}

      {scan ? (
        <ScanView summary={scan.summary} barcodes={scan.barcodes} onClose={() => setScan(null)} />
      ) : null}

      {rename ? (
        <RenameSheet target={rename} onClose={() => setRename(null)} />
      ) : null}
    </>
  );
}

// Rename an anchor (deep review 2026-06-15) — an event that came in untitled is no
// longer stuck. Title-only patch via `updateStop`; the solver re-runs server-side.
function RenameSheet({ target, onClose }: { target: RenameTarget; onClose: () => void }) {
  const router = useRouter();
  const [value, setValue] = useState(target.title);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const next = value.trim();
    if (!next) { setError("Give it a name."); return; }
    setError(null);
    startTransition(async () => {
      const res = await updateStop({ id: target.id, title: next });
      if (!res.ok) { setError(("message" in res.error && res.error.message) || "Couldn't rename."); return; }
      onClose();
      router.refresh();
    });
  }

  return (
    <Sheet titleId="rename-sheet-title" onClose={onClose}>
        <header className="cc-sheet-head">
          <span className="cc-eyebrow">This stop</span>
          <h3 id="rename-sheet-title" className="cc-sheet-title" tabIndex={-1}>Rename</h3>
        </header>
        <label className="cc-time-field">
          <span className="cc-var-label">Name</span>
          <input
            autoFocus
            className="cc-field"
            value={value}
            placeholder="e.g. Lunch with Sarah"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          />
        </label>
        {error ? <p className="cc-sheet-error">{error}</p> : null}
        <div className="cc-sheet-actions">
          <button type="button" className="cc-btn cc-btn-ghost" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="button" className="cc-btn cc-btn-gold" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        </div>
    </Sheet>
  );
}

// ComparisonMatrix sheet (§5.7) — fastest-first, door-to-door. Choosing commits.
function CompareSheet({ target, onClose }: { target: CompareTarget; onClose: () => void }) {
  const router = useRouter();
  const [options, setOptions] = useState<LegOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void compareLeg({ fromStopId: target.fromStopId, toStopId: target.toStopId }).then((res) => {
      if (!live) return;
      if (res.ok && res.options) setOptions(res.options);
      else setError(res.error ?? "No options.");
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [target.fromStopId, target.toStopId]);

  function choose(o: LegOption) {
    setCommitting(o.id);
    setError(null);
    const run = target.transitionId
      ? chooseLeg({ transitionId: target.transitionId, mode: o.mode })
      : createLeg({
          itineraryId: target.itineraryId,
          fromStopId: target.fromStopId,
          toStopId: target.toStopId,
          mode: o.mode,
        });
    void run.then((res) => {
      if (!res.ok) {
        setError(res.error ?? "Couldn't choose that.");
        setCommitting(null);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <Sheet titleId="compare-sheet-title" onClose={onClose}>
        <header className="cc-sheet-head">
          <span className="cc-eyebrow">How you get there</span>
          <h3 id="compare-sheet-title" className="cc-sheet-title" tabIndex={-1}>Fastest first</h3>
        </header>

        {loading ? (
          <p className="cc-sheet-note">Working out the door-to-door options…</p>
        ) : error && !options ? (
          <p className="cc-sheet-error">{error}</p>
        ) : (
          <div className="cc-compare-list">
            {options!.map((o, i) => (
              <button
                key={o.id}
                type="button"
                className="cc-compare-opt"
                data-best={i === 0 ? "" : undefined}
                disabled={committing != null}
                onClick={() => choose(o)}
              >
                <span className="cc-compare-mode">{MODE_LABEL[o.mode] ?? o.mode}</span>
                <span className="cc-compare-time">{minutesLabel(o.minutes)}</span>
                {o.miles != null ? <span className="cc-compare-miles">{o.miles.toFixed(1)} mi</span> : null}
                {committing === o.id ? <span className="cc-compare-state">choosing…</span> : null}
              </button>
            ))}
          </div>
        )}
        {error && options ? <p className="cc-sheet-error">{error}</p> : null}

        <div className="cc-sheet-actions">
          <button type="button" className="cc-btn cc-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
    </Sheet>
  );
}

const MODE_LABEL: Record<string, string> = {
  walk: "Walk",
  taxi: "Taxi",
  drive: "Drive",
  bus: "Bus",
  tube: "Tube",
  train: "Train",
  flight: "Flight",
  mixed: "Mixed",
};
function minutesLabel(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h && min) return `${h}h ${min}m`;
  if (h) return `${h}h`;
  return `${min}m`;
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
    <Sheet titleId="variable-editor-sheet-title" descriptionId={!needsValue ? "variable-editor-sheet-description" : undefined} onClose={onClose}>
        <header className="cc-sheet-head">
          <span className="cc-eyebrow">{anchor.title}</span>
          <h3 id="variable-editor-sheet-title" className="cc-sheet-title" tabIndex={-1}>{SLOT_TITLE[slot]}</h3>
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
          <p id="variable-editor-sheet-description" className="cc-sheet-note">
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
    </Sheet>
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
  // Interpret the typed time in the display timezone (Europe/London), not UTC.
  return wallClockToIso(dateStr, hhmm);
}

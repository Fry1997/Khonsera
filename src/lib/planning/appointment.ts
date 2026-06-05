// Three-variable appointment model (P3).
//
// An appointment has three variables — arrive, duration, leave — and any two
// determine the third. The old model only had a fixed start + duration; this
// makes the relationship explicit and, crucially, records *which* constraint
// set each value so the UI can say "Arriving 09:19 — set by your 07:13 train"
// instead of a bare time.
//
// The mode (fixed / window / maximise) is not picked — it *emerges* from what's
// set:
//   • arrive + duration → fixed-duration  (leave derived)
//   • arrive + leave     → window-fitting (duration derived)
//   • duration = maximise → maximise       (arrive + leave pulled to the
//     outermost viable train candidates; duration is the consequence)
//
// Pure, no IO. The server action (`setAppointmentTiming`) persists the resolved
// triple and projects it onto the canonical start/end/duration fields the time
// solver reads. Microcopy templating lives at the bottom of this file.

import { formatTimeInTz, minutesBetween } from "@/lib/types/time";

export type ArriveKind = "precise" | "fuzzy" | "range" | "by" | "derived" | "unset";
export type DurationKind = "precise" | "fuzzy" | "maximise" | "derived" | "unset";
export type LeaveKind = "precise" | "fuzzy" | "by" | "derived" | "unset";

export type ArriveValue = { time: string | null; kind: ArriveKind };
export type DurationValue = { minutes: number | null; kind: DurationKind };
export type LeaveValue = { time: string | null; kind: LeaveKind };

// What committed a value — feeds the "set by…" microcopy.
export type TimingSource =
  | "user_set"
  | "derived_from_duration"
  | "derived_from_window"
  | "outbound_train"
  | "return_train"
  | "home_by"
  | "maximise"
  | "unset";

export type AppointmentMode = "fixed" | "window" | "maximise" | "partial";

export type ResolvedAppointment = {
  arrive: ArriveValue & { source: TimingSource };
  duration: DurationValue & { source: TimingSource };
  leave: LeaveValue & { source: TimingSource };
  mode: AppointmentMode;
};

// Outer viable bounds for maximise, from the rail candidates + standing facts:
// earliest you could be on site (earliest outbound) and latest you could leave
// (latest return that still satisfies home-by).
export type AppointmentBounds = {
  earliestArrive?: string | null;
  latestLeave?: string | null;
  // Attribution for the bound-sourced values (defaults below).
  earliestArriveSource?: TimingSource;
  latestLeaveSource?: TimingSource;
};

export type ResolveInput = {
  arrive?: ArriveValue | null;
  duration?: DurationValue | null;
  leave?: LeaveValue | null;
  bounds?: AppointmentBounds;
};

const UNSET_ARRIVE: ArriveValue = { time: null, kind: "unset" };
const UNSET_DURATION: DurationValue = { minutes: null, kind: "unset" };
const UNSET_LEAVE: LeaveValue = { time: null, kind: "unset" };

function arriveIsSet(v: ArriveValue): boolean {
  return v.time != null && v.kind !== "derived" && v.kind !== "unset";
}
function leaveIsSet(v: LeaveValue): boolean {
  return v.time != null && v.kind !== "derived" && v.kind !== "unset";
}
function durationIsSet(v: DurationValue): boolean {
  return (
    v.minutes != null && v.kind !== "derived" && v.kind !== "unset" && v.kind !== "maximise"
  );
}

function shift(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

// Resolve the triple. Priority when over-constrained:
//   maximise > arrive+duration (fixed) > arrive+leave (window) > duration+leave.
// The two driving values are marked user_set / bound-sourced; the third is
// flagged derived with the source that produced it.
export function resolveAppointment(input: ResolveInput): ResolvedAppointment {
  const arrive = input.arrive ?? UNSET_ARRIVE;
  const duration = input.duration ?? UNSET_DURATION;
  const leave = input.leave ?? UNSET_LEAVE;
  const bounds = input.bounds ?? {};

  // ── Maximise ────────────────────────────────────────────────────────────
  if (duration.kind === "maximise") {
    const arriveTime = arriveIsSet(arrive)
      ? arrive.time
      : (bounds.earliestArrive ?? null);
    const leaveTime = leaveIsSet(leave)
      ? leave.time
      : (bounds.latestLeave ?? null);
    const minutes =
      arriveTime && leaveTime ? minutesBetween(new Date(arriveTime), new Date(leaveTime)) : null;
    return {
      arrive: {
        time: arriveTime,
        kind: arriveTime ? (arriveIsSet(arrive) ? arrive.kind : "derived") : "unset",
        source: arriveIsSet(arrive)
          ? "user_set"
          : arriveTime
            ? (bounds.earliestArriveSource ?? "outbound_train")
            : "unset",
      },
      duration: { minutes, kind: "maximise", source: "maximise" },
      leave: {
        time: leaveTime,
        kind: leaveTime ? (leaveIsSet(leave) ? leave.kind : "derived") : "unset",
        source: leaveIsSet(leave)
          ? "user_set"
          : leaveTime
            ? (bounds.latestLeaveSource ?? "return_train")
            : "unset",
      },
      mode: "maximise",
    };
  }

  const aSet = arriveIsSet(arrive);
  const dSet = durationIsSet(duration);
  const lSet = leaveIsSet(leave);

  // ── Fixed-duration: arrive + duration → leave ─────────────────────────────
  if (aSet && dSet) {
    const leaveTime = shift(arrive.time as string, duration.minutes as number);
    return {
      arrive: { ...arrive, source: "user_set" },
      duration: { ...duration, source: "user_set" },
      leave: { time: leaveTime, kind: "derived", source: "derived_from_duration" },
      mode: "fixed",
    };
  }

  // ── Window-fitting: arrive + leave → duration ─────────────────────────────
  if (aSet && lSet) {
    const minutes = minutesBetween(
      new Date(arrive.time as string),
      new Date(leave.time as string),
    );
    return {
      arrive: { ...arrive, source: "user_set" },
      duration: { minutes, kind: "derived", source: "derived_from_window" },
      leave: { ...leave, source: "user_set" },
      mode: "window",
    };
  }

  // ── Duration + leave → arrive ─────────────────────────────────────────────
  if (dSet && lSet) {
    const arriveTime = shift(leave.time as string, -(duration.minutes as number));
    return {
      arrive: { time: arriveTime, kind: "derived", source: "derived_from_duration" },
      duration: { ...duration, source: "user_set" },
      leave: { ...leave, source: "user_set" },
      mode: "fixed",
    };
  }

  // ── Partial: fewer than two set — keep what we have, derive nothing ────────
  return {
    arrive: { ...arrive, source: aSet ? "user_set" : "unset" },
    duration: { ...duration, source: dSet ? "user_set" : "unset" },
    leave: { ...leave, source: lSet ? "user_set" : "unset" },
    mode: "partial",
  };
}

// ── Microcopy ────────────────────────────────────────────────────────────────

export type MicrocopyContext = {
  timezone: string;
  // Optional service labels for attribution lines.
  outboundService?: string | null;
  returnService?: string | null;
};

function fmtDuration(minutes: number | null): string {
  if (minutes == null) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// The voice-pattern line for the appointment card, chosen by mode. Returns null
// when there isn't enough resolved to say anything honest.
export function appointmentMicrocopy(
  r: ResolvedAppointment,
  ctx: MicrocopyContext,
): string | null {
  const t = (iso: string | null) => (iso ? formatTimeInTz(new Date(iso), ctx.timezone) : null);
  const arrive = t(r.arrive.time);
  const leave = t(r.leave.time);
  const dur = fmtDuration(r.duration.minutes);

  switch (r.mode) {
    case "maximise": {
      if (!leave) return null;
      const tail = ctx.returnService ? ` to make the ${ctx.returnService}` : "";
      return `Stay as long as you need — leave by ${leave}${tail}.`;
    }
    case "window": {
      if (!arrive || !leave) return null;
      return `On-site ${arrive} – ${leave} (${dur}). You set the trains.`;
    }
    case "fixed": {
      if (!arrive || !leave) return null;
      return `${dur} from ${arrive}. Leave by ${leave}.`;
    }
    case "partial":
      return null;
  }
}

// The "set by…" attribution for a single committed value (the brief's
// "Arriving 09:19 — set by your 07:13 train"). Returns null when the value
// wasn't committed by an external constraint worth naming.
export function arriveAttribution(
  r: ResolvedAppointment,
  ctx: MicrocopyContext,
): string | null {
  if (!r.arrive.time) return null;
  const arrive = formatTimeInTz(new Date(r.arrive.time), ctx.timezone);
  switch (r.arrive.source) {
    case "outbound_train":
      return ctx.outboundService
        ? `Arriving ${arrive} — set by your ${ctx.outboundService}.`
        : `Arriving ${arrive} — set by your outbound train.`;
    case "derived_from_duration":
      return `Arriving ${arrive} — worked back from your finish time.`;
    default:
      return null;
  }
}

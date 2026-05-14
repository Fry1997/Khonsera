// Day-strip calendar view for a single visit. Shows the user's existing
// calendar events for the day alongside the proposed/selected travel +
// meeting bands. Pure server component.

import { listEvents } from "@/lib/integrations/calendar";
import { formatTimeInTz } from "@/lib/types/time";

type Band = {
  start: Date;
  end: Date;
  label: string;
  kind: "outbound_travel" | "meeting" | "return_travel" | "busy";
};

const KIND_COLOR: Record<Band["kind"], { bg: string; fg: string; border?: string }> = {
  outbound_travel: { bg: "#f3e1d6", fg: "var(--terra-deep)", border: "var(--terra)" },
  meeting: { bg: "var(--ink)", fg: "var(--paper)" },
  return_travel: { bg: "#f3e1d6", fg: "var(--terra-deep)", border: "var(--terra)" },
  busy: { bg: "var(--card-2)", fg: "var(--ink-2)" },
};

export async function VisitCalendarWidget({
  bands,
  timezone,
}: {
  bands: Band[];
  timezone: string;
}) {
  if (bands.length === 0) return null;

  // Day window: from the earliest band start (or 06:00) to the latest band
  // end (or 22:00), clamped to ±2h padding.
  const earliest = bands.reduce(
    (a, b) => (b.start < a ? b.start : a),
    bands[0].start,
  );
  const latest = bands.reduce(
    (a, b) => (b.end > a ? b.end : a),
    bands[0].end,
  );

  // Fetch existing events for the day to overlay alongside the visit bands.
  const dayStart = new Date(earliest);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(latest);
  dayEnd.setHours(23, 59, 0, 0);
  const events = await listEvents({ start: dayStart, end: dayEnd });

  const busyBands: Band[] =
    events.mode === "unavailable"
      ? []
      : events.data
          .filter((e) => {
            // Don't show events that ARE the bands we created (rough check by
            // overlapping start ± 5min with any provided band).
            return !bands.some(
              (b) => Math.abs(b.start.getTime() - e.start.getTime()) < 5 * 60_000,
            );
          })
          .map((e) => ({
            start: e.start,
            end: e.end,
            label: e.summary ?? "Busy",
            kind: "busy" as const,
          }));

  const all = [...bands, ...busyBands].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  // Compute the strip's hour range: 1h before earliest of any band, 1h after.
  const startHourMs =
    Math.floor(
      (all.reduce((a, b) => (b.start < a ? b.start : a), all[0].start).getTime() -
        60 * 60_000) /
        (60 * 60_000),
    ) * 60 * 60_000;
  const endHourMs =
    Math.ceil(
      (all.reduce((a, b) => (b.end > a ? b.end : a), all[0].end).getTime() +
        60 * 60_000) /
        (60 * 60_000),
    ) * 60 * 60_000;
  const spanMs = endHourMs - startHourMs;

  const hourCount = Math.ceil(spanMs / (60 * 60_000));

  return (
    <section className="j-card p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="h3">Day at a glance</h2>
        <span className="small">
          {events.mode === "live"
            ? "Live · Google Calendar"
            : events.mode === "demo"
              ? "Demo data"
              : "Connect Google Calendar in Settings to overlay existing events"}
        </span>
      </div>
      <div
        className="relative overflow-hidden rounded border border-rule"
        style={{ background: "var(--card-2)" }}
      >
        {/* Hour ticks */}
        <div className="relative h-20">
          {Array.from({ length: hourCount + 1 }).map((_, i) => {
            const pct = (i / hourCount) * 100;
            const hour = new Date(startHourMs + i * 60 * 60_000);
            return (
              <div key={i}>
                <div
                  className="absolute top-0 bottom-0 w-px"
                  style={{ left: `${pct}%`, background: "var(--rule-2)" }}
                />
                <div
                  className="mono absolute bottom-1 text-[9.5px]"
                  style={{
                    left: `${pct}%`,
                    transform: "translateX(-50%)",
                    color: "var(--ink-faint)",
                  }}
                >
                  {formatTimeInTz(hour, timezone)}
                </div>
              </div>
            );
          })}

          {/* Bands */}
          {all.map((b, i) => {
            const startPct =
              ((b.start.getTime() - startHourMs) / spanMs) * 100;
            const endPct = ((b.end.getTime() - startHourMs) / spanMs) * 100;
            const width = Math.max(endPct - startPct, 1.5);
            const color = KIND_COLOR[b.kind];
            return (
              <div
                key={i}
                className="absolute top-4 bottom-7 overflow-hidden rounded px-2 text-[10.5px] leading-tight"
                style={{
                  left: `${startPct}%`,
                  width: `${width}%`,
                  background: color.bg,
                  color: color.fg,
                  borderLeft: color.border ? `2px solid ${color.border}` : undefined,
                }}
                title={`${b.label} · ${formatTimeInTz(b.start, timezone)}–${formatTimeInTz(b.end, timezone)}`}
              >
                <div className="truncate pt-1 font-medium">{b.label}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
        <Legend color="#f3e1d6" border="var(--terra)" label="Travel" />
        <Legend color="var(--ink)" label="Meeting" fg="var(--paper)" />
        <Legend color="var(--card-2)" label="Existing event" />
      </div>
    </section>
  );
}

function Legend({
  color,
  border,
  fg,
  label,
}: {
  color: string;
  border?: string;
  fg?: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-5 rounded-sm"
        style={{
          background: color,
          borderLeft: border ? `2px solid ${border}` : undefined,
          color: fg,
        }}
      />
      <span className="small">{label}</span>
    </span>
  );
}

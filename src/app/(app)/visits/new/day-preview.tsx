"use client";

import { useEffect, useState } from "react";
import { getDayEvents, type DayEvent } from "@/lib/actions/calendar-views";

// Renders a horizontal hour strip showing the user's existing calendar
// events for the day they're proposing. Picks the day off the ISO datetime
// the form holds, debounces, fetches, renders.

export function DayPreview({
  proposedDateTime,
  timezone,
}: {
  proposedDateTime: string; // datetime-local value: "YYYY-MM-DDTHH:mm"
  timezone: string;
}) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "live" | "demo"; events: DayEvent[] }
    | { kind: "unavailable"; reason?: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  useEffect(() => {
    if (!proposedDateTime) {
      setState({ kind: "idle" });
      return;
    }
    const date = proposedDateTime.slice(0, 10); // YYYY-MM-DD
    let cancelled = false;
    setState({ kind: "loading" });
    const handle = setTimeout(async () => {
      const result = await getDayEvents({ date });
      if (cancelled) return;
      if (!result.ok) {
        setState({ kind: "error", message: result.error.kind });
        return;
      }
      if (result.value.mode === "unavailable") {
        setState({ kind: "unavailable", reason: result.value.reason });
        return;
      }
      setState({ kind: result.value.mode, events: result.value.events });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [proposedDateTime]);

  // The proposed time as a band on the same strip (shown in terracotta).
  const proposedStart = proposedDateTime ? new Date(proposedDateTime) : null;

  if (state.kind === "idle") return null;

  return (
    <div className="j-card-soft p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="uc">
          Your day · {formatDay(proposedDateTime, timezone)}
        </span>
        <span className="small">
          {state.kind === "loading"
            ? "Loading…"
            : state.kind === "live"
              ? "Live · Google Calendar"
              : state.kind === "demo"
                ? "Demo data"
                : state.kind === "unavailable"
                  ? "Calendar not connected"
                  : state.kind === "error"
                    ? "Couldn't fetch events"
                    : null}
        </span>
      </div>
      {state.kind === "live" || state.kind === "demo" ? (
        state.events.length === 0 && !proposedStart ? (
          <p className="small">No events on this day. You have it free.</p>
        ) : (
          <DayStrip
            events={state.events}
            proposed={proposedStart}
            timezone={timezone}
          />
        )
      ) : null}
      {state.kind === "unavailable" ? (
        <p className="small">
          Connect Google Calendar in Settings to see your existing events here.
        </p>
      ) : null}
    </div>
  );
}

function DayStrip({
  events,
  proposed,
  timezone,
}: {
  events: DayEvent[];
  proposed: Date | null;
  timezone: string;
}) {
  // Window: 07:00–20:00 local. Fixed window keeps things stable as the
  // user picks different times within the same day.
  const dayKey = (proposed ?? (events[0] && new Date(events[0].start)))
    ?.toISOString()
    .slice(0, 10);
  if (!dayKey) return null;

  const startHour = 7;
  const endHour = 20;
  const spanHours = endHour - startHour;

  const dayUtcMidnight = new Date(`${dayKey}T00:00:00.000Z`);
  const windowStart = new Date(
    dayUtcMidnight.getTime() + startHour * 60 * 60_000,
  );
  const windowEnd = new Date(dayUtcMidnight.getTime() + endHour * 60 * 60_000);
  const windowSpanMs = windowEnd.getTime() - windowStart.getTime();

  type Band = { start: Date; end: Date; label: string; kind: "busy" | "proposed" };
  const bands: Band[] = events.map((e) => ({
    start: new Date(e.start),
    end: new Date(e.end),
    label: e.title,
    kind: "busy",
  }));
  if (proposed) {
    bands.push({
      start: proposed,
      end: new Date(proposed.getTime() + 60 * 60_000), // 1h placeholder
      label: "Proposed",
      kind: "proposed",
    });
  }

  return (
    <div
      className="relative h-16 rounded border border-rule"
      style={{ background: "var(--card)" }}
    >
      {Array.from({ length: spanHours + 1 }).map((_, i) => {
        const pct = (i / spanHours) * 100;
        const hour = new Date(windowStart.getTime() + i * 60 * 60_000);
        return (
          <div key={i}>
            <div
              className="absolute top-0 bottom-0 w-px"
              style={{ left: `${pct}%`, background: "var(--rule-2)" }}
            />
            <div
              className="mono absolute bottom-1 text-[9px]"
              style={{
                left: `${pct}%`,
                transform: "translateX(-50%)",
                color: "var(--ink-faint)",
              }}
            >
              {formatHour(hour, timezone)}
            </div>
          </div>
        );
      })}
      {bands.map((b, i) => {
        const startMs = b.start.getTime();
        const endMs = b.end.getTime();
        // Clamp to window.
        if (endMs <= windowStart.getTime() || startMs >= windowEnd.getTime())
          return null;
        const clampedStart = Math.max(startMs, windowStart.getTime());
        const clampedEnd = Math.min(endMs, windowEnd.getTime());
        const leftPct = ((clampedStart - windowStart.getTime()) / windowSpanMs) * 100;
        const widthPct = Math.max(((clampedEnd - clampedStart) / windowSpanMs) * 100, 1.5);
        return (
          <div
            key={i}
            className="absolute top-2 bottom-6 overflow-hidden rounded px-1.5 text-[10px] leading-tight"
            style={{
              left: `${leftPct}%`,
              width: `${widthPct}%`,
              background: b.kind === "proposed" ? "var(--terra)" : "var(--ink-soft)",
              color: b.kind === "proposed" ? "#fff8ef" : "var(--ink-2)",
              border: b.kind === "proposed" ? "1px solid var(--terra-2)" : undefined,
            }}
            title={`${b.label} · ${formatHour(b.start, timezone)}–${formatHour(b.end, timezone)}`}
          >
            <span className="truncate">{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function formatDay(dt: string, tz: string): string {
  if (!dt) return "—";
  const d = new Date(dt);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: tz,
  }).format(d);
}

function formatHour(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  }).format(d);
}

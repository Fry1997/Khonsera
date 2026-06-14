// Dashboard "This week" widget. Server component. Pulls the next 7 days of
// Google Calendar events alongside any itinerary stops in the same window,
// merges them per day, and renders a clean list-per-day view.
//
// Calendar events render muted; itinerary stops render in terracotta with a
// link to the parent itinerary. When the calendar isn't connected, the
// widget still works — it just shows stops.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { listEvents } from "@/lib/integrations/calendar";
import { formatTimeInTz } from "@/lib/types/time";
import type { StopType } from "@/lib/types/domain";
import { StopIcon } from "@/components/icons";

type Row =
  | {
      kind: "event";
      start: Date;
      end: Date;
      title: string;
      htmlLink?: string;
    }
  | {
      kind: "stop";
      start: Date;
      end: Date | null;
      title: string;
      stopType: StopType;
      itineraryId: string;
    };

function StopTypeIcon({ type }: { type: StopType }) {
  const props = { size: 11 } as const;
  switch (type) {
    case "start":
      return <StopIcon.pin {...props} />;
    case "end":
      return <StopIcon.flag {...props} />;
    case "appointment":
      return <StopIcon.appointment {...props} />;
    case "accommodation":
      return <StopIcon.stay {...props} />;
    case "event":
      return <StopIcon.event {...props} />;
    case "meal":
      return <StopIcon.meal {...props} />;
    case "transport_booked":
      return <StopIcon.ticket {...props} />;
    case "transit_arrival":
      return <StopIcon.station {...props} />;
    default:
      return <span aria-hidden>·</span>;
  }
}

export async function WeekCalendar({
  timezone,
}: {
  timezone: string;
}) {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 7);

  const [eventsResult, { data: stops }] = await Promise.all([
    listEvents({ start: today, end: horizon }),
    supabase
      .from("stops")
      .select(
        `id, title, type, start_time, end_time,
         itinerary:itineraries!inner(id, title, status, workspace_id, date_start, date_end)`,
      )
      .eq("workspace_id", ctx.workspaceId)
      .gte("start_time", today.toISOString())
      .lte("start_time", horizon.toISOString())
      .order("start_time"),
  ]);

  // Group everything into a day bucket keyed by YYYY-MM-DD in the user's
  // workspace timezone.
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: timezone,
    }).format(d);

  const buckets = new Map<string, Row[]>();
  const ensure = (key: string) => {
    if (!buckets.has(key)) buckets.set(key, []);
    return buckets.get(key)!;
  };

  if (eventsResult.mode === "live" || eventsResult.mode === "demo") {
    for (const e of eventsResult.data) {
      ensure(dayKey(e.start)).push({
        kind: "event",
        start: e.start,
        end: e.end,
        title: e.summary ?? "Busy",
        htmlLink: e.htmlLink,
      });
    }
  }

  type RawStop = {
    id: string;
    title: string | null;
    type: StopType;
    start_time: string | null;
    end_time: string | null;
    itinerary: { id: string; title: string | null } | { id: string; title: string | null }[] | null;
  };
  for (const s of ((stops ?? []) as unknown as RawStop[])) {
    if (!s.start_time) continue;
    const start = new Date(s.start_time);
    const itin = Array.isArray(s.itinerary) ? s.itinerary[0] : s.itinerary;
    if (!itin) continue;
    ensure(dayKey(start)).push({
      kind: "stop",
      start,
      end: s.end_time ? new Date(s.end_time) : null,
      title: s.title ?? itin.title ?? "Stop",
      stopType: s.type,
      itineraryId: itin.id,
    });
  }

  // Sort each bucket by time.
  for (const arr of buckets.values()) {
    arr.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  // Build the seven-day window even when there's no data.
  const days: { date: Date; key: string; rows: Row[] }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const key = dayKey(d);
    days.push({ date: d, key, rows: buckets.get(key) ?? [] });
  }

  const calendarStatus =
    eventsResult.mode === "live"
      ? "live"
      : eventsResult.mode === "demo"
        ? "demo"
        : "off";

  const totalRows = days.reduce((s, d) => s + d.rows.length, 0);

  return (
    <section className="j-card p-5">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="h3">This week</h2>
        <span className="small">
          {calendarStatus === "live"
            ? "Live · Google Calendar"
            : calendarStatus === "demo"
              ? "Demo events"
              : "Calendar not connected"}
          {" · "}
          {totalRows} item{totalRows === 1 ? "" : "s"}
        </span>
      </header>

      <ul className="flex flex-col gap-3">
        {days.map((day) => (
          <li
            key={day.key}
            className="flex flex-col gap-1.5 border-l-2 pl-3"
            style={{ borderColor: isToday(day.date) ? "var(--terra)" : "var(--rule)" }}
          >
            <p
              className="uc"
              style={{ color: isToday(day.date) ? "var(--terra-deep)" : "var(--ink-dim)" }}
            >
              {formatDayHeader(day.date, timezone)}
              {isToday(day.date) ? " · Today" : ""}
            </p>
            {day.rows.length === 0 ? (
              <p className="tiny text-ink-faint">Nothing scheduled</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {day.rows.map((r, idx) => (
                  <li key={idx} className="flex items-baseline gap-2 text-sm">
                    <span className="mono text-xs text-ink-dim whitespace-nowrap">
                      {formatTimeInTz(r.start, timezone)}
                      {r.end
                        ? `–${formatTimeInTz(r.end, timezone)}`
                        : ""}
                    </span>
                    {r.kind === "stop" ? (
                      <Link
                        href={`/plan/${r.itineraryId}`}
                        className="truncate text-terra-deep hover:underline"
                        title={r.title}
                      >
                        <span
                          className="mr-1 inline-flex align-middle"
                          style={{ color: "var(--gold-2)" }}
                        >
                          <StopTypeIcon type={r.stopType} />
                        </span>
                        {r.title}
                      </Link>
                    ) : (
                      <span
                        className="truncate text-ink-2"
                        title={r.title}
                      >
                        {r.title}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function isToday(d: Date): boolean {
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function formatDayHeader(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: tz,
  }).format(d);
}

import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { formatInTz } from "@/lib/types/time";
import type { ItineraryStatus } from "@/lib/types/domain";

type Row = {
  id: string;
  title: string | null;
  date_start: string;
  date_end: string;
  status: ItineraryStatus;
};

const STATUS_LABEL: Record<ItineraryStatus, string> = {
  draft: "Draft",
  planning: "Planning",
  planned: "Planned",
  in_progress: "Live now",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_SB: Record<ItineraryStatus, string> = {
  draft: "sb-draft",
  planning: "sb-planning",
  planned: "sb-planned",
  in_progress: "sb-progress",
  completed: "sb-done",
  cancelled: "sb-cancelled",
};

export default async function ItinerariesPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const wsCfg = await getWorkspaceConfig(ctx.workspaceId);

  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("itineraries")
    .select("id, title, date_start, date_end, status")
    .eq("workspace_id", ctx.workspaceId)
    .order("date_start", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as Row[];
  const upcoming = rows
    .filter(
      (r) =>
        r.status !== "cancelled" &&
        r.status !== "completed" &&
        r.date_end >= today,
    )
    .sort((a, b) => a.date_start.localeCompare(b.date_start));
  const live = upcoming.filter((r) => r.status === "in_progress");
  const drafts = rows.filter(
    (r) =>
      (r.status === "draft" || r.status === "planning") &&
      !upcoming.includes(r),
  );
  const past = rows.filter(
    (r) =>
      r.status === "completed" ||
      r.status === "cancelled" ||
      r.date_end < today,
  );

  const monthRange = monthRangeLabel(rows, wsCfg.timezone);

  return (
    <PageShell
      eyebrow="Your itinerary"
      eyebrowMeta={monthRange}
      title={
        rows.length === 0 ? (
          <>
            Nothing on the books <em className="serif italic">yet</em>.
          </>
        ) : (
          <MastheadHeadline upcoming={upcoming.length} live={live.length} />
        )
      }
      actions={
        <Link href="/itineraries/new" className="btn-terra">
          + Plan a visit
        </Link>
      }
    >
      {rows.length > 0 ? (
        <section
          className="digest"
          style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
        >
          <DigestStat n={upcoming.length} label="Upcoming" />
          <DigestStat
            n={live.length}
            label="In progress"
            tone={live.length ? "warn" : undefined}
          />
          <DigestStat n={drafts.length} label="In planning" />
          <DigestStat n={past.length} label="Completed" sub="incl. cancelled" />
        </section>
      ) : null}

      {rows.length === 0 ? (
        <div className="j-card-soft p-8 text-center">
          <p className="body mb-3">No itineraries yet.</p>
          <Link href="/itineraries/new" className="btn-terra">
            Start your first one
          </Link>
        </div>
      ) : (
        <>
          {upcoming.length > 0 ? (
            <WeekSection
              heading="Upcoming"
              dateLabel={firstWeekLabel(upcoming, wsCfg.timezone)}
              rows={upcoming}
              timezone={wsCfg.timezone}
            />
          ) : null}
          {drafts.length > 0 ? (
            <WeekSection
              heading="In planning"
              dateLabel={`${drafts.length} draft${drafts.length === 1 ? "" : "s"}`}
              rows={drafts}
              timezone={wsCfg.timezone}
              draft
            />
          ) : null}
          {past.length > 0 ? (
            <CompletedLedger
              rows={past.slice(0, 30)}
              timezone={wsCfg.timezone}
            />
          ) : null}
        </>
      )}
    </PageShell>
  );
}

function MastheadHeadline({
  upcoming,
  live,
}: {
  upcoming: number;
  live: number;
}) {
  if (live > 0) {
    return (
      <>
        {upcoming} <em className="serif italic text-terra">journies</em> ahead,
        <br className="hidden md:inline" /> one already on the rails.
      </>
    );
  }
  if (upcoming > 0) {
    return (
      <>
        {upcoming} <em className="serif italic text-terra">journies</em>{" "}
        {upcoming === 1 ? "on the books" : "ahead"}.
      </>
    );
  }
  return (
    <>
      A quiet week —{" "}
      <em className="serif italic text-terra">time to plan</em>.
    </>
  );
}

function WeekSection({
  heading,
  dateLabel,
  rows,
  timezone,
  draft,
}: {
  heading: string;
  dateLabel: string;
  rows: Row[];
  timezone: string;
  draft?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-5 px-1">
        <div className="flex items-baseline gap-3">
          <span className="serif italic text-2xl">{heading}</span>
          <span className="mono text-xs uppercase tracking-wider text-ink-dim">
            {dateLabel}
          </span>
        </div>
        <span className="mono text-[11.5px] uppercase tracking-wider text-ink-dim">
          {rows.length} visit{rows.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="h-px bg-ink/80" />
      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <VisitTicket key={r.id} row={r} timezone={timezone} draft={draft} />
        ))}
      </div>
    </section>
  );
}

function VisitTicket({
  row,
  timezone,
  draft,
}: {
  row: Row;
  timezone: string;
  draft?: boolean;
}) {
  const start = new Date(row.date_start);
  const dayOfWeek = formatInTz(start, timezone, { weekday: "short" });
  const dayNum = formatInTz(start, timezone, { day: "numeric" });
  const monthShort = formatInTz(start, timezone, { month: "short" });
  const year = formatInTz(start, timezone, { year: "numeric" });

  const sameDay = row.date_start === row.date_end;
  const rangeLabel = sameDay
    ? formatInTz(start, timezone, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : `${formatInTz(start, timezone, { day: "numeric", month: "short" })} → ${formatInTz(
        new Date(row.date_end),
        timezone,
        { day: "numeric", month: "short" },
      )}`;

  return (
    <Link
      href={`/itineraries/${row.id}`}
      className={`vticket ${draft ? "is-draft" : ""}`}
    >
      <div className="vticket-stub">
        <span className="vticket-dow">{dayOfWeek}</span>
        <span className="vticket-day">{dayNum}</span>
        <span className="vticket-mon">{monthShort}</span>
        <span className="vticket-yr">{year}</span>
      </div>
      <div className="vticket-perf" />
      <div className="vticket-body">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-medium leading-tight text-ink">
            {row.title ?? rangeLabel}
          </h3>
          <span className={`sb ${STATUS_SB[row.status]}`}>
            {STATUS_LABEL[row.status]}
          </span>
        </div>
        <p className="mono text-xs uppercase tracking-wider text-ink-dim">
          {rangeLabel}
        </p>
      </div>
    </Link>
  );
}

function CompletedLedger({
  rows,
  timezone,
}: {
  rows: Row[];
  timezone: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-5 px-1">
        <div className="flex items-baseline gap-3">
          <span className="serif italic text-2xl text-ink-2">Completed</span>
          <span className="mono text-xs uppercase tracking-wider text-ink-dim">
            last {rows.length}
          </span>
        </div>
      </div>
      <div className="h-px bg-rule-2" />
      <div className="j-card overflow-hidden">
        <div className="grid grid-cols-[160px_1fr_120px] gap-4 px-5 py-3 bg-card-2 border-b border-rule mono text-[10.5px] uppercase tracking-wider text-ink-dim">
          <span>Date</span>
          <span>Title</span>
          <span className="text-right">Status</span>
        </div>
        {rows.map((r, i) => (
          <Link
            key={r.id}
            href={`/itineraries/${r.id}`}
            className={`grid grid-cols-[160px_1fr_120px] items-center gap-4 px-5 py-3 text-sm text-ink-2 hover:bg-card-2 ${
              i > 0 ? "border-t border-rule" : ""
            }`}
          >
            <span className="mono text-xs uppercase tracking-wider text-ink-dim">
              {formatInTz(new Date(r.date_start), timezone, {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
            <span className="truncate">
              {r.title ??
                formatInTz(new Date(r.date_start), timezone, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
            </span>
            <span className="justify-self-end">
              <span className={`sb ${STATUS_SB[r.status]}`}>
                {STATUS_LABEL[r.status]}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function DigestStat({
  n,
  label,
  sub,
  tone,
}: {
  n: number | string;
  label: string;
  sub?: string;
  tone?: "warn" | "ok";
}) {
  return (
    <div className={`digest-stat${tone ? ` tone-${tone}` : ""}`}>
      <span className="digest-n">{n}</span>
      <span className="digest-lbl">{label}</span>
      {sub ? <span className="digest-sub">{sub}</span> : null}
    </div>
  );
}

function firstWeekLabel(rows: Row[], timezone: string): string {
  if (rows.length === 0) return "";
  const first = new Date(rows[0].date_start);
  const last = new Date(rows[rows.length - 1].date_start);
  if (rows[0].date_start === rows[rows.length - 1].date_start) {
    return formatInTz(first, timezone, {
      day: "numeric",
      month: "long",
    });
  }
  return `${formatInTz(first, timezone, { day: "numeric", month: "short" })} – ${formatInTz(
    last,
    timezone,
    { day: "numeric", month: "short" },
  )}`;
}

function monthRangeLabel(rows: Row[], timezone: string): string {
  if (rows.length === 0) {
    return formatInTz(new Date(), timezone, {
      month: "short",
      year: "numeric",
    });
  }
  const dates = rows.map((r) => new Date(r.date_start));
  const min = new Date(Math.min(...dates.map((d) => d.getTime())));
  const max = new Date(Math.max(...dates.map((d) => d.getTime())));
  const minLabel = formatInTz(min, timezone, {
    month: "short",
    year: "numeric",
  });
  const maxLabel = formatInTz(max, timezone, {
    month: "short",
    year: "numeric",
  });
  return minLabel === maxLabel ? minLabel : `${minLabel} — ${maxLabel}`;
}

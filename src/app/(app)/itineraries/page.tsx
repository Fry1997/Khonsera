import Link from "next/link";
import type { Route } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { formatDateInTz } from "@/lib/types/time";
import type { ItineraryStatus } from "@/lib/types/domain";
import { DeleteItineraryButton } from "@/components/delete-itinerary-button";

type Row = {
  id: string;
  title: string | null;
  notes: string | null;
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

const STATUS_PILL: Record<ItineraryStatus, string> = {
  draft: "pill-soft",
  planning: "pill-amber",
  planned: "pill-sage",
  in_progress: "pill-gold",
  completed: "pill-soft",
  cancelled: "pill-rust",
};

export default async function ItinerariesPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const wsCfg = await getWorkspaceConfig(ctx.workspaceId);

  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("itineraries")
    .select("id, title, notes, date_start, date_end, status")
    .eq("workspace_id", ctx.workspaceId)
    .order("date_start", { ascending: true })
    .limit(200);

  const rows = ((data ?? []) as Row[]).filter(
    (r) => r.status !== "cancelled",
  );

  // Pull stops counts in one query so cards can show "n stops" without N+1.
  const ids = rows.map((r) => r.id);
  const stopCounts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: stops } = await supabase
      .from("stops")
      .select("itinerary_id")
      .in("itinerary_id", ids);
    for (const s of stops ?? []) {
      stopCounts.set(
        s.itinerary_id as string,
        (stopCounts.get(s.itinerary_id as string) ?? 0) + 1,
      );
    }
  }

  // Single chronological feed: live first, then upcoming (asc), then past
  // (most recent first). Inside each block we keep dates ordered.
  const live = rows.filter((r) => r.status === "in_progress");
  const upcoming = rows
    .filter(
      (r) =>
        r.status !== "in_progress" &&
        r.status !== "completed" &&
        r.date_end >= today,
    )
    .sort((a, b) => a.date_start.localeCompare(b.date_start));
  const past = rows
    .filter((r) => r.status === "completed" || r.date_end < today)
    .sort((a, b) => b.date_start.localeCompare(a.date_start));

  const feed = [...live, ...upcoming, ...past];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="eyebrow" style={{ color: "var(--gold-2)" }}>
            Trips · {rows.length} on file
          </span>
          <h1
            className="desk-h1"
            style={{ marginTop: 6, fontSize: "clamp(28px, 4vw, 38px)" }}
          >
            Every <em>trip,</em> ordered.
          </h1>
          <p
            className="serif-i"
            style={{
              fontSize: 16,
              color: "var(--ink-dim)",
              margin: "8px 0 0",
              maxWidth: "60ch",
            }}
          >
            A day — or a multi-day run — built of stops and the transitions
            between them. Live trips sit on top, then upcoming, then past.
          </p>
        </div>
        <Link href={"/itineraries/new" as Route} className="btn btn-gold">
          <Plus /> New itinerary
        </Link>
      </header>

      {feed.length === 0 ? (
        <div className="card" style={{ padding: 36, textAlign: "center" }}>
          <p
            className="serif-i"
            style={{
              fontSize: 17,
              color: "var(--ink-2)",
              marginBottom: 14,
            }}
          >
            No trips yet — the calendar is yours.
          </p>
          <Link
            href={"/itineraries/new" as Route}
            className="btn btn-gold btn-lg"
          >
            Start your first one
          </Link>
        </div>
      ) : (
        <Feed rows={feed} liveIds={new Set(live.map((r) => r.id))}
              stopCounts={stopCounts} timezone={wsCfg.timezone} today={today} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Feed — single chronological list with subtle month dividers. The "live"
// block is rendered first regardless of date so it's always above the
// fold; everything else is grouped by month with a flank-eyebrow.
// ─────────────────────────────────────────────────────────────────────
function Feed({
  rows,
  liveIds,
  stopCounts,
  timezone,
  today,
}: {
  rows: Row[];
  liveIds: Set<string>;
  stopCounts: Map<string, number>;
  timezone: string;
  today: string;
}) {
  // Build month groups in the order rows appear in the feed.
  const groups: Array<{ key: string; label: string; rows: Row[] }> = [];
  let liveGroup: Row[] = [];
  for (const r of rows) {
    if (liveIds.has(r.id)) {
      liveGroup.push(r);
      continue;
    }
    const key = monthKey(r.date_start, timezone);
    const label = monthLabel(r.date_start, timezone);
    const existing = groups.find((g) => g.key === key);
    if (existing) {
      existing.rows.push(r);
    } else {
      groups.push({ key, label, rows: [r] });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {liveGroup.length > 0 ? (
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="flank left">
            <span style={{ color: "var(--gold-2)" }}>
              Live now · {liveGroup.length}
            </span>
          </div>
          <div className="trip-feed">
            {liveGroup.map((r) => (
              <TripRow
                key={r.id}
                row={r}
                timezone={timezone}
                stops={stopCounts.get(r.id) ?? 0}
                live
                today={today}
              />
            ))}
          </div>
        </section>
      ) : null}

      {groups.map((g) => (
        <section
          key={g.key}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <div className="flank left">
            <span>{g.label}</span>
          </div>
          <div className="trip-feed">
            {g.rows.map((r) => (
              <TripRow
                key={r.id}
                row={r}
                timezone={timezone}
                stops={stopCounts.get(r.id) ?? 0}
                today={today}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TripRow — the editorial row. Bigger date display, italic title, status
// pill + meta on a second line, delete on the right. Live rows pick up
// the gold card-hero treatment.
// ─────────────────────────────────────────────────────────────────────
function TripRow({
  row,
  timezone,
  stops,
  live,
  today,
}: {
  row: Row;
  timezone: string;
  stops: number;
  live?: boolean;
  today: string;
}) {
  const start = new Date(row.date_start);
  const end = new Date(row.date_end);
  const multiDay = row.date_start !== row.date_end;
  const past = !live && row.date_end < today;

  const dayShort = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone: timezone,
  }).format(start);
  const monthShort = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    timeZone: timezone,
  }).format(start);
  const dayNumber = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    timeZone: timezone,
  }).format(start);
  const yearShort = new Intl.DateTimeFormat("en-GB", {
    year: "2-digit",
    timeZone: timezone,
  }).format(start);

  const span = multiDay
    ? `${formatDateInTz(start, timezone)} → ${formatDateInTz(end, timezone)}`
    : formatDateInTz(start, timezone);

  const titleText =
    row.title ?? formatDateInTz(start, timezone);

  // Editorial title treatment — italic last word in gold (mirrors masthead).
  const titleParts = splitTitle(titleText);

  return (
    <article
      className={live ? "trip-row trip-row-live" : "trip-row"}
      data-past={past}
    >
      <Link
        href={`/itineraries/${row.id}`}
        aria-label={titleText}
        className="trip-row-cover"
      />

      <div className="trip-row-date">
        <span className="trip-row-day-of-week">
          {dayShort.toUpperCase()} {monthShort.toUpperCase()}
        </span>
        <span className="trip-row-day">{dayNumber}</span>
        <span className="trip-row-year">'{yearShort}</span>
      </div>

      <div className="trip-row-content">
        <h2 className="trip-row-title">
          {titleParts.head}
          {titleParts.em ? (
            <>
              {" "}
              <em>{titleParts.em}</em>
            </>
          ) : null}
        </h2>
        <div className="trip-row-meta">
          <span className={`pill ${STATUS_PILL[row.status]}`}>
            <span className="dot" />
            {STATUS_LABEL[row.status]}
          </span>
          <span className="mono trip-row-meta-item">{span}</span>
          {multiDay ? (
            <span className="mono trip-row-meta-item">
              {daysBetween(start, end) + 1} days
            </span>
          ) : null}
          {stops > 0 ? (
            <span className="mono trip-row-meta-item">
              {stops} {stops === 1 ? "stop" : "stops"}
            </span>
          ) : (
            <span className="mono trip-row-meta-item" style={{ color: "var(--ink-faint)" }}>
              no stops yet
            </span>
          )}
        </div>
        {row.notes ? (
          <p className="trip-row-notes">{row.notes}</p>
        ) : null}
      </div>

      <div className="trip-row-actions">
        <DeleteItineraryButton id={row.id} title={titleText} variant="row" />
        <span aria-hidden className="trip-row-chev">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </article>
  );
}

function splitTitle(title: string): { head: string; em: string | null } {
  const connectives = [" to ", " at ", " in ", " — ", " – ", ": "];
  for (const c of connectives) {
    const idx = title.lastIndexOf(c);
    if (idx > 0 && idx + c.length < title.length) {
      return {
        head: title.slice(0, idx + c.length).trim(),
        em: title.slice(idx + c.length).trim(),
      };
    }
  }
  const words = title.trim().split(/\s+/);
  if (words.length >= 2 && words.length <= 4) {
    return { head: words.slice(0, -1).join(" "), em: words.at(-1) ?? null };
  }
  return { head: title, em: null };
}

function monthKey(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: tz,
  }).format(new Date(iso));
}

function monthLabel(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: tz,
  })
    .format(new Date(iso))
    .toUpperCase();
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function Plus() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

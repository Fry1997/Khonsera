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
    .select("id, title, date_start, date_end, status")
    .eq("workspace_id", ctx.workspaceId)
    .order("date_start", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as Row[];
  const upcoming = rows.filter(
    (r) =>
      r.status !== "cancelled" &&
      r.status !== "completed" &&
      r.date_end >= today,
  );
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
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
            between them. Drafts live alongside the booked ones until the day
            arrives.
          </p>
        </div>
        <Link href={"/itineraries/new" as Route} className="btn btn-gold">
          <Plus /> New itinerary
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="card" style={{ padding: 36, textAlign: "center" }}>
          <p
            className="serif-i"
            style={{
              fontSize: 17,
              color: "var(--ink-2)",
              marginBottom: 14,
            }}
          >
            No itineraries yet.
          </p>
          <Link
            href={"/itineraries/new" as Route}
            className="btn btn-gold btn-lg"
          >
            Start your first one
          </Link>
        </div>
      ) : (
        <>
          {upcoming.length > 0 ? (
            <Section
              heading="Upcoming"
              rows={upcoming}
              timezone={wsCfg.timezone}
            />
          ) : null}
          {drafts.length > 0 ? (
            <Section
              heading="In planning"
              rows={drafts}
              timezone={wsCfg.timezone}
              muted
            />
          ) : null}
          {past.length > 0 ? (
            <Section
              heading="Past · completed"
              rows={past.slice(0, 30)}
              timezone={wsCfg.timezone}
              muted
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function Section({
  heading,
  rows,
  timezone,
  muted,
}: {
  heading: string;
  rows: Row[];
  timezone: string;
  muted?: boolean;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="flank left" style={{ opacity: muted ? 0.7 : 1 }}>
        <span>
          {heading} · {rows.length}
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        }}
      >
        {rows.map((r) => (
          <ItineraryCard
            key={r.id}
            row={r}
            timezone={timezone}
            muted={muted}
          />
        ))}
      </div>
    </section>
  );
}

function ItineraryCard({
  row,
  timezone,
  muted,
}: {
  row: Row;
  timezone: string;
  muted?: boolean;
}) {
  const start = new Date(row.date_start);
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

  const multiDay = row.date_start !== row.date_end;
  return (
    <div
      className="card"
      style={{
        padding: 16,
        display: "grid",
        gap: 14,
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        opacity: muted ? 0.86 : 1,
        position: "relative",
      }}
    >
      <Link
        href={`/itineraries/${row.id}`}
        aria-label={
          row.title ?? formatDateInTz(new Date(row.date_start), timezone)
        }
        // Cover the whole card so the row stays clickable, but the delete
        // button (positioned above this overlay with z-index) still wins.
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
        }}
      />
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 12,
          background: "var(--paper-2)",
          color: "var(--ink-2)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid var(--rule)",
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 9,
            letterSpacing: 0.4,
            color: "var(--ink-dim)",
            textTransform: "uppercase",
          }}
        >
          {dayShort} {monthShort}
        </span>
        <span
          className="display-i"
          style={{
            fontSize: 20,
            fontWeight: 500,
            color: "var(--ink)",
            lineHeight: 1,
          }}
        >
          {dayNumber}
        </span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <h3
            style={{
              fontFamily: "var(--sans)",
              fontWeight: 600,
              fontSize: 15,
              color: "var(--ink)",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.title ??
              formatDateInTz(new Date(row.date_start), timezone)}
          </h3>
          {multiDay ? <span className="pill pill-soft">multi-day</span> : null}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            marginTop: 6,
            flexWrap: "wrap",
          }}
        >
          <span className={`pill ${STATUS_PILL[row.status]}`}>
            <span className="dot" />
            {STATUS_LABEL[row.status]}
          </span>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-faint)" }}>
            {formatDateInTz(new Date(row.date_start), timezone)}
            {multiDay
              ? ` → ${formatDateInTz(new Date(row.date_end), timezone)}`
              : ""}
          </span>
        </div>
      </div>
      <span style={{ position: "relative", zIndex: 2 }}>
        <DeleteItineraryButton
          id={row.id}
          title={
            row.title ?? formatDateInTz(new Date(row.date_start), timezone)
          }
          variant="row"
        />
      </span>
    </div>
  );
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

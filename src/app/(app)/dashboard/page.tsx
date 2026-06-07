import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { isWelcomed } from "@/lib/welcome";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { formatDateInTz } from "@/lib/types/time";
import { WeekCalendar } from "@/components/week-calendar";
import type { ItineraryStatus } from "@/lib/types/domain";

const STATUS_LABEL: Record<ItineraryStatus, string> = {
  draft: "Draft",
  planning: "Planning",
  planned: "Planned",
  in_progress: "In progress",
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

export default async function DashboardPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  // First-run gate (§3): a brand-new user with no journeys meets Khonsera first.
  if (!(await isWelcomed())) {
    const { count: anyJourneys } = await supabase
      .from("itineraries")
      .select("id", { count: "exact", head: true });
    if (!anyJourneys) redirect("/welcome" as Route);
  }

  const wsCfg = await getWorkspaceConfig(ctx.workspaceId);

  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: calendarConn },
    { data: nextItinerary },
    { count: draftCount },
    { count: plannedCount },
    { count: inProgressCount },
    { data: upcoming },
    { data: recent },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("calendar_connections")
      .select("provider_account_email")
      .eq("user_id", ctx.userId)
      .eq("workspace_id", ctx.workspaceId)
      .eq("provider", "google")
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("itineraries")
      .select("id, title, status, date_start, date_end, notes")
      .eq("workspace_id", ctx.workspaceId)
      .eq("mode", ctx.activeMode)
      .in("status", ["planned", "in_progress"])
      .gte("date_end", today)
      .order("date_start")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("itineraries")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId)
      .eq("mode", ctx.activeMode)
      .in("status", ["draft", "planning"]),
    supabase
      .from("itineraries")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId)
      .eq("mode", ctx.activeMode)
      .eq("status", "planned"),
    supabase
      .from("itineraries")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId)
      .eq("mode", ctx.activeMode)
      .eq("status", "in_progress"),
    supabase
      .from("itineraries")
      .select("id, title, status, date_start, date_end")
      .eq("workspace_id", ctx.workspaceId)
      .eq("mode", ctx.activeMode)
      .gte("date_end", today)
      .in("status", ["draft", "planning", "planned", "in_progress"])
      .order("date_start")
      .limit(6),
    supabase
      .from("itineraries")
      .select("id, title, status, date_start")
      .eq("workspace_id", ctx.workspaceId)
      .eq("mode", ctx.activeMode)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", ctx.userId)
      .maybeSingle(),
  ]);

  const totalActive =
    (draftCount ?? 0) + (plannedCount ?? 0) + (inProgressCount ?? 0);

  const firstName =
    (profile?.full_name ?? ctx.email.split("@")[0])?.split(" ")[0] ?? "traveller";
  const greeting = greetingFor(new Date(), wsCfg.timezone);

  // Fetch hero metrics if there's a next trip.
  let heroStops: Array<{
    id: string;
    sequence: number;
    type: string;
    title: string | null;
    start_time: string | null;
    location: { name?: string } | null;
    customer: { name?: string } | null;
    customer_site: { name?: string; address?: string } | null;
  }> = [];
  let heroTransitions: Array<{
    id: string;
    from_stop_id: string;
    to_stop_id: string;
    mode: string;
    computed_duration_minutes: number | null;
    distance_miles: number | null;
  }> = [];
  if (nextItinerary?.id) {
    const [stopsRes, transitionsRes] = await Promise.all([
      supabase
        .from("stops")
        .select(
          `id, sequence, type, title, start_time,
           location:locations(name),
           customer:customers(name),
           customer_site:customer_sites(name, address)`,
        )
        .eq("itinerary_id", nextItinerary.id)
        .order("sequence"),
      supabase
        .from("transitions")
        .select(
          "id, from_stop_id, to_stop_id, mode, computed_duration_minutes, distance_miles",
        )
        .eq("itinerary_id", nextItinerary.id),
    ]);
    heroStops = (stopsRes.data ?? []) as never;
    heroTransitions = (transitionsRes.data ?? []) as never;
  }

  const heroTotals = computeTotals(heroTransitions);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Masthead */}
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="eyebrow" style={{ color: "var(--gold-2)" }}>
            {formatNow(wsCfg.timezone)}
          </span>
          <h1
            className="desk-h1"
            style={{ marginTop: 6, fontSize: "clamp(34px, 5vw, 46px)" }}
          >
            {greeting}, <em>{firstName}.</em>
          </h1>
          <p
            className="serif-i"
            style={{
              fontSize: 17,
              color: "var(--ink-dim)",
              margin: "10px 0 0",
              maxWidth: "60ch",
              lineHeight: 1.55,
            }}
          >
            {nextItinerary
              ? "Tomorrow's chain is built. Eight steps, one anchor, home for tea."
              : "Nothing on the books tonight. The evening is yours to plan."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={"/bookings" as Route} className="btn btn-ghost">
            <Glyph d="M3 9 a2 2 0 0 1 2-2 h14 a2 2 0 0 1 2 2 v2 a2 2 0 0 0 0 2 v2 a2 2 0 0 1-2 2 H5 a2 2 0 0 1-2-2 v-2 a2 2 0 0 0 0-2 z M9 7 v10" />{" "}
            Bookings
          </Link>
          <Link href={"/itineraries/new" as Route} className="btn btn-gold">
            <Plus /> New trip
          </Link>
        </div>
      </header>

      {/* Hero — tomorrow's trip */}
      {nextItinerary ? (
        <HeroTrip
          itinerary={nextItinerary}
          stops={heroStops}
          totals={heroTotals}
          timezone={wsCfg.timezone}
        />
      ) : (
        <EmptyHero />
      )}

      {/* Two-up — Upcoming + Activity */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
          gap: 24,
        }}
        className="khonsera-two-up"
      >
        <div>
          <div className="desk-flank" style={{ marginBottom: 14 }}>
            <span>Upcoming · {upcoming?.length ?? 0}</span>
          </div>
          {upcoming && upcoming.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {upcoming.map((t) => (
                <UpcomingRow
                  key={t.id}
                  itinerary={t as never}
                  timezone={wsCfg.timezone}
                />
              ))}
            </div>
          ) : (
            <div className="card" style={{ padding: 20 }}>
              <p className="serif-i" style={{ fontSize: 15, color: "var(--ink-2)" }}>
                Nothing scheduled. Start a trip to see it land here, with travel
                built backwards from your appointment.
              </p>
            </div>
          )}
        </div>

        <div>
          <div className="desk-flank" style={{ marginBottom: 14 }}>
            <span>On the books · {totalActive}</span>
          </div>
          <div
            className="card"
            style={{ padding: 0, overflow: "hidden" }}
          >
            <StatRow
              label="In planning"
              value={draftCount ?? 0}
              href="/itineraries"
              tone="amber"
            />
            <div className="divider" />
            <StatRow
              label="Planned · ready"
              value={plannedCount ?? 0}
              href="/itineraries"
              tone="sage"
            />
            <div className="divider" />
            <StatRow
              label="In progress · live"
              value={inProgressCount ?? 0}
              href="/itineraries"
              tone="gold"
            />
          </div>

          {/* Calendar status */}
          <div className="card" style={{ padding: 16, marginTop: 16 }}>
            <span className="uc" style={{ display: "block" }}>
              Calendar
            </span>
            {calendarConn ? (
              <>
                <p
                  className="serif-i"
                  style={{
                    fontSize: 15,
                    color: "var(--ink-2)",
                    margin: "6px 0 4px",
                  }}
                >
                  <em style={{ color: "var(--gold)" }}>Google</em> · connected.
                </p>
                <p className="mono" style={{ fontSize: 11.5, color: "var(--ink-dim)" }}>
                  {calendarConn.provider_account_email ?? "Google account"}
                </p>
              </>
            ) : (
              <>
                <p
                  className="serif-i"
                  style={{
                    fontSize: 15,
                    color: "var(--ink-2)",
                    margin: "6px 0 8px",
                  }}
                >
                  Not yet connected.
                </p>
                <Link
                  href={"/settings" as Route}
                  className="btn btn-ghost btn-sm"
                >
                  Connect Google
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Week calendar */}
      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="desk-flank">
          <span>This week</span>
        </div>
        <WeekCalendar timezone={wsCfg.timezone} />
      </section>

      {/* Recent */}
      {recent && recent.length > 0 ? (
        <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="desk-flank">
            <span>Recent</span>
          </div>
          <ul
            className="card"
            style={{
              padding: 0,
              listStyle: "none",
              margin: 0,
              overflow: "hidden",
            }}
          >
            {recent.map((r, i) => (
              <li
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 18px",
                  borderTop: i === 0 ? 0 : "1px solid var(--rule)",
                }}
              >
                <Link
                  href={`/itineraries/${r.id}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--sans)",
                      fontSize: 14.5,
                      fontWeight: 600,
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.title ??
                      formatDateInTz(
                        new Date(r.date_start),
                        wsCfg.timezone,
                      )}
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: 11.5, color: "var(--ink-dim)" }}
                  >
                    {formatDateInTz(new Date(r.date_start), wsCfg.timezone)}
                  </span>
                </Link>
                <span className={`pill ${STATUS_PILL[r.status as ItineraryStatus]}`}>
                  <span className="dot" />
                  {STATUS_LABEL[r.status as ItineraryStatus]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function HeroTrip({
  itinerary,
  stops,
  totals,
  timezone,
}: {
  itinerary: {
    id: string;
    title: string | null;
    status: string;
    date_start: string;
    date_end: string;
    notes: string | null;
  };
  stops: Array<{
    id: string;
    sequence: number;
    type: string;
    title: string | null;
    start_time: string | null;
    location: { name?: string } | null;
    customer: { name?: string } | null;
    customer_site: { name?: string; address?: string } | null;
  }>;
  totals: { mins: number; miles: number };
  timezone: string;
}) {
  const headline = itinerary.title ?? "Tomorrow's trip";
  const { head, em } = splitTitle(headline);

  const date = formatDateInTz(new Date(itinerary.date_start), timezone);
  const appt = stops.find((s) => s.type === "appointment");
  const apptLabel =
    appt?.customer_site?.name ??
    appt?.customer?.name ??
    appt?.location?.name ??
    appt?.title ??
    null;

  const first = stops[0];
  const last = stops[stops.length - 1];
  const apptTime = appt?.start_time
    ? new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
      }).format(new Date(appt.start_time))
    : "—";
  const homeTime = last?.start_time
    ? new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
      }).format(new Date(last.start_time))
    : "—";
  const outTime = first?.start_time
    ? new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
      }).format(new Date(first.start_time))
    : "—";

  return (
    <section>
      <div
        className="card-hero"
        style={{
          padding: 28,
          display: "grid",
          gap: 32,
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <span className="pill pill-anchor">
              {date.split(" ").slice(0, 2).join(" ")} · {apptTime}
            </span>
            <span className="pill pill-sage">
              <span className="dot" />
              {itinerary.status === "in_progress"
                ? "Live now"
                : "Planned · ready"}
            </span>
          </div>
          <h2 className="desk-h1" style={{ fontSize: 36 }}>
            {head}
            {em ? (
              <>
                {" "}
                <em>{em}</em>
              </>
            ) : null}
          </h2>
          {apptLabel ? (
            <p
              className="serif-i"
              style={{
                fontSize: 15,
                color: "var(--ink-2)",
                margin: "10px 0 0",
                lineHeight: 1.5,
              }}
            >
              <em style={{ color: "var(--gold)" }}>{apptLabel}</em>
              {appt?.customer_site?.address
                ? ` · ${appt.customer_site.address}`
                : ""}
            </p>
          ) : itinerary.notes ? (
            <p
              className="serif-i"
              style={{
                fontSize: 15,
                color: "var(--ink-2)",
                margin: "10px 0 0",
                lineHeight: 1.5,
              }}
            >
              {itinerary.notes}
            </p>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
              marginTop: 28,
            }}
            className="khonsera-anchor-stats"
          >
            <AnchorStat l="Out" v={outTime} sub="leave home" />
            <AnchorStat
              l="Door to door"
              v={fmtDuration(totals.mins)}
              sub={`${totals.miles.toFixed(0)} mi`}
            />
            <AnchorStat
              l="Anchor"
              v={apptTime}
              sub={apptLabel ? "appointment" : "first stop"}
            />
            <AnchorStat l="Home by" v={homeTime} sub="last stop" />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 24, flexWrap: "wrap" }}>
            <Link
              href={`/itineraries/${itinerary.id}`}
              className="btn btn-gold"
            >
              Open trip
              <Arrow />
            </Link>
            <Link
              href={`/bookings`}
              className="btn btn-ghost"
            >
              View wallet
            </Link>
          </div>
        </div>

        {/* Right — chain */}
        <div
          style={{
            borderLeft: "1px solid var(--rule)",
            paddingLeft: 28,
          }}
          className="khonsera-chain"
        >
          <span className="uc">The chain · {stops.length} stops</span>
          <div
            style={{
              marginTop: 14,
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            {stops.slice(0, 7).map((s, i, arr) => (
              <ChainRow
                key={s.id}
                time={s.start_time}
                timezone={timezone}
                title={
                  s.customer_site?.name ??
                  s.customer?.name ??
                  s.location?.name ??
                  s.title ??
                  "Stop"
                }
                sub={s.customer_site?.address ?? s.type}
                anchor={s.type === "appointment"}
                isLast={i === arr.length - 1}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ChainRow({
  time,
  timezone,
  title,
  sub,
  anchor,
  isLast,
}: {
  time: string | null;
  timezone: string;
  title: string;
  sub: string | null;
  anchor?: boolean;
  isLast?: boolean;
}) {
  const t = time
    ? new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
      }).format(new Date(time))
    : "—";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 24px 1fr",
        gap: 12,
        padding: "10px 0",
        borderBottom: isLast ? 0 : "1px dashed var(--rule)",
        alignItems: "center",
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 11,
          color: anchor ? "var(--gold-2)" : "var(--ink-dim)",
          fontWeight: 600,
          letterSpacing: 0.5,
        }}
      >
        {t}
      </span>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 8,
          background: anchor ? "var(--gold)" : "var(--paper-2)",
          color: anchor ? "#fff" : "var(--ink-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `1px solid ${anchor ? "var(--gold)" : "var(--rule)"}`,
        }}
      >
        <Glyph d="M12 22 s-7-7.5-7-13 a7 7 0 1 1 14 0 c0 5.5-7 13-7 13 z M12 9 a2 2 0 1 0 0 4 a2 2 0 0 0 0-4" />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--sans)",
            fontSize: 13.5,
            fontWeight: 600,
            color: anchor ? "var(--ink)" : "var(--ink-2)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        {sub ? (
          <div
            style={{
              fontSize: 11.5,
              color: "var(--ink-dim)",
              marginTop: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AnchorStat({
  l,
  v,
  sub,
}: {
  l: string;
  v: string;
  sub: string;
}) {
  return (
    <div className="anchor-stat">
      <span className="l">{l}</span>
      <span className="v" style={{ fontSize: 26 }}>
        {v}
      </span>
      <span
        className="mono"
        style={{
          fontSize: 10.5,
          color: "var(--ink-dim)",
          marginTop: 2,
        }}
      >
        {sub}
      </span>
    </div>
  );
}

function EmptyHero() {
  return (
    <section>
      <div
        className="card"
        style={{
          padding: 36,
          textAlign: "center",
        }}
      >
        <h2 className="desk-h1" style={{ fontSize: 32 }}>
          Plan the next <em>trip.</em>
        </h2>
        <p
          className="serif-i"
          style={{
            fontSize: 16,
            color: "var(--ink-dim)",
            margin: "12px auto 24px",
            maxWidth: "44ch",
          }}
        >
          Nothing is queued. Start one and Khonsera will build it backwards
          from your appointment — rail vs drive, doors, hotels and all.
        </p>
        <Link
          href={"/itineraries/new" as Route}
          className="btn btn-gold btn-lg"
        >
          <Plus /> New itinerary
        </Link>
      </div>
    </section>
  );
}

function UpcomingRow({
  itinerary,
  timezone,
}: {
  itinerary: {
    id: string;
    title: string | null;
    status: ItineraryStatus;
    date_start: string;
    date_end: string;
  };
  timezone: string;
}) {
  const start = new Date(itinerary.date_start);
  const day = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone: timezone,
  }).format(start);
  const num = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    timeZone: timezone,
  }).format(start);
  const month = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    timeZone: timezone,
  }).format(start);
  const multiDay = itinerary.date_start !== itinerary.date_end;

  return (
    <Link
      href={`/itineraries/${itinerary.id}`}
      className="card"
      style={{
        padding: 16,
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 16,
        alignItems: "center",
      }}
    >
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
          {day} {month}
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
          {num}
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
            }}
          >
            {itinerary.title ?? formatDateInTz(start, timezone)}
          </h3>
          {multiDay ? <span className="pill pill-soft">multi-day</span> : null}
        </div>
        <span className={`pill ${STATUS_PILL[itinerary.status]}`} style={{ marginTop: 6 }}>
          <span className="dot" />
          {STATUS_LABEL[itinerary.status]}
        </span>
      </div>
      <Chevron />
    </Link>
  );
}

function StatRow({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone: "amber" | "sage" | "gold";
}) {
  return (
    <Link
      href={href as Route}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 18px",
      }}
    >
      <div>
        <span
          className="display-i"
          style={{
            fontSize: 28,
            fontWeight: 500,
            color:
              tone === "gold"
                ? "var(--gold)"
                : tone === "sage"
                  ? "var(--sage)"
                  : "var(--amber)",
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        <span
          className="uc"
          style={{ display: "block", marginTop: 4 }}
        >
          {label}
        </span>
      </div>
      <Chevron />
    </Link>
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
  if (words.length >= 2) {
    return { head: words.slice(0, -1).join(" "), em: words.at(-1) ?? null };
  }
  return { head: title, em: null };
}

function computeTotals(
  transitions: Array<{
    computed_duration_minutes: number | null;
    distance_miles: number | null;
  }>,
): { mins: number; miles: number } {
  return transitions.reduce(
    (acc, t) => ({
      mins: acc.mins + (Number(t.computed_duration_minutes) || 0),
      miles: acc.miles + (Number(t.distance_miles) || 0),
    }),
    { mins: 0, miles: 0 },
  );
}

function fmtDuration(mins: number): string {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function greetingFor(d: Date, tz: string): string {
  const h = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(d),
  );
  if (h < 5) return "Late evening";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Late evening";
}

function formatNow(tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  })
    .format(new Date())
    .toUpperCase();
}

function Glyph({ d }: { d: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

function Plus() {
  return <Glyph d="M12 5 v14 M5 12 h14" />;
}

function Arrow() {
  return <Glyph d="M5 12 h14 M13 6 l6 6 -6 6" />;
}

function Chevron() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden
      style={{ color: "var(--ink-faint)" }}
    >
      <path
        d="M9 6 l6 6 -6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

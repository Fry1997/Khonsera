import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { formatDateInTz, formatInTz } from "@/lib/types/time";
import { WeekCalendar } from "@/components/week-calendar";
import type { ItineraryStatus } from "@/lib/types/domain";

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

export default async function DashboardPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const wsCfg = await getWorkspaceConfig(ctx.workspaceId);

  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: calendarConn },
    { data: nextItinerary },
    { count: draftCount },
    { count: plannedCount },
    { count: inProgressCount },
    { data: recent },
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
      .select("id, title, status, date_start, date_end")
      .eq("workspace_id", ctx.workspaceId)
      .in("status", ["planned", "in_progress"])
      .gte("date_end", today)
      .order("date_start")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("itineraries")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId)
      .in("status", ["draft", "planning"]),
    supabase
      .from("itineraries")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId)
      .eq("status", "planned"),
    supabase
      .from("itineraries")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId)
      .eq("status", "in_progress"),
    supabase
      .from("itineraries")
      .select("id, title, status, date_start, date_end")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const now = new Date();
  const eyebrowDate = formatInTz(now, wsCfg.timezone, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const greeting = greetingFor(now, wsCfg.timezone);
  const firstName = (ctx.email.split("@")[0] || "").replace(/[._]/g, " ").trim();
  const displayName = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).split(" ")[0]
    : "there";

  const livePlanned = (plannedCount ?? 0) + (inProgressCount ?? 0);
  const standfirst =
    livePlanned > 0
      ? `You have ${livePlanned} visit${livePlanned === 1 ? "" : "s"} on the books${
          draftCount ? `, and ${draftCount} still in planning` : ""
        }.`
      : draftCount
        ? `Nothing confirmed yet — ${draftCount} ${draftCount === 1 ? "draft is" : "drafts are"} waiting to be firmed up.`
        : "A clean slate. Start an itinerary to see your week land here.";

  return (
    <PageShell
      eyebrow={eyebrowDate}
      eyebrowMeta="Dashboard"
      title={
        <>
          {greeting}, <span className="terra-em">{displayName}</span>.
        </>
      }
      description={standfirst}
      actions={
        <Link href="/itineraries/new" className="btn-terra">
          + Plan new visit
        </Link>
      }
    >
      {nextItinerary ? (
        <NextItineraryHero
          title={
            nextItinerary.title ??
            formatDateInTz(new Date(nextItinerary.date_start), wsCfg.timezone)
          }
          startDate={nextItinerary.date_start}
          endDate={nextItinerary.date_end}
          status={nextItinerary.status as ItineraryStatus}
          timezone={wsCfg.timezone}
          id={nextItinerary.id}
        />
      ) : (
        <NoNext />
      )}

      <section
        className="digest"
        style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
      >
        <DigestStat
          n={draftCount ?? 0}
          label="In planning"
          sub="Drafts being assembled"
          tone={draftCount ? "warn" : undefined}
        />
        <DigestStat
          n={plannedCount ?? 0}
          label="Planned"
          sub="Ready to go"
          tone={(plannedCount ?? 0) > 0 ? "ok" : undefined}
        />
        <DigestStat
          n={inProgressCount ?? 0}
          label="In progress"
          sub="Happening now"
        />
      </section>

      <WeekCalendar timezone={wsCfg.timezone} />

      <section className="grid gap-4 md:grid-cols-2">
        <div className="j-card p-5">
          <header className="eyebrow-row mb-3">
            <span className="uc">Calendar</span>
            <span className="eyebrow-rule" />
          </header>
          {calendarConn ? (
            <>
              <p className="small">
                <span className="mono text-ink-2">
                  {calendarConn.provider_account_email ?? "Google account"}
                </span>{" "}
                connected.
              </p>
              <p className="small mt-1">
                Free/busy + event creation use this account. Manage at{" "}
                <Link href="/settings" className="underline">
                  Settings
                </Link>
                .
              </p>
            </>
          ) : (
            <>
              <p className="small">
                Not connected. Connect to check calendar conflicts and create
                stop + travel blocks automatically.
              </p>
              <div className="mt-3">
                <Link href="/settings" className="btn-ghost">
                  Connect in Settings
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="j-card p-5">
          <header className="eyebrow-row mb-3">
            <span className="uc">Recent itineraries</span>
            <span className="eyebrow-rule" />
          </header>
          {recent && recent.length > 0 ? (
            <ul className="flex flex-col">
              {recent.map((r, i) => (
                <li
                  key={r.id}
                  className={`flex items-center justify-between gap-3 py-2.5 text-sm ${
                    i > 0 ? "border-t border-rule" : ""
                  }`}
                >
                  <Link
                    href={`/itineraries/${r.id}`}
                    className="flex min-w-0 items-baseline gap-3 hover:text-terra"
                  >
                    <span className="truncate font-medium">
                      {r.title ??
                        formatDateInTz(new Date(r.date_start), wsCfg.timezone)}
                    </span>
                    <span className="mono shrink-0 text-[11px] uppercase tracking-wider text-ink-dim">
                      {formatDateInTz(new Date(r.date_start), wsCfg.timezone)}
                    </span>
                  </Link>
                  <span className={`sb ${STATUS_SB[r.status as ItineraryStatus]}`}>
                    {STATUS_LABEL[r.status as ItineraryStatus]}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small">
              No itineraries yet. Start your first one above.
            </p>
          )}
        </div>
      </section>
    </PageShell>
  );
}

function greetingFor(now: Date, timezone: string): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    }).format(now),
  );
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Good night";
}

function NextItineraryHero({
  title,
  startDate,
  endDate,
  status,
  timezone,
  id,
}: {
  title: string;
  startDate: string;
  endDate: string;
  status: ItineraryStatus;
  timezone: string;
  id: string;
}) {
  const start = new Date(startDate);
  const dayOfWeek = formatInTz(start, timezone, { weekday: "long" });
  const dayNum = formatInTz(start, timezone, { day: "numeric" });
  const monthShort = formatInTz(start, timezone, { month: "short" });

  return (
    <section className="j-card p-0 overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr]">
        <div
          className="flex flex-col items-center justify-center py-6 px-4 text-center"
          style={{ background: "var(--card-2)" }}
        >
          <span className="serif text-base text-ink-dim">{dayOfWeek}</span>
          <span
            className="font-serif italic font-medium text-terra"
            style={{ fontSize: 64, lineHeight: 0.95, letterSpacing: "-0.04em" }}
          >
            {dayNum}
          </span>
          <span className="text-[11px] uppercase tracking-[0.18em] text-ink-2 mt-1.5">
            {monthShort}
          </span>
        </div>
        <div className="p-6 md:p-7">
          <div className="flex items-center gap-3 mb-2">
            <span className="uc">Next up</span>
            <span className={`sb ${STATUS_SB[status]}`}>
              {STATUS_LABEL[status]}
            </span>
          </div>
          <h2 className="h2 mb-2">{title}</h2>
          <p className="small mono uppercase tracking-wider">
            {formatDateInTz(start, timezone)}
            {endDate !== startDate
              ? ` → ${formatDateInTz(new Date(endDate), timezone)}`
              : ""}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/itineraries/${id}`} className="btn-primary">
              Open itinerary →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function NoNext() {
  return (
    <section className="j-card-soft p-6">
      <p className="uc mb-2">Next up</p>
      <p className="body">
        Nothing planned yet. Start an itinerary to see your day land here.
      </p>
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


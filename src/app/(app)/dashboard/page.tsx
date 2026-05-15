import Link from "next/link";
import type { Route } from "next";
import { PageShell } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { formatDateInTz } from "@/lib/types/time";
import type { ItineraryStatus } from "@/lib/types/domain";

const STATUS_LABEL: Record<ItineraryStatus, string> = {
  draft: "Draft",
  planning: "Planning",
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
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

  return (
    <PageShell
      title="Dashboard"
      description="Your day. What's next, what's still being planned, and where Journies thinks you should be."
      actions={
        <Link href="/itineraries/new" className="btn-terra">
          + New itinerary
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

      <section className="grid gap-4 md:grid-cols-3">
        <DashStat
          label="In planning"
          value={draftCount ?? 0}
          href="/itineraries"
          description="Drafts being assembled."
        />
        <DashStat
          label="Planned"
          value={plannedCount ?? 0}
          href="/itineraries"
          description="Ready to go."
        />
        <DashStat
          label="In progress"
          value={inProgressCount ?? 0}
          href="/itineraries"
          description="Happening now."
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="j-card p-5">
          <h2 className="h3 mb-3">Calendar</h2>
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
          <h2 className="h3 mb-3">Recent itineraries</h2>
          {recent && recent.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between text-sm"
                >
                  <Link
                    href={`/itineraries/${r.id}`}
                    className="truncate hover:underline"
                  >
                    {r.title ??
                      formatDateInTz(new Date(r.date_start), wsCfg.timezone)}
                    <span className="ml-2 text-xs text-ink-dim">
                      {formatDateInTz(new Date(r.date_start), wsCfg.timezone)}
                    </span>
                  </Link>
                  <span className="chip">
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
  return (
    <section className="j-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="uc mb-2">Next up</p>
          <h2 className="h2 mb-1">{title}</h2>
        </div>
        <div className="text-right">
          <p className="mono text-2xl text-ink">
            {formatDateInTz(new Date(startDate), timezone)}
          </p>
          {endDate !== startDate ? (
            <p className="small">
              → {formatDateInTz(new Date(endDate), timezone)}
            </p>
          ) : null}
          <span className="chip mt-2 inline-flex">{STATUS_LABEL[status]}</span>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Link href={`/itineraries/${id}`} className="btn-primary">
          Open itinerary
        </Link>
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

function DashStat({
  label,
  value,
  href,
  description,
}: {
  label: string;
  value: number;
  href: Route;
  description: string;
}) {
  return (
    <Link href={href} className="j-card block p-5 hover:bg-card-2">
      <p className="uc mb-2">{label}</p>
      <p className="mono mb-1 text-3xl font-medium text-ink">{value}</p>
      <p className="small">{description}</p>
    </Link>
  );
}

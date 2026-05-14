import Link from "next/link";
import type { Route } from "next";
import { PageShell } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { formatDateInTz, formatTimeInTz } from "@/lib/types/time";

export default async function DashboardPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const wsCfg = await getWorkspaceConfig(ctx.workspaceId);

  const nowIso = new Date().toISOString();

  const [
    { data: calendarConn },
    { data: nextVisit },
    { count: draftCount },
    { count: proposedCount },
    { count: confirmedCount },
    { data: recentVisits },
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
      .from("visit_plans")
      .select(
        "id, title, status, proposed_start_time, customer:customers(name)",
      )
      .eq("workspace_id", ctx.workspaceId)
      .in("status", ["confirmed", "booked", "in_progress"])
      .gte("proposed_start_time", nowIso)
      .order("proposed_start_time")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("visit_plans")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId)
      .in("status", ["draft", "checking"]),
    supabase
      .from("visit_plans")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId)
      .eq("status", "proposed"),
    supabase
      .from("visit_plans")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId)
      .in("status", ["confirmed", "booked"]),
    supabase
      .from("visit_plans")
      .select(
        "id, title, status, proposed_start_time, customer:customers(name)",
      )
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const nextCustomer = (nextVisit?.customer as unknown as { name?: string } | null)?.name ?? null;

  return (
    <PageShell
      title="Dashboard"
      description="Your next visit, drafts in progress, and quick actions."
      actions={
        <Link href="/visits/new" className="btn-terra">
          + Plan new visit
        </Link>
      }
    >
      {nextVisit ? (
        <NextVisitHero
          title={nextVisit.title ?? nextCustomer ?? "Upcoming visit"}
          customer={nextCustomer}
          start={nextVisit.proposed_start_time}
          status={nextVisit.status as string}
          timezone={wsCfg.timezone}
          id={nextVisit.id}
        />
      ) : (
        <NoNextVisit />
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <DashStat
          label="Drafts in progress"
          value={draftCount ?? 0}
          href="/visits"
          description="Visit plans you've started but not yet planned."
        />
        <DashStat
          label="Proposed"
          value={proposedCount ?? 0}
          href="/visits"
          description="Planned, ready to confirm."
        />
        <DashStat
          label="Confirmed"
          value={confirmedCount ?? 0}
          href="/itinerary"
          description="Committed visits — see your itinerary."
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
                visit + travel blocks automatically.
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
          <h2 className="h3 mb-3">Recent visits</h2>
          {recentVisits && recentVisits.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {recentVisits.map((v) => {
                const cust = (v.customer as unknown as { name?: string } | null)?.name;
                return (
                  <li
                    key={v.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <Link
                      href={`/visits/${v.id}`}
                      className="truncate hover:underline"
                    >
                      {v.title ?? cust ?? "Untitled visit"}
                      <span className="ml-2 text-xs text-ink-dim">
                        {v.proposed_start_time
                          ? formatDateInTz(
                              new Date(v.proposed_start_time),
                              wsCfg.timezone,
                            )
                          : ""}
                      </span>
                    </Link>
                    <span className="chip">{v.status}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="small">No visits yet. Plan your first one above.</p>
          )}
        </div>
      </section>
    </PageShell>
  );
}

function NextVisitHero({
  title,
  customer,
  start,
  status,
  timezone,
  id,
}: {
  title: string;
  customer: string | null;
  start: string | null;
  status: string;
  timezone: string;
  id: string;
}) {
  return (
    <section className="j-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="uc mb-2">Next up</p>
          <h2 className="h2 mb-1">{title}</h2>
          {customer && customer !== title ? (
            <p className="small">{customer}</p>
          ) : null}
        </div>
        <div className="text-right">
          {start ? (
            <>
              <p className="mono text-2xl text-ink">
                {formatTimeInTz(new Date(start), timezone)}
              </p>
              <p className="small">
                {formatDateInTz(new Date(start), timezone)}
              </p>
            </>
          ) : null}
          <span className="chip mt-2 inline-flex">{status}</span>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Link href={`/visits/${id}`} className="btn-primary">
          Open visit
        </Link>
        <Link href={`/visits/${id}/travel-day`} className="btn-ghost">
          Travel-day view
        </Link>
      </div>
    </section>
  );
}

function NoNextVisit() {
  return (
    <section className="j-card-soft p-6">
      <p className="uc mb-2">Next up</p>
      <p className="body">
        Nothing scheduled yet. Plan your first visit to see it land here.
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

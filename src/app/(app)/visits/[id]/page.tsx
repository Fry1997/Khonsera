import { notFound } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { formatTimeInTz, formatDateInTz } from "@/lib/types/time";
import { TravelOptionsPanel } from "./travel-options-panel";
import { VisitCalendarWidget } from "@/components/visit-calendar-widget";
import { RePlanButton } from "./re-plan-button";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  checking: "Checking",
  proposed: "Proposed",
  confirmed: "Confirmed",
  booked: "Booked",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default async function VisitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: visit } = await supabase
    .from("visit_plans")
    .select(
      `id, title, status, proposed_start_time, meeting_duration_minutes,
       customer_id, customer_site_id, latest_return_time, notes,
       customer:customers(name),
       customer_site:customer_sites(name, address),
       start_location:locations!visit_plans_start_location_id_fkey(name),
       return_location:locations!visit_plans_return_location_id_fkey(name)`,
    )
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!visit) notFound();

  const wsCfg = await getWorkspaceConfig(ctx.workspaceId);

  // Pull the latest planning run with its options and legs.
  const { data: runs } = await supabase
    .from("planning_runs")
    .select(
      `id, generated_at, status, summary,
       travel_options(
         id, mode, feasibility_status, leave_origin_at, arrive_site_at,
         meeting_start_at, meeting_end_at, leave_site_at,
         arrive_return_location_at, total_duration_minutes,
         total_cost_estimate, travel_time_minutes, buffer_minutes,
         recommendation_summary, risk_summary, currency,
         journey_legs(
           id, sequence, leg_type, start_location_name, end_location_name,
           start_time, end_time, duration_minutes, distance_miles,
           provider, service_number, instructions
         )
       )`,
    )
    .eq("visit_plan_id", id)
    .order("generated_at", { ascending: false })
    .limit(1);
  const latestRun = runs?.[0];

  // Saved trip if any (after confirm)
  const { data: savedTrip } = await supabase
    .from("saved_trips")
    .select("id, status, selected_travel_option_id")
    .eq("visit_plan_id", id)
    .maybeSingle();

  const customer = visit.customer as unknown as { name: string } | null;
  const site = visit.customer_site as unknown as { name: string | null; address: string | null } | null;

  return (
    <PageShell
      title={visit.title ?? customer?.name ?? "Visit"}
      description={`${STATUS_LABEL[visit.status] ?? visit.status} · ${
        visit.proposed_start_time
          ? `${formatDateInTz(new Date(visit.proposed_start_time), wsCfg.timezone)} at ${formatTimeInTz(new Date(visit.proposed_start_time), wsCfg.timezone)}`
          : "No time set"
      }`}
      actions={
        <>
          <RePlanButton visitId={id} />
          <Link href="/visits" className="btn-ghost">
            Back to visits
          </Link>
        </>
      }
    >
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border border-border p-4 text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Customer
          </h2>
          <p className="mt-1 font-medium">{customer?.name ?? "—"}</p>
          {site ? (
            <p className="text-xs text-muted-foreground">
              {site.name ?? ""} {site.address ? `· ${site.address}` : ""}
            </p>
          ) : null}
        </div>
        <div className="rounded-md border border-border p-4 text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Appointment
          </h2>
          <p className="mt-1 font-medium">
            {visit.proposed_start_time
              ? formatTimeInTz(new Date(visit.proposed_start_time), wsCfg.timezone)
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {visit.meeting_duration_minutes} min meeting
          </p>
        </div>
        <div className="rounded-md border border-border p-4 text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Latest return
          </h2>
          <p className="mt-1 font-medium">
            {visit.latest_return_time
              ? formatTimeInTz(new Date(visit.latest_return_time), wsCfg.timezone)
              : "No constraint"}
          </p>
        </div>
      </section>

      {latestRun ? (
        <>
          {(() => {
            const selectedOption =
              latestRun.travel_options.find(
                (o) => o.id === savedTrip?.selected_travel_option_id,
              ) ?? latestRun.travel_options[0];
            if (!selectedOption || !selectedOption.leave_origin_at) return null;
            return (
              <VisitCalendarWidget
                timezone={wsCfg.timezone}
                bands={[
                  {
                    start: new Date(selectedOption.leave_origin_at),
                    end: new Date(selectedOption.arrive_site_at!),
                    label: "Travel out",
                    kind: "outbound_travel",
                  },
                  {
                    start: new Date(selectedOption.meeting_start_at!),
                    end: new Date(selectedOption.meeting_end_at!),
                    label: visit.title ?? customer?.name ?? "Meeting",
                    kind: "meeting",
                  },
                  {
                    start: new Date(selectedOption.leave_site_at!),
                    end: new Date(selectedOption.arrive_return_location_at!),
                    label: "Travel home",
                    kind: "return_travel",
                  },
                ]}
              />
            );
          })()}

          <TravelOptionsPanel
            visitId={id}
            visitStatus={visit.status}
            run={latestRun}
            savedTrip={savedTrip ?? null}
            timezone={wsCfg.timezone}
          />
        </>
      ) : (
        <div className="j-card p-6 small">
          No planning run yet. This usually means the form hit a
          missing-integration state — go back and try again, or enable demo
          mode if you&apos;re staff.
        </div>
      )}
    </PageShell>
  );
}

import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { formatDateInTz, formatTimeInTz } from "@/lib/types/time";
import type { VisitStatus } from "@/lib/types/domain";

type VisitRow = {
  id: string;
  title: string | null;
  status: VisitStatus;
  proposed_start_time: string | null;
  customer: { name: string } | null;
};

const STATUS_LABEL: Record<VisitStatus, string> = {
  draft: "Draft",
  checking: "Checking",
  proposed: "Proposed",
  confirmed: "Confirmed",
  booked: "Booked",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_TAG: Record<VisitStatus, string> = {
  draft: "tag-tight",
  checking: "tag-tight",
  proposed: "tag-tight",
  confirmed: "tag-ok",
  booked: "tag-ok",
  in_progress: "tag-ok solid",
  completed: "tag-ok",
  cancelled: "tag-no",
};

export default async function VisitsPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const wsCfg = await getWorkspaceConfig(ctx.workspaceId);

  const { data: rawVisits } = await supabase
    .from("visit_plans")
    .select(
      "id, title, status, proposed_start_time, customer:customers(name)",
    )
    .eq("workspace_id", ctx.workspaceId)
    .order("proposed_start_time", { ascending: true, nullsFirst: false })
    .limit(100);

  const visits = (rawVisits ?? []) as unknown as VisitRow[];
  const now = Date.now();

  const upcoming = visits.filter(
    (v) =>
      ["proposed", "confirmed", "booked", "in_progress"].includes(v.status) &&
      v.proposed_start_time &&
      Date.parse(v.proposed_start_time) >= now,
  );
  const drafts = visits.filter((v) =>
    ["draft", "checking"].includes(v.status),
  );
  const past = visits.filter(
    (v) =>
      ["completed", "cancelled"].includes(v.status) ||
      (v.proposed_start_time && Date.parse(v.proposed_start_time) < now),
  );

  return (
    <PageShell
      title="Visits"
      description="All visit plans — drafts, proposed, confirmed and completed."
      actions={
        <Link href="/visits/new" className="btn-terra">
          + Plan new visit
        </Link>
      }
    >
      {visits.length === 0 ? (
        <div className="j-card-soft p-8 text-center">
          <p className="body mb-3">No visits yet.</p>
          <Link href="/visits/new" className="btn-terra">
            Plan your first visit
          </Link>
        </div>
      ) : (
        <>
          {upcoming.length > 0 ? (
            <VisitSection
              title="Upcoming"
              visits={upcoming}
              timezone={wsCfg.timezone}
            />
          ) : null}
          {drafts.length > 0 ? (
            <VisitSection
              title="In planning"
              visits={drafts}
              timezone={wsCfg.timezone}
              subtle
            />
          ) : null}
          {past.length > 0 ? (
            <VisitSection
              title="Past & completed"
              visits={past}
              timezone={wsCfg.timezone}
              subtle
            />
          ) : null}
        </>
      )}
    </PageShell>
  );
}

function VisitSection({
  title,
  visits,
  timezone,
  subtle = false,
}: {
  title: string;
  visits: VisitRow[];
  timezone: string;
  subtle?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h2 className="h3">{title}</h2>
        <span className="small">
          {visits.length} {visits.length === 1 ? "visit" : "visits"}
        </span>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        {visits.map((v) => (
          <VisitCard
            key={v.id}
            visit={v}
            timezone={timezone}
            subtle={subtle}
          />
        ))}
      </div>
    </section>
  );
}

function VisitCard({
  visit,
  timezone,
  subtle,
}: {
  visit: VisitRow;
  timezone: string;
  subtle?: boolean;
}) {
  const customer = visit.customer?.name ?? "Unknown customer";
  const title = visit.title && visit.title !== customer ? visit.title : null;

  return (
    <Link
      href={`/visits/${visit.id}`}
      className={`group flex flex-col gap-3 p-5 transition ${
        subtle ? "j-card-soft" : "j-card"
      } hover:border-rule-2`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="h3 truncate group-hover:text-terra">{customer}</h3>
          {title ? (
            <p className="small truncate">{title}</p>
          ) : null}
        </div>
        <span
          className={`${STATUS_TAG[visit.status]} mono rounded-sm px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider`}
        >
          {STATUS_LABEL[visit.status]}
        </span>
      </div>

      <div className="flex items-baseline gap-2 text-sm">
        {visit.proposed_start_time ? (
          <>
            <span className="mono text-ink">
              {formatTimeInTz(new Date(visit.proposed_start_time), timezone)}
            </span>
            <span className="small">
              {formatDateInTz(new Date(visit.proposed_start_time), timezone)}
            </span>
          </>
        ) : (
          <span className="small text-ink-faint">No time set</span>
        )}
      </div>
    </Link>
  );
}

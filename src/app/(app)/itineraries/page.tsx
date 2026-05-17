import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { formatDateInTz } from "@/lib/types/time";
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
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_TAG: Record<ItineraryStatus, string> = {
  draft: "tag-tight",
  planning: "tag-tight",
  planned: "tag-ok",
  in_progress: "tag-ok solid",
  completed: "tag-ok",
  cancelled: "tag-no",
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
    (r) => r.status === "draft" || r.status === "planning",
  );
  const past = rows.filter(
    (r) =>
      r.status === "completed" ||
      r.status === "cancelled" ||
      r.date_end < today,
  );

  return (
    <PageShell
      title="Itineraries"
      description="Each itinerary is a day (or trip) made of ordered stops with transitions between them."
      actions={
        <Link href="/itineraries/new" className="btn-terra">
          + New itinerary
        </Link>
      }
    >
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
            <Section
              heading="Upcoming"
              rows={upcoming}
              timezone={wsCfg.timezone}
            />
          ) : null}
          {drafts.length > 0 && drafts.some((d) => !upcoming.includes(d)) ? (
            <Section
              heading="In planning"
              rows={drafts.filter((d) => !upcoming.includes(d))}
              timezone={wsCfg.timezone}
              subtle
            />
          ) : null}
          {past.length > 0 ? (
            <Section
              heading="Past & completed"
              rows={past}
              timezone={wsCfg.timezone}
              subtle
            />
          ) : null}
        </>
      )}
    </PageShell>
  );
}

function Section({
  heading,
  rows,
  timezone,
  subtle,
}: {
  heading: string;
  rows: Row[];
  timezone: string;
  subtle?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h2 className="h3">{heading}</h2>
        <span className="small">{rows.length}</span>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/itineraries/${r.id}`}
            className={`group flex flex-col gap-3 p-5 transition hover:border-rule-2 ${
              subtle ? "j-card-soft" : "j-card"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="h3 truncate group-hover:text-terra">
                {r.title ?? formatDateInTz(new Date(r.date_start), timezone)}
              </h3>
              <span
                className={`${STATUS_TAG[r.status]} mono rounded-sm px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider`}
              >
                {STATUS_LABEL[r.status]}
              </span>
            </div>
            <p className="small mono">
              {formatDateInTz(new Date(r.date_start), timezone)}
              {r.date_end !== r.date_start
                ? ` – ${formatDateInTz(new Date(r.date_end), timezone)}`
                : ""}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { PageShell, ComingSoon } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";

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
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  if (!visit) notFound();

  return (
    <PageShell
      title={visit.title ?? "Visit"}
      description={`Status: ${visit.status}`}
      actions={
        <Link
          href={`/visits/${id}/travel-day`}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium"
        >
          Travel-day view
        </Link>
      }
    >
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-border p-4">
          <h2 className="text-sm font-semibold">Appointment</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {visit.proposed_start_time
              ? new Date(visit.proposed_start_time).toLocaleString()
              : "No time set"}
          </p>
        </div>
        <div className="rounded-md border border-border p-4">
          <h2 className="text-sm font-semibold">Selected travel</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No travel option selected yet.
          </p>
        </div>
        <div className="rounded-md border border-border p-4">
          <h2 className="text-sm font-semibold">Booking</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Not booked. Partner rail booking lands when the integration is connected.
          </p>
        </div>
        <div className="rounded-md border border-border p-4">
          <h2 className="text-sm font-semibold">Expenses</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Track ticket, mileage and parking against this visit.
          </p>
        </div>
      </section>
      <ComingSoon
        feature="Travel options, calendar blocks, checklist and receipts"
        detail="Layout reserved on this page. Each block wires up as the corresponding feature lands."
      />
    </PageShell>
  );
}

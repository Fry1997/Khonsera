import Link from "next/link";
import { PageShell, ComingSoon } from "@/components/ui/page-shell";

export default function DashboardPage() {
  return (
    <PageShell
      title="Dashboard"
      description="Your next visit, drafts in progress, and quick actions."
      actions={
        <Link
          href="/visits/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Plan new visit
        </Link>
      }
    >
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-border p-4">
          <h2 className="text-sm font-semibold">Next upcoming visit</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing scheduled yet. Plan your first visit to see it here.
          </p>
        </div>
        <div className="rounded-md border border-border p-4">
          <h2 className="text-sm font-semibold">Draft visit plans</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Drafts you started while talking to a customer will show up here.
          </p>
        </div>
        <div className="rounded-md border border-border p-4">
          <h2 className="text-sm font-semibold">Confirmed trips</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Trips with travel saved and calendar blocks created.
          </p>
        </div>
        <div className="rounded-md border border-border p-4">
          <h2 className="text-sm font-semibold">Calendar connection</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Not connected. Connect Google Calendar from Settings to sync
            availability and create travel blocks.
          </p>
        </div>
      </section>
      <ComingSoon
        feature="Live integrations"
        detail="Routing, rail timetables and calendar sync are stubbed. Staff can toggle Demo mode to see realistic mock data flow through the planner."
      />
    </PageShell>
  );
}

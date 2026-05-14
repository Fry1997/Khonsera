import Link from "next/link";
import { PageShell, ComingSoon } from "@/components/ui/page-shell";

export default function DashboardPage() {
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
      <section className="grid gap-4 md:grid-cols-2">
        <DashCard
          title="Next upcoming visit"
          body="Nothing scheduled yet. Plan your first visit to see it here."
        />
        <DashCard
          title="Draft visit plans"
          body="Drafts you started while talking to a customer will show up here."
        />
        <DashCard
          title="Confirmed trips"
          body="Trips with travel saved and calendar blocks created."
        />
        <DashCard
          title="Calendar connection"
          body="Not connected. Connect Google Calendar from Settings to sync availability and create travel blocks."
        />
      </section>
      <ComingSoon
        feature="Live integrations"
        detail="Routing, rail timetables and calendar sync are stubbed. Staff can toggle Demo mode to see realistic mock data flow through the planner."
      />
    </PageShell>
  );
}

function DashCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="j-card p-5">
      <h2 className="h3 mb-2">{title}</h2>
      <p className="small">{body}</p>
    </div>
  );
}

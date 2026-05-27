import { redirect } from "next/navigation";
import { PageShell } from "@/components/ui/page-shell";
import { requireUserContext } from "@/lib/auth";
import { getRouteSegmentStats } from "@/lib/actions/rail-network";
import { RailRouteSeeder } from "./rail-route-seeder";

export default async function RailRoutesPage() {
  const ctx = await requireUserContext();
  if (!ctx.isSuperUser) redirect("/settings");

  const stats = await getRouteSegmentStats();

  return (
    <PageShell
      title="Rail Route Relations"
      description="Upload an Overpass JSON export of OSM train route relations. Extracts station-to-station polylines from named routes — no algorithmic routing needed."
    >
      <RailRouteSeeder initialCount={stats?.count ?? 0} />
    </PageShell>
  );
}

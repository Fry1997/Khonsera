import { PageShell } from "@/components/ui/page-shell";
import { requireUserContext } from "@/lib/auth";
import { getRailNetworkStats } from "@/lib/actions/rail-network";
import { RailNetworkSeeder } from "./rail-network-seeder";

export default async function RailNetworkPage() {
  await requireUserContext();
  const stats = await getRailNetworkStats();

  return (
    <PageShell
      title="Rail Network"
      description="Seed the UK rail graph from OpenStreetMap so route polylines can be generated server-side."
    >
      <RailNetworkSeeder initialStats={stats} />
    </PageShell>
  );
}

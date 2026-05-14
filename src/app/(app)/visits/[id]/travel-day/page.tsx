import { PageShell, ComingSoon } from "@/components/ui/page-shell";

export default async function TravelDayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PageShell
      title="Travel day"
      description="Point-to-point guidance for this visit."
    >
      <div className="rounded-md border border-border p-4 text-sm">
        <p className="font-medium">Visit {id}</p>
        <p className="text-muted-foreground">
          When the day arrives, this view shows the current leg, the next
          action, leave-by times, platform info and delay warnings.
        </p>
      </div>
      <ComingSoon
        feature="Live travel-day navigation"
        detail="Backed by TripProgress + JourneyLeg data, surfaced as a leg-by-leg timeline. Wires up after live rail/routing data is connected."
      />
    </PageShell>
  );
}

import { PageShell } from "@/components/ui/page-shell";
import { aviationstackConfig } from "@/lib/aviationstack/config";
import { FlightLookupForm } from "./flight-lookup-form";

export default async function FlightsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const configured = !!aviationstackConfig();

  return (
    <PageShell
      title="Flight lookup"
      description="Live status, gates and terminals via Aviationstack. Useful for travel-day prep when a visit involves a flight."
    >
      {!configured ? (
        <div className="rounded-md border border-dashed border-rule bg-card-2 p-5">
          <p className="h3 mb-1">Aviationstack not configured</p>
          <p className="small">
            Set <span className="mono">AVIATIONSTACK_API_KEY</span> in the
            deployment environment to enable flight status lookup.
          </p>
        </div>
      ) : (
        <FlightLookupForm initialFlight={sp.q ?? ""} initialDate={sp.date ?? ""} />
      )}
    </PageShell>
  );
}

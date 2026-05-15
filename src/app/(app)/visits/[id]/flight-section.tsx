"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormError, FormField, Input, SubmitButton } from "@/components/ui/form";
import { attachFlightToVisit, lookupFlight } from "@/lib/actions/flights";
import { feedbackFromError } from "@/lib/actions/_form";
import { FlightStatusCard } from "@/components/flight-status-card";
import type { AviationFlight } from "@/lib/aviationstack/client";

export function FlightSection({
  visitId,
  flightIata,
  aviationConfigured,
  initialFlights,
}: {
  visitId: string;
  flightIata: string | null;
  aviationConfigured: boolean;
  initialFlights: AviationFlight[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(!flightIata);
  const [flights, setFlights] = useState<AviationFlight[]>(initialFlights);

  const onAttach = (newIata: string | null) => {
    startTransition(async () => {
      setError(null);
      const attachResult = await attachFlightToVisit({
        visit_plan_id: visitId,
        flight_iata: newIata,
      });
      if (!attachResult.ok) {
        setError(feedbackFromError(attachResult.error).message);
        return;
      }
      if (newIata) {
        const lookup = await lookupFlight({ flight_iata: newIata });
        if (lookup.ok) setFlights(lookup.value.flights);
      } else {
        setFlights([]);
      }
      setEditing(false);
      router.refresh();
    });
  };

  return (
    <section className="j-card p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="h3">Flight</h2>
        {flightIata && !editing ? (
          <button
            type="button"
            className="text-xs underline"
            onClick={() => setEditing(true)}
          >
            Change
          </button>
        ) : null}
      </div>

      {!aviationConfigured ? (
        <p className="small">
          Flight lookup not configured. Set{" "}
          <span className="mono">AVIATIONSTACK_API_KEY</span> to enable.
        </p>
      ) : editing ? (
        <form
          className="flex flex-col gap-3"
          action={(formData) => {
            const v = String(formData.get("flight_iata") ?? "").trim();
            onAttach(v || null);
          }}
        >
          <FormField
            label="Flight number"
            htmlFor="flight_iata"
            hint="IATA format, e.g. BA123. Leave blank and save to detach."
          >
            <Input
              id="flight_iata"
              name="flight_iata"
              placeholder="e.g. BA123"
              defaultValue={flightIata ?? ""}
              autoComplete="off"
            />
          </FormField>
          <FormError message={error ?? undefined} />
          <div className="flex flex-wrap gap-2">
            <SubmitButton pending={pending}>Save</SubmitButton>
            {flightIata ? (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="btn-ghost"
              >
                Cancel
              </button>
            ) : null}
            {flightIata ? (
              <button
                type="button"
                onClick={() => onAttach(null)}
                disabled={pending}
                className="btn-destructive"
              >
                Detach flight
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="small">
            Attached: <span className="mono text-ink">{flightIata}</span>
          </p>
          {flights.length === 0 ? (
            <p className="small text-ink-faint">
              No live data for this flight number yet — try again later or
              check the number.
            </p>
          ) : (
            flights.map((f, i) => <FlightStatusCard key={i} flight={f} />)
          )}
          <FormError message={error ?? undefined} />
        </div>
      )}
    </section>
  );
}

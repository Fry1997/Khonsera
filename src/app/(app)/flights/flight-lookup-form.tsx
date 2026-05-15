"use client";

import { useState, useTransition } from "react";
import { FormError, FormField, Input, SubmitButton } from "@/components/ui/form";
import { lookupFlight } from "@/lib/actions/flights";
import { feedbackFromError } from "@/lib/actions/_form";
import { FlightStatusCard } from "@/components/flight-status-card";
import type { AviationFlight } from "@/lib/aviationstack/client";

export function FlightLookupForm({
  initialFlight,
  initialDate,
}: {
  initialFlight: string;
  initialDate: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flights, setFlights] = useState<AviationFlight[] | null>(null);
  const [searched, setSearched] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <form
        className="j-card grid gap-3 p-5 sm:grid-cols-[1fr_auto_auto] sm:items-end"
        action={(formData) => {
          startTransition(async () => {
            setError(null);
            setFlights(null);
            const flightIata = String(formData.get("flight_iata") ?? "").trim();
            if (!flightIata) {
              setError("Enter a flight number, e.g. BA123");
              return;
            }
            const result = await lookupFlight({
              flight_iata: flightIata,
              date: (formData.get("date") as string) || undefined,
            });
            if (!result.ok) {
              setError(feedbackFromError(result.error).message);
              return;
            }
            setSearched(flightIata.toUpperCase());
            setFlights(result.value.flights);
          });
        }}
      >
        <FormField label="Flight number" htmlFor="flight_iata">
          <Input
            id="flight_iata"
            name="flight_iata"
            placeholder="e.g. BA123"
            defaultValue={initialFlight}
            autoComplete="off"
            required
          />
        </FormField>
        <FormField label="Date (optional)" htmlFor="date">
          <Input
            id="date"
            name="date"
            type="date"
            defaultValue={initialDate}
          />
        </FormField>
        <SubmitButton pending={pending}>Look up</SubmitButton>
      </form>

      <FormError message={error ?? undefined} />

      {searched && flights !== null ? (
        flights.length === 0 ? (
          <div className="j-card-soft p-5">
            <p className="body">
              No flights found for <span className="mono">{searched}</span>.
              Double-check the flight number (IATA, e.g. <span className="mono">BA123</span>) and the date.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {flights.map((f, i) => (
              <FlightStatusCard key={i} flight={f} />
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}

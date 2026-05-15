"use server";

import { z } from "zod";
import { getFlightsByNumber, type AviationFlight } from "@/lib/aviationstack/client";
import { aviationstackConfig } from "@/lib/aviationstack/config";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { createClient } from "@/lib/supabase/server";
import { parseInput } from "./_helpers";
import { err, errors, ok, type Result } from "@/lib/errors";

const lookupSchema = z.object({
  flight_iata: z
    .string()
    .trim()
    .min(3)
    .max(10)
    .transform((s) => s.toUpperCase().replace(/\s+/g, "")),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type FlightStatusResult = {
  configured: boolean;
  flights: AviationFlight[];
};

export async function lookupFlight(
  input: z.input<typeof lookupSchema>,
): Promise<Result<FlightStatusResult>> {
  await requireUserContext();
  const parsed = parseInput(lookupSchema, input);
  if (!parsed.ok) return parsed;

  if (!aviationstackConfig()) {
    return ok({ configured: false, flights: [] });
  }

  try {
    const flights = await getFlightsByNumber({
      flightIata: parsed.value.flight_iata,
      date: parsed.value.date,
    });
    return ok({ configured: true, flights: flights ?? [] });
  } catch (e) {
    return err(
      errors.integration(
        "aviationstack",
        (e as Error).message || "Flight lookup failed",
      ),
    );
  }
}

// Attach a flight number to a transport_booked stop. Stored in the stop's
// metadata JSONB so we don't need a column per attachable provider.
const attachSchema = z.object({
  stop_id: z.string().uuid(),
  flight_iata: z
    .string()
    .trim()
    .max(10)
    .nullable()
    .transform((s) => (s ? s.toUpperCase().replace(/\s+/g, "") : null)),
});

export async function attachFlightToStop(
  input: z.input<typeof attachSchema>,
): Promise<Result<{ id: string; flightIata: string | null }>> {
  const parsed = parseInput(attachSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: stop } = await supabase
    .from("stops")
    .select("id, metadata")
    .eq("id", parsed.value.stop_id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!stop) return err(errors.notFound("stop"));

  const existingMeta = (stop.metadata as Record<string, unknown> | null) ?? {};
  const newMeta = parsed.value.flight_iata
    ? { ...existingMeta, flight_iata: parsed.value.flight_iata }
    : Object.fromEntries(
        Object.entries(existingMeta).filter(([k]) => k !== "flight_iata"),
      );

  const { error } = await supabase
    .from("stops")
    .update({ metadata: newMeta })
    .eq("id", stop.id);
  if (error) return err(errors.unexpected(error.message ?? "Couldn't attach flight"));

  await recordAudit({
    entityType: "stop",
    entityId: stop.id,
    action: parsed.value.flight_iata ? "attach_flight" : "detach_flight",
    after: { flight_iata: parsed.value.flight_iata },
  });

  return ok({ id: stop.id, flightIata: parsed.value.flight_iata });
}

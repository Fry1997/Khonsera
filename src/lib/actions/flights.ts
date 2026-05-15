"use server";

import { z } from "zod";
import { getFlightsByNumber, type AviationFlight } from "@/lib/aviationstack/client";
import { aviationstackConfig } from "@/lib/aviationstack/config";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { createClient } from "@/lib/supabase/server";
import { parseInput } from "./_helpers";
import { err, errors, ok, type Result } from "@/lib/errors";
import { FLIGHT_NOTE_PREFIX, FLIGHT_NOTE_RE } from "@/lib/flights/notes";

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

const attachSchema = z.object({
  visit_plan_id: z.string().uuid(),
  flight_iata: z
    .string()
    .trim()
    .max(10)
    .nullable()
    .transform((s) => (s ? s.toUpperCase().replace(/\s+/g, "") : null)),
});

// Attach (or detach when null) a flight number to a visit. The note-marker
// constants live in src/lib/flights/notes.ts so they can be imported from
// non-server modules — server-action files can only export async functions.

export async function attachFlightToVisit(
  input: z.input<typeof attachSchema>,
): Promise<Result<{ id: string; flightIata: string | null }>> {
  const parsed = parseInput(attachSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: visit, error: readErr } = await supabase
    .from("visit_plans")
    .select("id, notes")
    .eq("id", parsed.value.visit_plan_id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (readErr || !visit) return err(errors.notFound("visit_plan"));

  const existingNotes = (visit.notes ?? "").replace(FLIGHT_NOTE_RE, "").trim();
  const newNotes = parsed.value.flight_iata
    ? `${FLIGHT_NOTE_PREFIX} ${parsed.value.flight_iata}\n${existingNotes}`.trim()
    : existingNotes;

  const { error: updateErr } = await supabase
    .from("visit_plans")
    .update({ notes: newNotes })
    .eq("id", visit.id);
  if (updateErr) {
    return err(
      errors.unexpected(updateErr.message ?? "Couldn't attach flight"),
    );
  }

  await recordAudit({
    entityType: "visit_plan",
    entityId: visit.id,
    action: parsed.value.flight_iata ? "attach_flight" : "detach_flight",
    after: { flight_iata: parsed.value.flight_iata },
  });

  return ok({ id: visit.id, flightIata: parsed.value.flight_iata });
}


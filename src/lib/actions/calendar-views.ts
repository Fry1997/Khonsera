"use server";

import { z } from "zod";
import { listEvents } from "@/lib/integrations/calendar";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { requireUserContext } from "@/lib/auth";
import { parseInput } from "./_helpers";
import { ok, err, errors, type Result } from "@/lib/errors";

const inputSchema = z.object({
  // ISO date (YYYY-MM-DD) — interpreted in the workspace timezone.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type DayEvent = {
  id: string;
  title: string;
  start: string; // ISO datetime
  end: string;
};

export type DayEventsResult = {
  mode: "live" | "demo" | "unavailable";
  events: DayEvent[];
  reason?: string;
};

export async function getDayEvents(
  input: z.input<typeof inputSchema>,
): Promise<Result<DayEventsResult>> {
  const parsed = parseInput(inputSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const wsCfg = await getWorkspaceConfig(ctx.workspaceId);

  // Build a UTC window that covers the entire day in the workspace timezone.
  // Use the date string + the timezone-formatted day boundary. Simplest
  // approach: take the date in UTC midnight and extend by ±14h — the
  // intersection with the calendar's day is what matters for display.
  const dateUtc = new Date(`${parsed.value.date}T00:00:00.000Z`);
  const start = new Date(dateUtc.getTime() - 14 * 60 * 60_000);
  const end = new Date(dateUtc.getTime() + 38 * 60 * 60_000);

  const result = await listEvents({ start, end });
  if (result.mode === "unavailable") {
    return ok({ mode: "unavailable", events: [], reason: result.reason });
  }

  // Filter to events that actually fall on the requested local date.
  const dayMatcher = new Intl.DateTimeFormat("en-CA", {
    timeZone: wsCfg.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const targetDay = parsed.value.date;

  const events: DayEvent[] = result.data
    .filter((e) => {
      const onDay = dayMatcher.format(e.start) === targetDay;
      return onDay;
    })
    .map((e) => ({
      id: e.id,
      title: e.summary ?? "Busy",
      start: e.start.toISOString(),
      end: e.end.toISOString(),
    }))
    .sort((a, b) => a.start.localeCompare(b.start));

  return ok({
    mode: result.mode === "live" ? "live" : "demo",
    events,
  });
}

// Convenience for the visit-detail "re-check feasibility" button, which
// re-runs planning for an existing visit using its current parameters.
const reRunSchema = z.object({ visitId: z.string().uuid() });

export async function reRunPlanning(
  input: z.input<typeof reRunSchema>,
): Promise<Result<{ planningRunId: string }>> {
  const parsed = parseInput(reRunSchema, input);
  if (!parsed.ok) return parsed;

  // Defer to the existing internal runner. This keeps the server action thin
  // and avoids duplicating the orchestration logic.
  const { rePlanVisit } = await import("./planning");
  const result = await rePlanVisit(parsed.value.visitId);
  if (!result.ok) return result;
  if (!result.value) return err(errors.notFound("planning_run"));
  return ok({ planningRunId: result.value.planningRunId });
}

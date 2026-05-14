// Typed job registry. Every job name has a Zod payload schema so callers
// can't enqueue malformed work and future workers can validate at the
// boundary before executing.
//
// Adding a new background job = add an entry here + (eventually) a handler
// in the worker. Until the handler exists, the job sits in the queue as
// pending — harmless.

import { z } from "zod";

export const jobPayloadSchemas = {
  // Sent ~30 min before the recommended leave time for an upcoming visit.
  "notify.leave_soon": z.object({
    visit_plan_id: z.string().uuid(),
    leave_at: z.string().datetime(),
  }),

  // Sent at the recommended leave time.
  "notify.leave_now": z.object({
    visit_plan_id: z.string().uuid(),
  }),

  // Sent when the user should leave the customer site to make the return train.
  "notify.return_reminder": z.object({
    visit_plan_id: z.string().uuid(),
    leave_site_at: z.string().datetime(),
  }),

  // Periodic poll of live rail status during a trip in progress.
  "trip.poll_rail_status": z.object({
    saved_trip_id: z.string().uuid(),
  }),

  // Pull free/busy + recent changes from the connected calendar.
  "calendar.sync_delta": z.object({
    calendar_connection_id: z.string().uuid(),
  }),

  // Mark expired booking intents (opened_partner but never confirmed) as
  // abandoned after N hours.
  "booking.gc_abandoned": z.object({
    older_than_hours: z.number().int().positive().default(24),
  }),
} as const;

export type JobName = keyof typeof jobPayloadSchemas;

export type JobPayload<N extends JobName> = z.infer<(typeof jobPayloadSchemas)[N]>;

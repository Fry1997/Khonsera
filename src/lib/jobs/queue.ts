// Public enqueue API. Server actions and (eventually) other jobs call this
// rather than touching the jobs table directly. The worker layer is
// deliberately not in this module — it can be a pg_cron loop, a Supabase
// Edge Function, or an external process; this module is just the producer.

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import {
  errors,
  fromThrown,
  ok,
  err,
  type Result,
} from "@/lib/errors";
import { jobPayloadSchemas, type JobName, type JobPayload } from "./registry";

export type EnqueueOptions = {
  runAt?: Date;
  maxAttempts?: number;
  idempotencyKey?: string;
  // For system jobs not scoped to a specific workspace (e.g. global GC).
  // Defaults to the requireUserContext() workspace.
  workspaceId?: string | null;
};

export async function enqueue<N extends JobName>(
  jobName: N,
  payload: JobPayload<N>,
  options: EnqueueOptions = {},
): Promise<Result<{ id: string }>> {
  const schema = jobPayloadSchemas[jobName];
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return err(
      errors.validation(
        `Invalid payload for ${jobName}: ${parsed.error.issues[0]?.message ?? "unknown"}`,
      ),
    );
  }

  const ctx = await requireUserContext();
  const workspaceId =
    options.workspaceId === null
      ? null
      : (options.workspaceId ?? ctx.workspaceId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      workspace_id: workspaceId,
      job_name: jobName,
      payload: parsed.data as never,
      run_at: (options.runAt ?? new Date()).toISOString(),
      max_attempts: options.maxAttempts ?? 5,
      idempotency_key: options.idempotencyKey ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = unique violation on (workspace_id, job_name, idempotency_key);
    // treat as success-by-dedupe and return the existing job's id.
    if (error.code === "23505" && options.idempotencyKey) {
      const { data: existing } = await supabase
        .from("jobs")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("job_name", jobName)
        .eq("idempotency_key", options.idempotencyKey)
        .in("status", ["pending", "running"])
        .maybeSingle();
      if (existing) return ok({ id: existing.id });
    }
    return err(fromThrown(error, "job"));
  }
  if (!data) return err(errors.unexpected("enqueue returned no row"));
  return ok({ id: data.id });
}

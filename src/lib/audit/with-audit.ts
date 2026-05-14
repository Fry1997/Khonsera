// withAudit() — wrap a server action so success writes an audit_events row.
// State transitions write their own audit row from inside the SQL function
// (see 0003_state_machines.sql); use this helper for plain CRUD mutations.

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";

export type AuditInput = {
  entityType: string;
  entityId?: string | null;
  action: string; // e.g. "create", "update", "delete", "soft_delete"
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
};

export async function recordAudit(input: AuditInput): Promise<void> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  await supabase.from("audit_events").insert({
    workspace_id: ctx.workspaceId,
    actor_id: ctx.userId,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    action: input.action,
    before: (input.before ?? null) as never,
    after: (input.after ?? null) as never,
    metadata: (input.metadata ?? null) as never,
  });
}

export async function withAudit<T>(
  audit: Omit<AuditInput, "after"> & { describeAfter?: (value: T) => unknown },
  fn: () => Promise<T>,
): Promise<T> {
  const result = await fn();
  await recordAudit({
    ...audit,
    after: audit.describeAfter ? audit.describeAfter(result) : result,
  });
  return result;
}

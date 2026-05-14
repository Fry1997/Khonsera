"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { err, errors, ok, fromThrown, type Result } from "@/lib/errors";

export async function disconnectGoogleCalendar(): Promise<Result<{ id: string }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("calendar_connections")
    .select("id, provider_account_email")
    .eq("user_id", ctx.userId)
    .eq("workspace_id", ctx.workspaceId)
    .eq("provider", "google")
    .maybeSingle();
  if (!existing) return err(errors.notFound("calendar_connection"));

  const { error } = await supabase
    .from("calendar_connections")
    .delete()
    .eq("id", existing.id);
  if (error) return err(fromThrown(error, "calendar_connection"));

  await recordAudit({
    entityType: "calendar_connection",
    entityId: existing.id,
    action: "disconnect",
    before: existing,
  });
  return ok({ id: existing.id });
}

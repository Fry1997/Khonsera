// Typed reader for workspace_settings. Every server action that needs to
// branch on a per-workspace flag goes through getWorkspaceFlags() so we
// have a single place to add new flags. Global feature flags still live in
// src/lib/features.ts; this module is per-workspace.

import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const workspaceFlagsSchema = z
  .object({
    // Add typed flags here as they appear. Unknown keys are preserved on
    // round-trip via the catchall, so we can soft-launch a flag with a
    // raw JSONB write before promoting it to the schema.
    expense_export_enabled: z.boolean().optional(),
  })
  .catchall(z.unknown());

export type WorkspaceFlags = z.infer<typeof workspaceFlagsSchema>;

export type WorkspaceConfig = {
  flags: WorkspaceFlags;
  timezone: string;
  currency: string;
};

export const getWorkspaceConfig = cache(
  async (workspaceId: string): Promise<WorkspaceConfig> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("workspace_settings")
      .select("flags, timezone, currency")
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !data) {
      // Shouldn't happen because handle_new_workspace() seeds it, but degrade
      // gracefully rather than crashing the request.
      return { flags: {}, timezone: "Europe/London", currency: "GBP" };
    }

    return {
      flags: workspaceFlagsSchema.parse(data.flags ?? {}),
      timezone: data.timezone,
      currency: data.currency,
    };
  },
);

export async function isFlagEnabled(
  workspaceId: string,
  key: keyof WorkspaceFlags,
): Promise<boolean> {
  const cfg = await getWorkspaceConfig(workspaceId);
  return Boolean(cfg.flags[key]);
}

"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";

const progressSchema = z.object({
  transitionId: z.string().uuid(),
  state: z.enum(["live", "done"]),
});

export type LiveTransitionProgress = {
  state: "live" | "done";
  actualStartedAt: string | null;
  actualArrivedAt: string | null;
};

export async function setLiveTransitionProgress(
  input: z.input<typeof progressSchema>,
): Promise<{ ok: true; value: LiveTransitionProgress } | { ok: false; error: string }> {
  const parsed = progressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That journey step could not be updated." };

  const ctx = await requireUserContext();
  const supabase = await createClient();
  const now = new Date().toISOString();

  const patch =
    parsed.data.state === "live"
      ? {
          commitment_state: "live" as const,
          actual_started_at: now,
          actual_arrived_at: null,
        }
      : {
          commitment_state: "done" as const,
          actual_arrived_at: now,
        };

  const { data, error } = await supabase
    .from("transitions")
    .update(patch)
    .eq("id", parsed.data.transitionId)
    .eq("workspace_id", ctx.workspaceId)
    .select("commitment_state, actual_started_at, actual_arrived_at")
    .maybeSingle();

  if (error || !data) return { ok: false, error: error?.message ?? "That journey step was not found." };

  return {
    ok: true,
    value: {
      state: data.commitment_state === "done" ? "done" : "live",
      actualStartedAt: data.actual_started_at,
      actualArrivedAt: data.actual_arrived_at,
    },
  };
}

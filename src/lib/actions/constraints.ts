"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import type { TransitionMode } from "@/lib/types/domain";

// Constraints & exclusions (planner master brief §5.8) — GLOBAL standing facts
// that bound and filter everything: excluded modes remove options from the
// ComparisonMatrix entirely (speed ranks; exclusions filter), "be home by" caps
// the day, a budget bounds cost. Stored as standing_facts (user + workspace
// scoped — genuinely global, not per-trip), the brief's "global standing facts".

export type PlanConstraints = {
  excludedModes: TransitionMode[];
  homeBy: string | null; // "HH:MM"
};

const EXCLUDABLE: TransitionMode[] = ["train", "flight", "tube", "bus", "taxi", "drive"];

export async function loadConstraints(): Promise<PlanConstraints> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("standing_facts")
    .select("fact_kind, label, details")
    .eq("user_id", ctx.userId)
    .eq("workspace_id", ctx.workspaceId)
    .eq("active", true)
    .in("fact_kind", ["mode_exclusion", "home_by"]);

  const excludedModes: TransitionMode[] = [];
  let homeBy: string | null = null;
  for (const row of data ?? []) {
    const details = (row.details as Record<string, unknown> | null) ?? {};
    if (row.fact_kind === "mode_exclusion") {
      const m = details.mode as TransitionMode | undefined;
      if (m && EXCLUDABLE.includes(m)) excludedModes.push(m);
    } else if (row.fact_kind === "home_by") {
      homeBy = (details.time as string | undefined) ?? null;
    }
  }
  return { excludedModes, homeBy };
}

export async function toggleModeExclusion(
  mode: TransitionMode,
): Promise<{ ok: boolean; error?: string }> {
  if (!EXCLUDABLE.includes(mode)) return { ok: false, error: "That mode can't be excluded." };
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("standing_facts")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("workspace_id", ctx.workspaceId)
    .eq("fact_kind", "mode_exclusion")
    .eq("details->>mode", mode)
    .maybeSingle();

  if (existing) {
    await supabase.from("standing_facts").delete().eq("id", existing.id);
  } else {
    const { error } = await supabase.from("standing_facts").insert({
      user_id: ctx.userId,
      workspace_id: ctx.workspaceId,
      label: `Avoid ${mode}`,
      fact_kind: "mode_exclusion",
      details: { mode },
      active: true,
    });
    if (error) return { ok: false, error: "Couldn't save that." };
  }
  revalidatePath("/plan");
  return { ok: true };
}

export async function setHomeBy(time: string | null): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("standing_facts")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("workspace_id", ctx.workspaceId)
    .eq("fact_kind", "home_by")
    .maybeSingle();

  if (!time) {
    if (existing) await supabase.from("standing_facts").delete().eq("id", existing.id);
  } else if (existing) {
    await supabase.from("standing_facts").update({ details: { time }, active: true }).eq("id", existing.id);
  } else {
    const { error } = await supabase.from("standing_facts").insert({
      user_id: ctx.userId,
      workspace_id: ctx.workspaceId,
      label: "Home by",
      fact_kind: "home_by",
      details: { time },
      active: true,
    });
    if (error) return { ok: false, error: "Couldn't save that." };
  }
  revalidatePath("/plan");
  return { ok: true };
}

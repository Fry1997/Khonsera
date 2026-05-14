"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { dbResult, parseInput } from "./_helpers";
import type { Result } from "@/lib/errors";
import type { TravelModePreference } from "@/lib/types/domain";

const preferenceEnum = z.enum(["rail", "drive", "compare", "mixed"]);

// Travel profile is 1:1 per (user, workspace) and provisioned by the auth
// trigger, so we only ever update it.
const updateTravelProfileSchema = z.object({
  default_drive_origin_location_id: z.string().uuid().nullable().optional(),
  default_rail_origin_location_id: z.string().uuid().nullable().optional(),
  default_return_location_id: z.string().uuid().nullable().optional(),
  preferred_mode: preferenceEnum.optional(),
  default_arrival_buffer_minutes: z.number().int().min(0).max(180).optional(),
  default_return_buffer_minutes: z.number().int().min(0).max(180).optional(),
  mileage_rate: z.number().min(0).max(10).optional(),
});

export type TravelProfile = {
  id: string;
  user_id: string;
  workspace_id: string;
  default_drive_origin_location_id: string | null;
  default_rail_origin_location_id: string | null;
  default_return_location_id: string | null;
  preferred_mode: TravelModePreference;
  default_arrival_buffer_minutes: number;
  default_return_buffer_minutes: number;
  mileage_rate: number;
};

export async function updateTravelProfile(
  input: z.input<typeof updateTravelProfileSchema>,
): Promise<Result<TravelProfile>> {
  const parsed = parseInput(updateTravelProfileSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("travel_profiles")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("travel_profiles")
    .update(parsed.value)
    .eq("user_id", ctx.userId)
    .eq("workspace_id", ctx.workspaceId)
    .select("*")
    .single();

  const result = dbResult<TravelProfile>(data, error, "travel_profile");
  if (result.ok) {
    await recordAudit({
      entityType: "travel_profile",
      entityId: result.value.id,
      action: "update",
      before,
      after: result.value,
    });
  }
  return result;
}

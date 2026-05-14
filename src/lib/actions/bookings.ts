"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { dbResult, parseInput } from "./_helpers";
import type { Result } from "@/lib/errors";

const createBookingIntentSchema = z.object({
  visit_plan_id: z.string().uuid(),
  travel_option_id: z.string().uuid().nullable().optional(),
  provider: z.string().trim().max(80).nullable().optional(),
  outbound_summary: z.string().trim().max(1000).nullable().optional(),
  return_summary: z.string().trim().max(1000).nullable().optional(),
  estimated_price: z.number().nonnegative().nullable().optional(),
  currency: z.enum(["GBP", "EUR", "USD"]).optional(),
  partner_deep_link: z.string().url().nullable().optional(),
  idempotency_key: z.string().uuid(),
});

const intentStatusEnum = z.enum([
  "not_started",
  "opened_partner",
  "booked",
  "failed",
  "abandoned",
]);

const updateBookingIntentStatusSchema = z.object({
  id: z.string().uuid(),
  status: intentStatusEnum,
});

const recordTravelBookingSchema = z.object({
  booking_intent_id: z.string().uuid(),
  provider: z.string().trim().max(80).nullable().optional(),
  booking_reference: z.string().trim().max(120).nullable().optional(),
  ticket_status: z
    .enum(["booked", "changed", "cancelled", "refunded", "unknown"])
    .optional(),
  actual_price: z.number().nonnegative().nullable().optional(),
  currency: z.enum(["GBP", "EUR", "USD"]).optional(),
  receipt_file_path: z.string().trim().max(500).nullable().optional(),
  idempotency_key: z.string().uuid(),
});

export async function createBookingIntent(
  input: z.input<typeof createBookingIntentSchema>,
): Promise<Result<{ id: string }>> {
  const parsed = parseInput(createBookingIntentSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  // Verify the visit belongs to the workspace before opening a booking against it.
  const { data: visit } = await supabase
    .from("visit_plans")
    .select("id")
    .eq("id", parsed.value.visit_plan_id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!visit) {
    return { ok: false, error: { kind: "not_found", entity: "visit_plan" } };
  }

  const { data, error } = await supabase
    .from("booking_intents")
    .insert({ ...parsed.value, workspace_id: ctx.workspaceId })
    .select("id")
    .single();

  const result = dbResult<{ id: string }>(data, error, "booking_intent");
  if (result.ok) {
    await recordAudit({
      entityType: "booking_intent",
      entityId: result.value.id,
      action: "create",
      after: { ...parsed.value, id: result.value.id },
    });
  }
  return result;
}

export async function updateBookingIntentStatus(
  input: z.input<typeof updateBookingIntentStatusSchema>,
): Promise<Result<{ id: string; status: string }>> {
  const parsed = parseInput(updateBookingIntentStatusSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("booking_intents")
    .select("status")
    .eq("id", parsed.value.id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("booking_intents")
    .update({ status: parsed.value.status })
    .eq("id", parsed.value.id)
    .eq("workspace_id", ctx.workspaceId)
    .select("id, status")
    .single();

  const result = dbResult<{ id: string; status: string }>(data, error, "booking_intent");
  if (result.ok) {
    await recordAudit({
      entityType: "booking_intent",
      entityId: result.value.id,
      action: "update_status",
      before,
      after: result.value,
    });
  }
  return result;
}

export async function recordTravelBooking(
  input: z.input<typeof recordTravelBookingSchema>,
): Promise<Result<{ id: string }>> {
  const parsed = parseInput(recordTravelBookingSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  // Confirm the intent belongs to the workspace.
  const { data: intent } = await supabase
    .from("booking_intents")
    .select("id, workspace_id")
    .eq("id", parsed.value.booking_intent_id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!intent) {
    return { ok: false, error: { kind: "not_found", entity: "booking_intent" } };
  }

  const { data, error } = await supabase
    .from("travel_bookings")
    .insert({
      ...parsed.value,
      workspace_id: ctx.workspaceId,
      booked_at: new Date().toISOString(),
      ticket_status: parsed.value.ticket_status ?? "booked",
    })
    .select("id")
    .single();

  const result = dbResult<{ id: string }>(data, error, "travel_booking");
  if (result.ok) {
    await recordAudit({
      entityType: "travel_booking",
      entityId: result.value.id,
      action: "create",
      after: { ...parsed.value, id: result.value.id },
    });
  }
  return result;
}

"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { dbResult, parseInput } from "./_helpers";
import type { Result } from "@/lib/errors";

// Bookings now belong to a STOP (typically a transport_booked stop). The
// optional itinerary back-ref keeps "all bookings for trip X" queries cheap.
const createBookingIntentSchema = z.object({
  stop_id: z.string().uuid(),
  itinerary_id: z.string().uuid().nullable().optional(),
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

  // Verify the stop belongs to the workspace before opening a booking.
  const { data: stop } = await supabase
    .from("stops")
    .select("id, itinerary_id")
    .eq("id", parsed.value.stop_id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!stop) {
    return { ok: false, error: { kind: "not_found", entity: "stop" } };
  }

  const { data, error } = await supabase
    .from("booking_intents")
    .insert({
      ...parsed.value,
      itinerary_id: parsed.value.itinerary_id ?? stop.itinerary_id,
      workspace_id: ctx.workspaceId,
    })
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

  const { data: intent } = await supabase
    .from("booking_intents")
    .select("id, workspace_id, itinerary_id, stop_id")
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

    // Auto-create the rail-ticket expense if one doesn't already exist for
    // this itinerary. Actual price beats the pre-booking estimate.
    if (parsed.value.actual_price != null && intent.itinerary_id) {
      const { data: existing } = await supabase
        .from("expense_records")
        .select("id")
        .eq("itinerary_id", intent.itinerary_id)
        .eq("workspace_id", ctx.workspaceId)
        .eq("type", "rail_ticket")
        .maybeSingle();
      if (!existing) {
        await supabase.from("expense_records").insert({
          itinerary_id: intent.itinerary_id,
          stop_id: intent.stop_id,
          workspace_id: ctx.workspaceId,
          user_id: ctx.userId,
          type: "rail_ticket",
          amount: parsed.value.actual_price,
          currency: parsed.value.currency ?? "GBP",
          notes: parsed.value.booking_reference
            ? `Booking ref: ${parsed.value.booking_reference}`
            : "Auto-generated from rail booking.",
        });
      }
    }
  }
  return result;
}

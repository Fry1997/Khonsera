"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { dbResult, parseInput } from "./_helpers";
import type { Result } from "@/lib/errors";
import type { ExpenseType } from "@/lib/types/domain";

const expenseTypeEnum = z.enum([
  "rail_ticket",
  "mileage",
  "parking",
  "taxi",
  "hotel",
  "food",
  "other",
]);

const baseExpenseSchema = z.object({
  visit_plan_id: z.string().uuid().nullable().optional(),
  type: expenseTypeEnum,
  amount: z.number().nonnegative().nullable().optional(),
  currency: z.enum(["GBP", "EUR", "USD"]).default("GBP"),
  receipt_file_path: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const updateExpenseSchema = baseExpenseSchema.extend({ id: z.string().uuid() });

const mileageInputSchema = z.object({
  visit_plan_id: z.string().uuid().nullable().optional(),
  distance_miles: z.number().positive(),
  mileage_rate: z.number().positive(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type ExpenseRecord = {
  id: string;
  workspace_id: string;
  user_id: string;
  visit_plan_id: string | null;
  type: ExpenseType;
  amount: number | null;
  currency: string;
  receipt_file_path: string | null;
  reimbursement_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function createExpense(
  input: z.input<typeof baseExpenseSchema>,
): Promise<Result<ExpenseRecord>> {
  const parsed = parseInput(baseExpenseSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("expense_records")
    .insert({
      ...parsed.value,
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
    })
    .select("*")
    .single();

  const result = dbResult<ExpenseRecord>(data, error, "expense_record");
  if (result.ok) {
    await recordAudit({
      entityType: "expense_record",
      entityId: result.value.id,
      action: "create",
      after: result.value,
    });
  }
  return result;
}

export async function updateExpense(
  input: z.input<typeof updateExpenseSchema>,
): Promise<Result<ExpenseRecord>> {
  const parsed = parseInput(updateExpenseSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("expense_records")
    .select("*")
    .eq("id", parsed.value.id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  const { id, ...patch } = parsed.value;
  const { data, error } = await supabase
    .from("expense_records")
    .update(patch)
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .select("*")
    .single();

  const result = dbResult<ExpenseRecord>(data, error, "expense_record");
  if (result.ok) {
    await recordAudit({
      entityType: "expense_record",
      entityId: result.value.id,
      action: "update",
      before,
      after: result.value,
    });
  }
  return result;
}

export async function recordMileageExpense(
  input: z.input<typeof mileageInputSchema>,
): Promise<Result<{ expenseId: string; calculatedAmount: number }>> {
  const parsed = parseInput(mileageInputSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const amount = Math.round(parsed.value.distance_miles * parsed.value.mileage_rate * 100) / 100;

  const { data: expense, error: expenseError } = await supabase
    .from("expense_records")
    .insert({
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
      visit_plan_id: parsed.value.visit_plan_id ?? null,
      type: "mileage",
      amount,
      currency: "GBP",
      notes: parsed.value.notes ?? null,
    })
    .select("id")
    .single();

  const expenseResult = dbResult<{ id: string }>(expense, expenseError, "expense_record");
  if (!expenseResult.ok) return expenseResult;

  const { error: mileageError } = await supabase.from("mileage_expenses").insert({
    expense_record_id: expenseResult.value.id,
    workspace_id: ctx.workspaceId,
    distance_miles: parsed.value.distance_miles,
    mileage_rate: parsed.value.mileage_rate,
    calculated_amount: amount,
  });

  if (mileageError) {
    return dbResult<{ expenseId: string; calculatedAmount: number }>(
      null,
      mileageError,
      "mileage_expense",
    );
  }

  await recordAudit({
    entityType: "expense_record",
    entityId: expenseResult.value.id,
    action: "create_mileage",
    after: {
      distance_miles: parsed.value.distance_miles,
      mileage_rate: parsed.value.mileage_rate,
      amount,
    },
  });

  return { ok: true, value: { expenseId: expenseResult.value.id, calculatedAmount: amount } };
}

export async function deleteExpense(id: string): Promise<Result<{ id: string }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("expense_records")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  const { error } = await supabase
    .from("expense_records")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);

  if (error) return dbResult<{ id: string }>(null, error, "expense_record");
  await recordAudit({
    entityType: "expense_record",
    entityId: id,
    action: "delete",
    before,
  });
  return { ok: true, value: { id } };
}

"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { dbResult, parseInput } from "./_helpers";
import type { Result } from "@/lib/errors";

const createCustomerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const updateCustomerSchema = createCustomerSchema.extend({
  id: z.string().uuid(),
});

export type Customer = {
  id: string;
  workspace_id: string;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function createCustomer(
  input: z.input<typeof createCustomerSchema>,
): Promise<Result<Customer>> {
  const parsed = parseInput(createCustomerSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .insert({
      workspace_id: ctx.workspaceId,
      name: parsed.value.name,
      notes: parsed.value.notes ?? null,
    })
    .select("*")
    .single();

  const result = dbResult<Customer>(data, error, "customer");
  if (result.ok) {
    await recordAudit({
      entityType: "customer",
      entityId: result.value.id,
      action: "create",
      after: result.value,
    });
  }
  return result;
}

export async function updateCustomer(
  input: z.input<typeof updateCustomerSchema>,
): Promise<Result<Customer>> {
  const parsed = parseInput(updateCustomerSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("customers")
    .select("*")
    .eq("id", parsed.value.id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("customers")
    .update({ name: parsed.value.name, notes: parsed.value.notes ?? null })
    .eq("id", parsed.value.id)
    .eq("workspace_id", ctx.workspaceId)
    .select("*")
    .single();

  const result = dbResult<Customer>(data, error, "customer");
  if (result.ok) {
    await recordAudit({
      entityType: "customer",
      entityId: result.value.id,
      action: "update",
      before,
      after: result.value,
    });
  }
  return result;
}

export async function deleteCustomer(id: string): Promise<Result<{ id: string }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);

  if (error) return dbResult<{ id: string }>(null, error, "customer");
  await recordAudit({
    entityType: "customer",
    entityId: id,
    action: "delete",
    before,
  });
  return { ok: true, value: { id } };
}

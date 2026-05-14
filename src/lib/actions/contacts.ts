"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { dbResult, parseInput } from "./_helpers";
import type { Result } from "@/lib/errors";

const baseContactSchema = z.object({
  customer_id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  role: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const updateContactSchema = baseContactSchema.extend({ id: z.string().uuid() });

export type Contact = {
  id: string;
  workspace_id: string;
  customer_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function createContact(
  input: z.input<typeof baseContactSchema>,
): Promise<Result<Contact>> {
  const parsed = parseInput(baseContactSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .insert({ ...parsed.value, workspace_id: ctx.workspaceId })
    .select("*")
    .single();

  const result = dbResult<Contact>(data, error, "contact");
  if (result.ok) {
    await recordAudit({
      entityType: "contact",
      entityId: result.value.id,
      action: "create",
      after: result.value,
    });
  }
  return result;
}

export async function updateContact(
  input: z.input<typeof updateContactSchema>,
): Promise<Result<Contact>> {
  const parsed = parseInput(updateContactSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", parsed.value.id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  const { id, ...patch } = parsed.value;
  const { data, error } = await supabase
    .from("contacts")
    .update(patch)
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .select("*")
    .single();

  const result = dbResult<Contact>(data, error, "contact");
  if (result.ok) {
    await recordAudit({
      entityType: "contact",
      entityId: result.value.id,
      action: "update",
      before,
      after: result.value,
    });
  }
  return result;
}

export async function deleteContact(id: string): Promise<Result<{ id: string }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);

  if (error) return dbResult<{ id: string }>(null, error, "contact");
  await recordAudit({
    entityType: "contact",
    entityId: id,
    action: "delete",
    before,
  });
  return { ok: true, value: { id } };
}

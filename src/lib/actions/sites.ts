"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { dbResult, maybeGeocode, parseInput } from "./_helpers";
import type { Result } from "@/lib/errors";

const baseSiteSchema = z.object({
  customer_id: z.string().uuid(),
  name: z.string().trim().max(200).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  postcode: z.string().trim().max(16).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  parking_notes: z.string().trim().max(1000).optional().nullable(),
  nearest_station_notes: z.string().trim().max(1000).optional().nullable(),
  access_notes: z.string().trim().max(1000).optional().nullable(),
});

const createSiteSchema = baseSiteSchema;
const updateSiteSchema = baseSiteSchema.extend({ id: z.string().uuid() });

export type CustomerSite = {
  id: string;
  workspace_id: string;
  customer_id: string;
  name: string | null;
  address: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  parking_notes: string | null;
  nearest_station_notes: string | null;
  access_notes: string | null;
  created_at: string;
  updated_at: string;
};

async function assertCustomerInWorkspace(
  customerId: string,
  workspaceId: string,
): Promise<Result<true>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!data) return { ok: false, error: { kind: "not_found", entity: "customer" } };
  return { ok: true, value: true };
}

export async function createCustomerSite(
  input: z.input<typeof createSiteSchema>,
): Promise<Result<CustomerSite>> {
  const parsed = parseInput(createSiteSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const check = await assertCustomerInWorkspace(parsed.value.customer_id, ctx.workspaceId);
  if (!check.ok) return check;

  const supabase = await createClient();
  const geocoded = await maybeGeocode(parsed.value);
  const { data, error } = await supabase
    .from("customer_sites")
    .insert({ ...geocoded, workspace_id: ctx.workspaceId })
    .select("*")
    .single();

  const result = dbResult<CustomerSite>(data, error, "customer_site");
  if (result.ok) {
    await recordAudit({
      entityType: "customer_site",
      entityId: result.value.id,
      action: "create",
      after: result.value,
    });
  }
  return result;
}

export async function updateCustomerSite(
  input: z.input<typeof updateSiteSchema>,
): Promise<Result<CustomerSite>> {
  const parsed = parseInput(updateSiteSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("customer_sites")
    .select("*")
    .eq("id", parsed.value.id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  const { id, ...patch } = parsed.value;
  const geocoded = await maybeGeocode(patch);
  const { data, error } = await supabase
    .from("customer_sites")
    .update(geocoded)
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .select("*")
    .single();

  const result = dbResult<CustomerSite>(data, error, "customer_site");
  if (result.ok) {
    await recordAudit({
      entityType: "customer_site",
      entityId: result.value.id,
      action: "update",
      before,
      after: result.value,
    });
  }
  return result;
}

export async function deleteCustomerSite(id: string): Promise<Result<{ id: string }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("customer_sites")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  const { error } = await supabase
    .from("customer_sites")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);

  if (error) return dbResult<{ id: string }>(null, error, "customer_site");
  await recordAudit({
    entityType: "customer_site",
    entityId: id,
    action: "delete",
    before,
  });
  return { ok: true, value: { id } };
}

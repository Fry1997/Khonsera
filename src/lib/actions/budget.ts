"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";

// Budget / expenses depth (Phase 16). A per-trip spend cap with live used-vs-
// remaining + over-cap flag, receipt capture bound to the trip, and the trip's
// expense lines. RLS scopes rows to the workspace; the cap lives on the itinerary.

export type ExpenseLine = { id: string; type: string; amount: number | null; currency: string; notes: string | null; hasReceipt: boolean; receiptPath: string | null };
export type Budget = {
  cap: number | null;
  currency: string;
  spent: number;
  remaining: number | null;
  overBy: number; // >0 = over the cap
  lines: ExpenseLine[];
};

export async function loadBudget(itineraryId: string): Promise<Budget> {
  await requireUserContext();
  const supabase = await createClient();
  const [{ data: itin }, { data: rows }] = await Promise.all([
    supabase.from("itineraries").select("expense_cap, expense_cap_currency").eq("id", itineraryId).maybeSingle(),
    supabase.from("expense_records").select("id, type, amount, currency, notes, receipt_file_path").eq("itinerary_id", itineraryId).order("created_at", { ascending: false }),
  ]);
  const currency = (itin?.expense_cap_currency as string) ?? "GBP";
  const cap = itin?.expense_cap != null ? Number(itin.expense_cap) : null;
  const lines: ExpenseLine[] = ((rows ?? []) as { id: string; type: string; amount: number | null; currency: string; notes: string | null; receipt_file_path: string | null }[]).map((r) => ({
    id: r.id, type: r.type, amount: r.amount, currency: r.currency, notes: r.notes, hasReceipt: !!r.receipt_file_path, receiptPath: r.receipt_file_path,
  }));
  const spent = Math.round(lines.reduce((sum, l) => sum + (l.amount ?? 0), 0) * 100) / 100;
  const remaining = cap != null ? Math.round((cap - spent) * 100) / 100 : null;
  return { cap, currency, spent, remaining, overBy: cap != null && spent > cap ? Math.round((spent - cap) * 100) / 100 : 0, lines };
}

const capSchema = z.object({ itineraryId: z.string().uuid(), amount: z.number().min(0).max(1_000_000).nullable(), currency: z.string().length(3).default("GBP") });
export async function setItineraryCap(input: z.input<typeof capSchema>): Promise<{ ok: boolean; error?: string }> {
  const parsed = capSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid cap." };
  const { itineraryId, amount, currency } = parsed.data;
  await requireUserContext();
  const supabase = await createClient();
  const { error } = await supabase.from("itineraries").update({ expense_cap: amount, expense_cap_currency: currency }).eq("id", itineraryId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/plan/${itineraryId}`);
  return { ok: true };
}

const addSchema = z.object({
  itineraryId: z.string().uuid(),
  type: z.enum(["rail_ticket", "parking", "taxi", "hotel", "food", "other"]),
  amount: z.number().min(0).max(1_000_000),
  currency: z.string().length(3).default("GBP"),
  notes: z.string().trim().max(280).optional(),
});
export async function addTripExpense(input: z.input<typeof addSchema>): Promise<{ ok: boolean; error?: string }> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the amount and category." };
  const v = parsed.data;
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { error } = await supabase.from("expense_records").insert({
    itinerary_id: v.itineraryId, workspace_id: ctx.workspaceId, user_id: ctx.userId, type: v.type, amount: v.amount, currency: v.currency, notes: v.notes ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/plan/${v.itineraryId}`);
  return { ok: true };
}

// Receipt capture — upload to the private `receipts` bucket under the owner's
// folder, bind the path to the expense. (FormData file from the client.)
export async function attachReceipt(expenseId: string, itineraryId: string, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireUserContext();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file." };
  if (file.size > 8_000_000) return { ok: false, error: "Receipt too large (max 8MB)." };
  const supabase = await createClient();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${ctx.userId}/${expenseId}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("receipts").upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (upErr) return { ok: false, error: upErr.message };
  const { error } = await supabase.from("expense_records").update({ receipt_file_path: path }).eq("id", expenseId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/plan/${itineraryId}`);
  return { ok: true };
}

// A short-lived signed URL to view a receipt (private bucket).
export async function receiptViewUrl(path: string): Promise<string | null> {
  await requireUserContext();
  const supabase = await createClient();
  const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

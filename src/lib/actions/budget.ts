"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext, requireManager } from "@/lib/auth";

// Budget / expenses depth (Phase 16). A per-trip spend cap with live used-vs-
// remaining + over-cap flag, receipt capture bound to the trip, and the trip's
// expense lines. RLS scopes rows to the workspace; the cap lives on the itinerary.

export type ExpenseLine = { id: string; type: string; amount: number | null; currency: string; notes: string | null; hasReceipt: boolean; receiptPath: string | null };
// A per-CATEGORY cap (the way real T&E policy works), with the trip's spend in
// that category vs the effective cap (per-day caps × the trip's nights).
export type CapLine = { type: string; spent: number; cap: number; period: "per_day" | "per_trip"; currency: string; overBy: number };
export type Budget = {
  cap: number | null; // optional overall trip cap, alongside the per-category caps
  currency: string;
  spent: number;
  remaining: number | null;
  overBy: number; // >0 = over the overall cap
  caps: CapLine[]; // per-category, from the workspace travel policy
  lines: ExpenseLine[];
};

export async function loadBudget(itineraryId: string): Promise<Budget> {
  await requireUserContext();
  const supabase = await createClient();
  const [{ data: itin }, { data: rows }] = await Promise.all([
    supabase.from("itineraries").select("expense_cap, expense_cap_currency, workspace_id, date_start, date_end").eq("id", itineraryId).maybeSingle(),
    supabase.from("expense_records").select("id, type, amount, currency, notes, receipt_file_path").eq("itinerary_id", itineraryId).order("created_at", { ascending: false }),
  ]);
  const currency = (itin?.expense_cap_currency as string) ?? "GBP";
  const cap = itin?.expense_cap != null ? Number(itin.expense_cap) : null;
  const lines: ExpenseLine[] = ((rows ?? []) as { id: string; type: string; amount: number | null; currency: string; notes: string | null; receipt_file_path: string | null }[]).map((r) => ({
    id: r.id, type: r.type, amount: r.amount, currency: r.currency, notes: r.notes, hasReceipt: !!r.receipt_file_path, receiptPath: r.receipt_file_path,
  }));
  const spent = round2(lines.reduce((sum, l) => sum + (l.amount ?? 0), 0));
  const remaining = cap != null ? round2(cap - spent) : null;

  // Per-category caps from the workspace travel policy. A per-day cap scales by the
  // trip's nights so "£30 food per day" reads against the whole stay.
  const caps: CapLine[] = [];
  if (itin?.workspace_id) {
    const { data: policy } = await supabase.from("expense_caps").select("expense_type, period, amount, currency").eq("workspace_id", itin.workspace_id);
    const nights = Math.max(1, Math.round((new Date((itin.date_end as string) ?? "").getTime() - new Date((itin.date_start as string) ?? "").getTime()) / 86_400_000) || 1);
    const spentByType = new Map<string, number>();
    for (const l of lines) spentByType.set(l.type, (spentByType.get(l.type) ?? 0) + (l.amount ?? 0));
    for (const c of (policy ?? []) as { expense_type: string; period: "per_day" | "per_trip"; amount: number; currency: string }[]) {
      const effective = c.period === "per_day" ? Number(c.amount) * nights : Number(c.amount);
      const s = round2(spentByType.get(c.expense_type) ?? 0);
      caps.push({ type: c.expense_type, spent: s, cap: round2(effective), period: c.period, currency: c.currency ?? currency, overBy: s > effective ? round2(s - effective) : 0 });
    }
    caps.sort((a, b) => b.overBy - a.overBy || b.spent - a.spent);
  }

  return { cap, currency, spent, remaining, overBy: cap != null && spent > cap ? round2(spent - cap) : 0, caps, lines };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Workspace travel policy: per-category caps (manager-set) ──
export type PolicyCap = { type: string; period: "per_day" | "per_trip"; amount: number; currency: string };
export async function loadExpenseCaps(): Promise<PolicyCap[]> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data } = await supabase.from("expense_caps").select("expense_type, period, amount, currency").eq("workspace_id", ctx.workspaceId);
  return ((data ?? []) as { expense_type: string; period: "per_day" | "per_trip"; amount: number; currency: string }[]).map((c) => ({ type: c.expense_type, period: c.period, amount: Number(c.amount), currency: c.currency }));
}

const setCapSchema = z.object({
  type: z.enum(["rail_ticket", "parking", "taxi", "hotel", "food", "other"]),
  period: z.enum(["per_day", "per_trip"]),
  amount: z.number().min(0).max(100_000).nullable(), // null = remove
  currency: z.string().length(3).default("GBP"),
});
export async function setExpenseCap(input: z.input<typeof setCapSchema>): Promise<{ ok: boolean; error?: string }> {
  const parsed = setCapSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the cap." };
  const v = parsed.data;
  const ctx = await requireManager(); // the travel policy is a manager-only setting
  const supabase = await createClient();
  if (v.amount == null) {
    await supabase.from("expense_caps").delete().eq("workspace_id", ctx.workspaceId).eq("expense_type", v.type);
  } else {
    const { error } = await supabase.from("expense_caps").upsert(
      { workspace_id: ctx.workspaceId, expense_type: v.type, period: v.period, amount: v.amount, currency: v.currency },
      { onConflict: "workspace_id,expense_type" },
    );
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/workspace");
  return { ok: true };
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

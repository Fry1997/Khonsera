"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext, requireManager } from "@/lib/auth";

// Approvals (Phase 17) — over-cap / trip spend routes to a manager. RBAC-gated:
// only managers review; the privacy boundary holds (the queue is WORK-trip only,
// enforced by the tightened RLS AND filtered in-app — personal never surfaces).

// Traveller submits their trip's draft expenses for approval.
export async function submitTripForApproval(itineraryId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_records")
    .update({ reimbursement_status: "submitted" })
    .eq("itinerary_id", itineraryId)
    .eq("user_id", ctx.userId)
    .eq("reimbursement_status", "draft");
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/plan/${itineraryId}`);
  return { ok: true };
}

export type ApprovalItem = { id: string; traveller: string; tripTitle: string; amount: number | null; currency: string; type: string; notes: string | null };

// The manager's queue — submitted WORK-trip expenses across the workspace.
export async function loadApprovalsQueue(): Promise<ApprovalItem[]> {
  const ctx = await requireManager();
  const supabase = await createClient();
  const { data } = await supabase
    .from("expense_records")
    .select("id, amount, currency, type, notes, reimbursement_status, itinerary:itineraries(title, mode), traveller:profiles(full_name)")
    .eq("workspace_id", ctx.workspaceId)
    .eq("reimbursement_status", "submitted");
  type Row = { id: string; amount: number | null; currency: string; type: string; notes: string | null; itinerary: { title: string | null; mode: string } | null; traveller: { full_name: string | null } | null };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.itinerary?.mode === "work") // defence-in-depth: never personal
    .map((r) => ({ id: r.id, traveller: r.traveller?.full_name ?? "A traveller", tripTitle: r.itinerary?.title ?? "A trip", amount: r.amount, currency: r.currency, type: r.type, notes: r.notes }));
}

const reviewSchema = z.object({ id: z.string().uuid(), approve: z.boolean() });
export async function reviewExpense(input: z.input<typeof reviewSchema>): Promise<{ ok: boolean; error?: string }> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid review." };
  const ctx = await requireManager();
  const supabase = await createClient();
  // Scope to the manager's workspace + only a WORK-trip expense (never personal).
  const { data: row } = await supabase
    .from("expense_records")
    .select("id, itinerary:itineraries(mode)")
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  const mode = (row as unknown as { itinerary: { mode: string } | null } | null)?.itinerary?.mode;
  if (!row || mode !== "work") return { ok: false, error: "Not a reviewable work expense." };
  const { error } = await supabase
    .from("expense_records")
    .update({ reimbursement_status: parsed.data.approve ? "approved" : "rejected" })
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspaceId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/workspace");
  return { ok: true };
}

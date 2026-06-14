"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";

// Notes (Phase 3) — prep + outcome, bound to a commitment (stop) or a day.
// The org-review boundary lives in RLS (migration 0034): a workspace member only
// ever reads work + outcome + org_reviewable notes. These actions are owner-scoped
// for writes; reads come back already filtered by RLS.

export type NoteKind = "prep" | "outcome";
export type NoteVisibility = "private" | "org_reviewable";

export type NoteVM = {
  id: string;
  stopId: string | null;
  itineraryId: string | null;
  kind: NoteKind;
  title: string | null;
  body: string | null;
  visibility: NoteVisibility;
  createdAt: string;
};

const SELECT = "id, stop_id, itinerary_id, kind, title, body, visibility, created_at";

function toVM(r: Record<string, unknown>): NoteVM {
  return {
    id: r.id as string,
    stopId: (r.stop_id as string | null) ?? null,
    itineraryId: (r.itinerary_id as string | null) ?? null,
    kind: r.kind as NoteKind,
    title: (r.title as string | null) ?? null,
    body: (r.body as string | null) ?? null,
    visibility: r.visibility as NoteVisibility,
    createdAt: r.created_at as string,
  };
}

/** All notes for the given stops (RLS already scopes to what the viewer may see). */
export async function listNotesForStops(stopIds: string[]): Promise<NoteVM[]> {
  if (stopIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select(SELECT)
    .in("stop_id", stopIds)
    .order("created_at", { ascending: true });
  return (data ?? []).map(toVM);
}

const createSchema = z.object({
  itineraryId: z.string().uuid().nullable().optional(),
  stopId: z.string().uuid().nullable().optional(),
  kind: z.enum(["prep", "outcome"]),
  title: z.string().trim().max(200).nullable().optional(),
  body: z.string().trim().max(20000).nullable().optional(),
  visibility: z.enum(["private", "org_reviewable"]).default("private"),
});

export async function createNote(
  input: z.input<typeof createSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid note." };
  const v = parsed.data;
  if (!v.itineraryId && !v.stopId) return { ok: false, error: "A note must attach to a day or a commitment." };
  if (!v.title?.trim() && !v.body?.trim()) return { ok: false, error: "Write something first." };

  const ctx = await requireUserContext();
  const supabase = await createClient();
  // Personal notes can never be org-reviewable — the boundary, defended in app code too.
  const visibility = ctx.activeMode === "work" ? v.visibility : "private";
  const { error } = await supabase.from("notes").insert({
    user_id: ctx.userId,
    workspace_id: ctx.workspaceId,
    mode: ctx.activeMode,
    itinerary_id: v.itineraryId ?? null,
    stop_id: v.stopId ?? null,
    kind: v.kind,
    title: v.title?.trim() || null,
    body: v.body?.trim() || null,
    visibility,
  });
  if (error) return { ok: false, error: error.message };
  if (v.itineraryId) revalidatePath(`/plan/${v.itineraryId}`);
  return { ok: true };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().max(200).nullable().optional(),
  body: z.string().trim().max(20000).nullable().optional(),
  kind: z.enum(["prep", "outcome"]).optional(),
  visibility: z.enum(["private", "org_reviewable"]).optional(),
  itineraryId: z.string().uuid().nullable().optional(), // for revalidate only
});

export async function updateNote(
  input: z.input<typeof updateSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid note." };
  const v = parsed.data;
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (v.title !== undefined) patch.title = v.title?.trim() || null;
  if (v.body !== undefined) patch.body = v.body?.trim() || null;
  if (v.kind !== undefined) patch.kind = v.kind;
  if (v.visibility !== undefined) patch.visibility = ctx.activeMode === "work" ? v.visibility : "private";
  // RLS update policy already restricts to the owner.
  const { error } = await supabase.from("notes").update(patch).eq("id", v.id);
  if (error) return { ok: false, error: error.message };
  if (v.itineraryId) revalidatePath(`/plan/${v.itineraryId}`);
  return { ok: true };
}

export async function deleteNote(id: string, itineraryId?: string): Promise<{ ok: boolean; error?: string }> {
  await requireUserContext();
  const supabase = await createClient();
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (itineraryId) revalidatePath(`/plan/${itineraryId}`);
  return { ok: true };
}

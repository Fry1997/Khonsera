"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";

// Tasks (handover §4.9). Scoped to user + active mode; the RLS boundary
// (migration 0030) keeps personal-mode tasks out of any workspace view.

export type TaskRecord = {
  id: string;
  title: string;
  due_date: string | null;
  due_time: string | null;
  done: boolean;
};

export async function createTask(input: {
  title: string;
  dueDate?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "A task needs a title." };

  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    user_id: ctx.userId,
    workspace_id: ctx.workspaceId,
    mode: ctx.activeMode,
    title,
    due_date: input.dueDate || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/tasks");
  return { ok: true };
}

export async function setTaskDone(
  id: string,
  done: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ done }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tasks");
  return { ok: true };
}

export async function deleteTask(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  await supabase.from("tasks").delete().eq("id", id);
  revalidatePath("/tasks");
  return { ok: true };
}

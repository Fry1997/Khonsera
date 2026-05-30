"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { ok, type Result } from "@/lib/errors";

export type ContactHit = {
  id: string;
  name: string;
  role: string | null;
};

const schema = z.object({ query: z.string().trim().max(120) });

// Lightweight contact autocomplete for the capture screen's person-slot editor.
// Name prefix first, then substring; workspace-scoped (RLS also enforces).
export async function searchContacts(
  input: z.input<typeof schema>,
): Promise<Result<ContactHit[]>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return ok([]);
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const q = parsed.data.query;
  let query = supabase
    .from("contacts")
    .select("id, name, role")
    .eq("workspace_id", ctx.workspaceId)
    .order("name")
    .limit(8);
  if (q.length > 0) query = query.ilike("name", `${q}%`);

  const { data } = await query;
  let hits = (data ?? []) as ContactHit[];

  // Substring fallback when the prefix search is thin.
  if (q.length >= 2 && hits.length < 3) {
    const { data: more } = await supabase
      .from("contacts")
      .select("id, name, role")
      .eq("workspace_id", ctx.workspaceId)
      .ilike("name", `%${q}%`)
      .order("name")
      .limit(8);
    const seen = new Set(hits.map((h) => h.id));
    for (const row of (more ?? []) as ContactHit[]) {
      if (!seen.has(row.id)) hits.push(row);
    }
  }
  return ok(hits.slice(0, 8));
}

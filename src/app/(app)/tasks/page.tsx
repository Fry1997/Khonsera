import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { TasksScreen } from "@/components/tasks/tasks-screen";
import type { TaskVM } from "@/components/concierge";

// Tasks (handover §4.9). Mode-scoped; the privacy boundary keeps personal tasks
// out of any workspace view at the data layer (RLS, migration 0030).
export default async function TasksPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("tasks")
    .select("id, title, due_date, due_time, done")
    .eq("mode", ctx.activeMode)
    .order("done", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const tasks: TaskVM[] = (data ?? []).map((t) => ({
    id: t.id as string,
    title: t.title as string,
    due: (t.due_date as string | null) ?? undefined,
    done: t.done as boolean,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <header>
        <span className="eyebrow" style={{ color: "var(--gold-2)" }}>
          {ctx.activeMode === "work" ? "Work" : "Personal"} · Tasks
        </span>
        <h1 className="h1" style={{ marginTop: 6 }}>
          Things to do
        </h1>
        <p className="small" style={{ marginTop: 8, maxWidth: "56ch" }}>
          Anything with a date surfaces on that day&apos;s journey, so it&apos;s in
          front of you when it matters.
        </p>
      </header>

      <TasksScreen initial={tasks} />
    </div>
  );
}

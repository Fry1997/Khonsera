import { createClient } from "@/lib/supabase/server";
import { AppScreen } from "@/components/ui/page-shell";
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
    .select("id, title, due_date, due_time, done, mode")
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
    <AppScreen eyebrow="Tasks" title="Things to do">
      <TasksScreen initial={tasks} />
    </AppScreen>
  );
}

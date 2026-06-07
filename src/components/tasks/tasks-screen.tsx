"use client";

import { useState, useTransition } from "react";
import { TaskRow } from "@/components/concierge";
import type { TaskVM } from "@/components/concierge";
import { createTask, setTaskDone } from "@/lib/actions/tasks";

// Client surface for Tasks — composes the TaskRow contract component over a real
// CRUD loop (create + toggle) against the mode-scoped tasks table.
export function TasksScreen({ initial }: { initial: TaskVM[] }) {
  const [tasks, setTasks] = useState<TaskVM[]>(initial);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const res = await createTask({ title: trimmed });
      if (!res.ok) {
        setError(res.error ?? "Could not add that.");
        return;
      }
      // Optimistic-ish: the server revalidate will refresh, but reflect now.
      setTasks((t) => [
        ...t,
        { id: `tmp-${Date.now()}`, title: trimmed, done: false },
      ]);
      setTitle("");
    });
  }

  function toggle(id: string, done: boolean) {
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, done } : x)));
    startTransition(() => {
      void setTaskDone(id, done);
    });
  }

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div className="row flex items-center gap-2">
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Add a task — Khonsera will surface it on the day"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
        />
        <button
          type="button"
          className="btn btn-gold"
          onClick={add}
          disabled={pending || !title.trim()}
        >
          Add
        </button>
      </div>
      {error ? (
        <p className="small" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      ) : null}

      {open.length === 0 && done.length === 0 ? (
        <div className="j-card p-6" style={{ textAlign: "center" }}>
          <p className="small">
            Nothing on your list. Add a task and it lands on the right day.
          </p>
        </div>
      ) : (
        <>
          <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {open.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={toggle} />
            ))}
          </section>

          {done.length > 0 ? (
            <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <div className="desk-flank">
                <span>Done · {done.length}</span>
              </div>
              {done.map((t) => (
                <TaskRow key={t.id} task={t} onToggle={toggle} />
              ))}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

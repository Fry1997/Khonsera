"use client";

import { useState, useTransition } from "react";
import { TaskRow } from "@/components/concierge";
import type { TaskVM } from "@/components/concierge";
import { createTask, setTaskDone } from "@/lib/actions/tasks";
import { EmptyStateActions } from "@/components/ui/empty-state-actions";

// Tasks — Design Round 2 secondary template (.cc-section / .cc-empty / .cc-add +
// the .cc-task-row contract component) in a real CRUD loop.
export function TasksScreen({ initial }: { initial: TaskVM[] }) {
  const [tasks, setTasks] = useState<TaskVM[]>(initial);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    const t = title.trim();
    if (!t) return;
    startTransition(async () => {
      const res = await createTask({ title: t });
      if (res.ok) {
        setTasks((x) => [...x, { id: `tmp-${Date.now()}`, title: t, done: false }]);
        setTitle("");
      }
    });
  }
  function toggle(id: string, done: boolean) {
    setTasks((x) => x.map((t) => (t.id === id ? { ...t, done } : t)));
    startTransition(() => {
      void setTaskDone(id, done);
    });
  }

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <label className="cc-add">
        <span className="ic" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add a task — surfaces on the day"
          style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 15, color: "var(--ink)" }}
          disabled={pending}
        />
      </label>

      {open.length === 0 && done.length === 0 ? (
        <EmptyStateActions
          title="Nothing on your list"
          description="Add a task and it lands on the right day."
          image={false}
        />
      ) : (
        <>
          <section className="cc-section">
            <div className="cc-section-head"><span className="cc-section-title">To do · {open.length}</span></div>
            {open.map((t) => <TaskRow key={t.id} task={t} onToggle={toggle} />)}
          </section>
          {done.length > 0 ? (
            <section className="cc-section">
              <div className="cc-section-head"><span className="cc-section-title">Done · {done.length}</span></div>
              {done.map((t) => <TaskRow key={t.id} task={t} onToggle={toggle} />)}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

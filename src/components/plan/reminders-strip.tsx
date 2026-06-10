"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dismissReminder, type Reminder } from "@/lib/actions/reminders";

// The Reminders strip on the Plan index — dateless "deal with later" notes
// (proposal §4). Calm, dismissible; not a day, not a task.
export function RemindersStrip({ initial }: { initial: Reminder[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);

  if (items.length === 0) return null;

  function dismiss(id: string) {
    setItems((xs) => xs.filter((x) => x.id !== id));
    void dismissReminder(id).then(() => router.refresh());
  }

  return (
    <section className="cc-reminders">
      <div className="cc-plan-group-head">Reminders</div>
      <div className="cc-reminders-list">
        {items.map((r) => (
          <div key={r.id} className="cc-reminder">
            <span className="cc-reminder-label">{r.label}</span>
            <button
              type="button"
              className="cc-reminder-dismiss"
              aria-label="Dismiss reminder"
              onClick={() => dismiss(r.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { createEvent } from "@/lib/actions/events";

// Start a new Event from any "plan a day" entry point (proposal §3a; unified
// 2026-06-15). Needs a start date (the hinge) + an optional name; opens straight
// into the Event detail (/plan/[id]) — the blank plan IS the intake now (the old
// Brief form is retired). Single-day by default — a bounding fact (return travel)
// extends the span later (§5). The trigger is themeable so this same flow backs
// every "Plan a day"/"Plan something" button (Today, Plan, sidebar, mobile).

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PlanCreate({
  label = "Plan something",
  className = "cc-btn cc-btn-gold cc-plan-new",
  title,
  children,
}: {
  label?: string;
  className?: string;
  title?: string; // for an icon-only trigger
  children?: React.ReactNode; // override the trigger's inner content (e.g. an icon)
} = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayYMD());
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function start() {
    if (!date) {
      setError("Pick a start date.");
      return;
    }
    setPending(true);
    setError(null);
    void createEvent({ dateStart: date, name }).then((res) => {
      setPending(false);
      if (!res.ok || !res.id) {
        setError(res.error ?? "Couldn't start that.");
        return;
      }
      router.push(`/plan/${res.id}` as Route);
    });
  }

  return (
    <>
      {children ? (
        <button type="button" className={className} title={title ?? label} aria-label={title ?? label} onClick={() => setOpen(true)}>
          {children}
        </button>
      ) : (
        <button type="button" className={className} onClick={() => setOpen(true)}>
          <span aria-hidden>+</span> {label}
        </button>
      )}

      {open ? (
        <div className="cc-sheet-scrim" onClick={() => setOpen(false)}>
          <div className="cc-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
            <div className="cc-sheet-grip" />
            <header className="cc-sheet-head">
              <span className="cc-eyebrow">A new day or trip</span>
              <h3 className="cc-sheet-title">When does it start?</h3>
            </header>

            <label className="cc-time-field">
              <span className="cc-var-label">Start date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>

            <label className="cc-time-field">
              <span className="cc-var-label">Name (optional)</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Khonsera will name it from the first place"
              />
            </label>

            {error ? <p className="cc-sheet-error">{error}</p> : null}

            <div className="cc-sheet-actions">
              <button type="button" className="cc-btn cc-btn-ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </button>
              <button type="button" className="cc-btn cc-btn-gold" onClick={start} disabled={pending}>
                {pending ? "Starting…" : "Start"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { createEvent } from "@/lib/actions/events";

// Start a new Event from the Plan index (proposal §3a). Needs a start date (the
// hinge) + an optional name; opens straight into the Event detail. Single-day by
// default — a bounding fact (return travel) extends the span later (§5).

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PlanCreate() {
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
      <button type="button" className="cc-btn cc-btn-gold cc-plan-new" onClick={() => setOpen(true)}>
        <span aria-hidden>+</span> Plan something
      </button>

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

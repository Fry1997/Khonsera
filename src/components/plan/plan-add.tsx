"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addManualAnchor } from "@/lib/actions/plan-edit";
import { wallClockToIso } from "@/lib/time-zone";

// Manual structured add (planner master brief §4.2) — the precise / fallback
// capture door. Choose a fact type, fill structured fields; it lands on the
// spine by time, identical to a parsed fact. The reliable floor under NLP.

type Kind = "appointment" | "place";

export function PlanAdd({ journeyId, journeyDate }: { journeyId: string; journeyDate: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("appointment");
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [hours, setHours] = useState(1);
  const [mins, setMins] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function reset() {
    setTitle("");
    setTime("");
    setHours(1);
    setMins(0);
    setError(null);
  }

  function save() {
    if (!title.trim()) {
      setError("Give it a name.");
      return;
    }
    setPending(true);
    setError(null);
    const iso = time ? wallClockToIso(journeyDate, time) || null : null;
    const durationMinutes = hours * 60 + mins || null;
    void addManualAnchor({ itineraryId: journeyId, kind, title: title.trim(), iso, durationMinutes }).then(
      (res) => {
        setPending(false);
        if (!res.ok) {
          setError(res.error ?? "Couldn't add that.");
          return;
        }
        setOpen(false);
        reset();
        router.refresh();
      },
    );
  }

  return (
    <>
      <button type="button" className="cc-add-trigger" onClick={() => setOpen(true)}>
        <span aria-hidden>+</span> Add a fact
      </button>

      {open ? (
        <div className="cc-sheet-scrim" onClick={() => setOpen(false)}>
          <div className="cc-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
            <div className="cc-sheet-grip" />
            <header className="cc-sheet-head">
              <span className="cc-eyebrow">Add to the plan</span>
              <h3 className="cc-sheet-title">A new fact</h3>
            </header>

            <div className="cc-kind-row">
              <button type="button" className="cc-kind-chip" data-active={kind === "appointment" ? "" : undefined}
                onClick={() => setKind("appointment")}>
                Appointment
              </button>
              <button type="button" className="cc-kind-chip" data-active={kind === "place" ? "" : undefined}
                onClick={() => setKind("place")}>
                Place
              </button>
            </div>

            <label className="cc-time-field">
              <span className="cc-var-label">{kind === "appointment" ? "What" : "Where"}</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={kind === "appointment" ? "Client meeting" : "The Gallery"}
                autoFocus
              />
            </label>

            <div className="cc-dur-row">
              <label>
                <span className="cc-var-label">{kind === "appointment" ? "Arrive by" : "Around"}</span>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </label>
              <label>
                <span className="cc-var-label">For (h)</span>
                <input type="number" min={0} max={23} value={hours}
                  onChange={(e) => setHours(clamp(+e.target.value, 0, 23))} />
              </label>
              <label>
                <span className="cc-var-label">m</span>
                <input type="number" min={0} max={59} step={5} value={mins}
                  onChange={(e) => setMins(clamp(+e.target.value, 0, 59))} />
              </label>
            </div>

            {error ? <p className="cc-sheet-error">{error}</p> : null}

            <div className="cc-sheet-actions">
              <button type="button" className="cc-btn cc-btn-ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </button>
              <button type="button" className="cc-btn cc-btn-gold" onClick={save} disabled={pending}>
                {pending ? "Adding…" : "Add it"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Number.isNaN(n) ? lo : Math.min(hi, Math.max(lo, n));
}

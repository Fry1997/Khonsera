"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { captureToEvent } from "@/lib/actions/plan-capture";

// The Event's always-reachable plain-language input (`.cc-capture`). Type a fact
// → it APPENDS to this Event, by time (proposal §4). Scoped to the Event in view
// via `eventId` — never creates a stray new journey.
export function PlanCapture({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const t = text.trim();
    if (!t) return;
    setError(null);
    setNote(null);
    startTransition(async () => {
      const res = await captureToEvent(eventId, t);
      if (!res.ok) {
        setError(res.error ?? "Couldn't add that.");
        return;
      }
      setText("");
      setNote(res.note ?? null);
      router.refresh();
    });
  }

  return (
    <div className="cc-capture">
      <div className="cc-capture-field">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Tell Khonsera — “meeting at 9:30”, “lunch at 1”"
          disabled={pending}
          aria-label="Add a fact to this day"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || !text.trim()}
          className="cc-mono"
          style={{ color: "var(--gold-2)", fontSize: 11, background: "none", border: 0, cursor: "pointer", letterSpacing: "0.1em" }}
        >
          {pending ? "…" : "ADD"}
        </button>
      </div>
      {error ? (
        <p className="cc-capture-hint" style={{ color: "var(--danger)" }}>{error}</p>
      ) : note ? (
        <p className="cc-capture-hint" style={{ color: "var(--gold-2)" }}>{note}</p>
      ) : (
        <p className="cc-capture-hint">A meeting, a place, a time — in any order. I&apos;ll thread it onto this day.</p>
      )}
    </div>
  );
}

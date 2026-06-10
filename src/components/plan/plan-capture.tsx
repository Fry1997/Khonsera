"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { captureOnPlan } from "@/lib/actions/plan-capture";

// The Planner's always-reachable plain-language input (`.cc-capture`). Type a
// fact → it lands on the spine. (Planner parity, slice 1.)
export function PlanCapture() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const t = text.trim();
    if (!t) return;
    setError(null);
    startTransition(async () => {
      const res = await captureOnPlan(t);
      if (!res.ok) {
        setError(res.error ?? "Couldn't add that.");
        return;
      }
      setText("");
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
          placeholder="Tell Khonsera — “London on the 18th, meeting at 9:30”"
          disabled={pending}
          aria-label="Add a fact"
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
      ) : (
        <p className="cc-capture-hint">A train, a meeting, a place — in any order. I&apos;ll thread it.</p>
      )}
    </div>
  );
}

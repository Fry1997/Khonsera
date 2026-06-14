"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NudgeCard } from "@/components/concierge";
import { setNudgeVerdict, type NudgeVM } from "@/lib/actions/context";

// The care layer on the plan (Phase 12). Renders the live contextual nudges —
// weather-leave-earlier, running-late-expedite — each confirmable or dismissible.
// Accepted ones show a quiet "done" line (the action was applied through its
// seam: a prep note, a fast-track voucher); they don't disappear, so the day
// remembers the decision. Nothing here is alarm — calm caution that carries
// consequence. Design owns the final skin (`.cc-nudges` / `.cc-nudge-done`).
export function PlanNudges({ itineraryId, nudges }: { itineraryId: string; nudges: NudgeVM[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  if (!nudges.length) return null;

  function act(n: NudgeVM, verdict: "accepted" | "dismissed") {
    setBusyKey(n.key);
    startTransition(async () => {
      await setNudgeVerdict({ itineraryId, nudgeKey: n.key, verdict, action: n.action });
      setBusyKey(null);
      router.refresh();
    });
  }

  return (
    <section className="cc-nudges" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {nudges.map((n) =>
        n.verdict === "accepted" ? (
          <div
            key={n.key}
            className="cc-nudge-done"
            data-rule={n.rule}
            style={{ padding: "var(--space-3) var(--space-4)", borderRadius: "var(--radius-lg, 12px)", border: "1px solid var(--rule)", background: "var(--card)" }}
          >
            <span className="cc-nudge-done-mark" style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-micro, 11px)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--sage, var(--gold-2))" }}>
              Done
            </span>
            <p style={{ margin: "var(--space-1) 0 0", color: "var(--ink)" }}>{doneLabel(n)}</p>
          </div>
        ) : (
          <NudgeCard
            key={n.key}
            message={n.message}
            actionLabel={busyKey === n.key && pending ? "Working…" : n.actionLabel}
            onAction={() => act(n, "accepted")}
            onDismiss={() => act(n, "dismissed")}
          />
        ),
      )}
    </section>
  );
}

function doneLabel(n: NudgeVM): string {
  switch (n.action?.kind) {
    case "leave-earlier":
      return `Noted — leaving ${n.action.minutes} minutes earlier. It's on your prep.`;
    case "expedite-security":
      return `Fast-track sorted for ${n.action.airport}. The voucher's on your prep notes.`;
    case "book-lounge":
      return `Lounge booked at ${n.action.airport}. The pass is on your prep notes.`;
    case "prebook-parking":
      return `Space reserved at ${n.action.site}. The booking's on your prep notes.`;
    case "gate-reroute":
      return `Noted — gate ${n.action.toGate}. The walk's on your prep notes.`;
    default:
      return "Done.";
  }
}

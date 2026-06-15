"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setNudgeVerdict, type NudgeVM } from "@/lib/actions/context";

// The care layer on the plan (Phase 12–13). The live contextual nudges — six
// rules through two states. Round 8 skin (`khonsera-edition-iii-care.css`) owns
// the look via `.cc-nudge*` contract classes; the only behavioural hook is
// `data-urgency="now"` (gate-change → reaction). No inline styles (they'd override
// the stylesheet). Foresight is unhurried; reaction carries a touch more weight;
// an accepted nudge settles into a quiet confirmation, never vanishing.
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
    <section className="cc-nudges">
      {nudges.map((n) => {
        if (n.verdict === "accepted") {
          const tail = doneTail(n);
          return (
            <div key={n.key} className="cc-nudge-done" data-rule={ruleSlug(n.rule)}>
              <span className="cc-nudge-done-mark" aria-hidden />
              <div>
                <p className="cc-nudge-done-text">{doneText(n)}</p>
                {tail ? <p className="cc-nudge-done-tail">{tail}</p> : null}
              </div>
            </div>
          );
        }
        const busy = busyKey === n.key && pending;
        const reaction = n.urgency === "now";
        return (
          <div key={n.key} className="cc-nudge" data-urgency={reaction ? "now" : undefined} data-rule={ruleSlug(n.rule)}>
            <div className="cc-nudge-foresight">{reaction ? "Now" : "Looking ahead"}{n.sample ? <span className="cc-nudge-sample"> · sample</span> : null}</div>
            <p className="cc-nudge-msg">{n.message}</p>
            <div className="cc-nudge-actions">
              <button type="button" className="cc-btn-gold" data-busy={busy ? "" : undefined} disabled={busy} onClick={() => act(n, "accepted")}>
                {busy ? "Working…" : n.actionLabel}
              </button>
              <button type="button" className="cc-btn-quiet" onClick={() => act(n, "dismissed")}>
                Not now
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}

// Design's data-rule slug set — copy-only (no per-rule style), so a clean label.
function ruleSlug(rule: string): string {
  if (rule.includes("weather")) return "weather";
  if (rule.includes("expedite")) return "fasttrack";
  if (rule.includes("lounge")) return "lounge";
  if (rule.includes("parking")) return "parking";
  if (rule.includes("gate")) return "gate";
  return "care";
}

// The accepted confirmation — a key noun in <strong>, the rest in ink-2.
function doneText(n: NudgeVM) {
  switch (n.action?.kind) {
    case "leave-earlier":
      return <><strong>Leaving {n.action.minutes} min earlier</strong> — it&rsquo;s on your prep.</>;
    case "expedite-security":
      return <><strong>Fast-track sorted</strong> for {n.action.airport}. The voucher&rsquo;s on your prep notes.</>;
    case "book-lounge":
      return <><strong>Lounge booked</strong> at {n.action.airport}. The pass is on your prep notes.</>;
    case "prebook-parking":
      return <><strong>Space reserved</strong> at {n.action.site}. The booking&rsquo;s on your prep notes.</>;
    case "gate-reroute":
      return <><strong>Gate {n.action.toGate}</strong> — the walk&rsquo;s on your prep notes.</>;
    default:
      return "Done.";
  }
}

// The settled, even-quieter tail — the booking reference when there is one.
function doneTail(n: NudgeVM): string | null {
  const r = n.actionResult as { reference?: string } | undefined;
  return r?.reference ? `Ref ${r.reference}` : null;
}

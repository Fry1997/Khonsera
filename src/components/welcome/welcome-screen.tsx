"use client";

import { useState, useTransition } from "react";
import type { Mode } from "@/components/concierge";
import { chooseAndContinue } from "@/lib/actions/welcome";

// First-run (§3) — the highest-priority minute. Khonsera introduces itself, then
// offers an HONEST FORK (not a wizard): something coming up, or find me later.
// Voiced entirely as Khonsera; no emojis. Placeholder visuals, restyled later.

type Step = "intro" | "booked";

export function WelcomeScreen({ mode }: { mode: Mode }) {
  const [step, setStep] = useState<Step>("intro");
  const [pending, startTransition] = useTransition();

  function go(target: string) {
    startTransition(() => chooseAndContinue(target));
  }

  return (
    <main
      className="paper-tex"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "var(--paper)",
        padding: "var(--space-6) var(--space-4)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        <span className="eyebrow" style={{ color: "var(--gold-2)" }}>
          {mode === "work" ? "Work" : "Personal"}
        </span>

        {step === "intro" ? (
          <>
            <h1 className="h1" style={{ marginTop: "var(--space-2)" }}>
              I&apos;m Khonsera.
            </h1>
            <p
              className="serif-i"
              style={{
                fontSize: 18,
                color: "var(--ink-2)",
                margin: "var(--space-3) 0 var(--space-5)",
                lineHeight: 1.55,
              }}
            >
              I&apos;m here to make sure your days run smoothly — help you plan
              ahead, tie everything together, and make sure you&apos;ve got
              everything you need.
            </p>

            <p className="text-ink" style={{ marginBottom: "var(--space-3)" }}>
              Anything you need right now — an upcoming trip or event I should look
              after? Or shall I find you when you need me?
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <button
                type="button"
                className="btn btn-gold btn-lg btn-full"
                onClick={() => setStep("booked")}
                disabled={pending}
              >
                Something&apos;s coming up
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-full"
                onClick={() => go("/today")}
                disabled={pending}
              >
                Find me later
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="h1" style={{ marginTop: "var(--space-2)" }}>
              Is it booked — in part or full?
            </h1>
            <p
              className="serif-i"
              style={{
                fontSize: 17,
                color: "var(--ink-2)",
                margin: "var(--space-3) 0 var(--space-5)",
                lineHeight: 1.55,
              }}
            >
              However much you know, I&apos;ll take it from there and fill in the
              rest.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <button
                type="button"
                className="btn btn-gold btn-lg btn-full"
                onClick={() => go("/settings")}
                disabled={pending}
              >
                Booked — and it&apos;s in my inbox
              </button>
              <button
                type="button"
                className="btn btn-ink btn-full"
                onClick={() => go("/capture")}
                disabled={pending}
              >
                Tell you in my own words
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-full"
                onClick={() => go("/itineraries/new")}
                disabled={pending}
              >
                Fill it in field by field
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-full"
                onClick={() => setStep("intro")}
                disabled={pending}
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

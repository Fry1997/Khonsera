"use client";

import { useState, useTransition } from "react";
import type { Mode } from "@/components/concierge";
import { chooseAndContinue } from "@/lib/actions/welcome";

// First-run (§3) — Design Round 2 (`.cc-welcome`). Chromeless: emblem, a warm
// Satoshi self-intro (one Spectral-gold word), then the honest fork.

const Chevron = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export function WelcomeScreen({ mode }: { mode: Mode }) {
  const [step, setStep] = useState<"intro" | "booked">("intro");
  const [pending, startTransition] = useTransition();
  const go = (target: string) => startTransition(() => chooseAndContinue(target));

  return (
    <main className="cc-welcome" style={{ minHeight: "100dvh" }}>
      <div style={{ width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cc-welcome-emblem" src="/brand/mk-ink.png" alt="" />

        {step === "intro" ? (
          <>
            <h1 className="cc-welcome-intro">
              I&apos;m Khonsera. I&apos;ll make sure your days <em>run smoothly</em> —
              plan ahead, tie it together, see you have what you need.
            </h1>
            <div className="cc-welcome-fork">
              <button type="button" className="cc-fork-option" data-primary="true" disabled={pending} onClick={() => setStep("booked")}>
                <div>
                  <span className="t">Something&apos;s coming up</span>
                  <span className="s">A trip or event I should look after.</span>
                </div>
                <span className="ic"><Chevron /></span>
              </button>
              <button type="button" className="cc-fork-option" disabled={pending} onClick={() => go("/today")}>
                <div>
                  <span className="t">Find me later</span>
                  <span className="s">I&apos;ll be here when you need me.</span>
                </div>
                <span className="ic"><Chevron /></span>
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="cc-welcome-intro">
              Is it <em>booked</em> — in part or full? However much you know, I&apos;ll take it from there.
            </h1>
            <div className="cc-welcome-fork">
              <button type="button" className="cc-fork-option" data-primary="true" disabled={pending} onClick={() => go("/settings")}>
                <div>
                  <span className="t">It&apos;s booked — in my inbox</span>
                  <span className="s">Connect your email; I&apos;ll find the confirmations and build the cards.</span>
                </div>
                <span className="ic"><Chevron /></span>
              </button>
              <button type="button" className="cc-fork-option" disabled={pending} onClick={() => go("/itineraries/new")}>
                <div>
                  <span className="t">I&apos;ll add it by hand</span>
                  <span className="s">Enter the trains, stays and meetings yourself.</span>
                </div>
                <span className="ic"><Chevron /></span>
              </button>
            </div>
            <button type="button" className="cc-btn cc-btn-ghost" disabled={pending} onClick={() => setStep("intro")} style={{ alignSelf: "flex-start" }}>
              Back
            </button>
          </>
        )}
      </div>
    </main>
  );
}

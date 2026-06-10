"use client";

import { useState, useTransition } from "react";
import { joinWaitlist } from "@/lib/actions/waitlist";
import type { WaitlistResult } from "@/lib/waitlist-shared";

// Landing+waitlist brief §6 — single email + "Join the waitlist". On submit the
// form morphs INLINE to the joined state (no reload). Honeypot, no captcha.
// Round 3 (Design): the morph settles, never pops — the form sinks out
// (data-leaving, ~200ms), the joined block rises in (data-enter, ~360ms); the
// CSS gates both on prefers-reduced-motion → straight cross-fade.

type View = "form" | "joined" | "already";

// Matches the form sink-out duration in khonsera-edition-ii-landing.css.
const SINK_MS = 200;

export function WaitlistForm({
  source,
  initialJoined = false,
}: {
  source?: string;
  initialJoined?: boolean;
}) {
  const [view, setView] = useState<View>(initialJoined ? "joined" : "form");
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (view !== "form") {
    return <JoinedState already={view === "already"} />;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res: WaitlistResult = await joinWaitlist(formData);
      if (res.status === "invalid") {
        setError(res.message);
        return;
      }
      // Success: play the sink-out, then swap to the joined block (which rises in).
      const next: View = res.status === "already" ? "already" : "joined";
      setLeaving(true);
      setTimeout(() => setView(next), SINK_MS);
    });
  }

  return (
    <form
      className="cc-wl-form"
      onSubmit={onSubmit}
      noValidate
      data-leaving={leaving ? "" : undefined}
    >
      {source ? <input type="hidden" name="source" value={source} /> : null}

      <div className="cc-wl-row">
        <input
          type="email"
          name="email"
          className="cc-wl-input"
          placeholder="you@example.com"
          autoComplete="email"
          required
          aria-label="Email address"
          aria-invalid={error ? true : undefined}
          disabled={pending || leaving}
        />
        <button
          type="submit"
          className="cc-btn cc-btn-gold cc-wl-submit"
          disabled={pending || leaving}
        >
          {pending ? "Joining…" : "Join the waitlist"}
        </button>
      </div>

      {error ? (
        <div className="cc-wl-error">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
          {error}
        </div>
      ) : (
        <div className="cc-wl-note">One email. No noise. Leave whenever you like.</div>
      )}

      {/* Honeypot — visually hidden, off the tab order. Bots fill it; humans don't. */}
      <div className="cc-wl-trap" aria-hidden>
        <input type="text" name="company" tabIndex={-1} autoComplete="off" />
      </div>
    </form>
  );
}

function JoinedState({ already }: { already: boolean }) {
  return (
    <div className="cc-wl-joined" role="status" data-enter="">
      <span className="cc-wl-joined-check" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <div>
        <p className="cc-wl-joined-h">
          {already ? "You're already on the list." : "You're on the list."}
        </p>
        <p className="cc-wl-joined-sub">
          {already
            ? "We have your place. We'll be in touch when it opens."
            : "We'll write when your place is ready — nothing before."}
        </p>
      </div>
    </div>
  );
}

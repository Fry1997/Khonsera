"use client";

import { useState, useTransition } from "react";
import { joinWaitlist } from "@/lib/actions/waitlist";
import type { WaitlistResult } from "@/lib/waitlist-shared";

// Landing+waitlist brief §6 — single email + "Join the waitlist". On submit the
// form morphs INLINE to the joined state (no reload). Honeypot, no captcha.
// Code-authored on Edition II tokens; a prime Design elevation candidate (§9).

type View = "form" | "joined" | "already";

export function WaitlistForm({
  source,
  initialJoined = false,
}: {
  source?: string;
  initialJoined?: boolean;
}) {
  const [view, setView] = useState<View>(initialJoined ? "joined" : "form");
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
      if (res.status === "joined") setView("joined");
      else if (res.status === "already") setView("already");
      else setError(res.message);
    });
  }

  return (
    <form className="cc-wl-form" onSubmit={onSubmit} noValidate>
      {source ? <input type="hidden" name="source" value={source} /> : null}
      {/* Honeypot — visually hidden, off the tab order. Bots fill it; humans don't. */}
      <div className="cc-wl-trap" aria-hidden>
        <label>
          Company
          <input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>

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
          disabled={pending}
        />
        <button
          type="submit"
          className="cc-btn cc-btn-gold cc-wl-submit"
          disabled={pending}
        >
          {pending ? "Joining…" : "Join the waitlist"}
        </button>
      </div>
      {error ? <p className="cc-wl-error">{error}</p> : null}
    </form>
  );
}

function JoinedState({ already }: { already: boolean }) {
  return (
    <div className="cc-wl-joined" role="status">
      <span className="cc-wl-joined-mark" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <p className="cc-wl-joined-lead">
        {already ? "You're already on the list." : "You're on the list."}
      </p>
      <p className="cc-wl-joined-sub">
        We&apos;ll be in touch the moment Khonsera opens its doors. Until then,
        safe travels.
      </p>
    </div>
  );
}

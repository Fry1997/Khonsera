"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PlanCreate } from "@/components/plan/plan-create";
import type { OnboardingChecklistState } from "@/lib/onboarding";

type Props = {
  state: OnboardingChecklistState;
  context?: "welcome" | "plan-empty";
};

const DISMISS_KEY = "khonsera_onboarding_checklist_dismissed";

export function OnboardingChecklist({ state, context = "welcome" }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const canDismiss = state.hasItinerary;

  useEffect(() => {
    if (!canDismiss) return;
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
  }, [canDismiss]);

  const items = useMemo(
    () => [
      {
        key: "profile",
        done: state.travelProfileBaseSet,
        title: "Set your travel base",
        detail: "Tell Khonsera where journeys usually start and return.",
        action: <Link href="/settings#travel-profile" className="cc-btn cc-btn-ghost">Set base</Link>,
      },
      {
        key: "calendar",
        done: state.calendarConnected,
        title: "Connect Google Calendar",
        detail: "Bring in meetings and avoid conflicts when planning.",
        action: <Link href="/settings#calendar" className="cc-btn cc-btn-ghost">Connect calendar</Link>,
      },
      {
        key: "gmail",
        done: state.gmailConnected,
        title: "Connect Gmail",
        detail: "Scan booking confirmations and tickets when you plan.",
        action: <Link href="/settings#gmail" className="cc-btn cc-btn-ghost">Connect Gmail</Link>,
      },
      {
        key: "itinerary",
        done: state.hasItinerary,
        title: "Create or import your first plan",
        detail: "Start a day by hand, then add bookings from email or calendar.",
        action: context === "plan-empty" ? (
          <PlanCreate label="Create first plan" className="cc-btn cc-btn-gold" />
        ) : (
          <Link href="/plan" className="cc-btn cc-btn-gold">Open Plan</Link>
        ),
      },
    ],
    [context, state.calendarConnected, state.gmailConnected, state.hasItinerary, state.travelProfileBaseSet],
  );

  const completeCount = items.filter((item) => item.done).length;

  if (dismissed && canDismiss) return null;

  return (
    <section className="j-card p-5" aria-labelledby="onboarding-checklist-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="cc-eyebrow">Getting started</span>
          <h2 id="onboarding-checklist-title" className="h3 mt-1">Your Khonsera setup</h2>
          <p className="small mt-1">{completeCount} of {items.length} complete. Finish the essentials now, or come back later.</p>
        </div>
        {canDismiss ? (
          <button
            type="button"
            className="cc-btn cc-btn-ghost"
            onClick={() => {
              window.localStorage.setItem(DISMISS_KEY, "1");
              setDismissed(true);
            }}
          >
            Dismiss
          </button>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white/50 p-3">
            <div className="flex items-start gap-3">
              <span aria-hidden className={item.done ? "text-sage" : "text-terra"}>{item.done ? "✓" : "○"}</span>
              <div>
                <p className="font-medium text-ink">{item.title}</p>
                <p className="small">{item.detail}</p>
              </div>
            </div>
            {item.done ? <span className="tiny text-sage">Done</span> : item.action}
          </div>
        ))}
      </div>
    </section>
  );
}

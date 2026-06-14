"use client";

import { useTransition } from "react";
import { setItineraryMode } from "@/lib/actions/plan-edit";

// In-context flip for a day's work/personal tag (Edition III D1). Two quiet
// segments; choosing the other re-tags the whole day. The privacy boundary is
// enforced in the data layer — flipping to personal hides the day upward.
export function PlanModeFlip({ itineraryId, mode }: { itineraryId: string; mode: "work" | "personal" }) {
  const [pending, start] = useTransition();
  const set = (m: "work" | "personal") => {
    if (m === mode || pending) return;
    start(() => void setItineraryMode(itineraryId, m));
  };
  return (
    <div className="cc-mode-flip" role="group" aria-label="Work or personal" data-pending={pending ? "true" : "false"}>
      {(["work", "personal"] as const).map((m) => (
        <button
          key={m}
          type="button"
          className="cc-mode-flip-seg"
          data-active={m === mode ? "true" : "false"}
          onClick={() => set(m)}
        >
          {m === "work" ? "Work" : "Personal"}
        </button>
      ))}
    </div>
  );
}

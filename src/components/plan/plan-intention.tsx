"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDayIntention } from "@/lib/actions/plan-edit";

// The day's INTENTION — "what's this day for" (plan elevation 2026-06-15). Makes
// the core Intention entity real (the IntentionCard read it but nothing wrote it).
// An inline, optional line: a quiet invite when empty, the stated purpose when set,
// tap to edit. Writes via setDayIntention (clears when blanked).
export function PlanIntention({ itineraryId, initial }: { itineraryId: string; initial: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial ?? "");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    const next = value.trim();
    setEditing(false);
    if ((initial ?? "") === next) return;
    startTransition(async () => {
      await setDayIntention({ itineraryId, description: next });
      router.refresh();
    });
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="cc-plan-intention-input"
        value={value}
        placeholder="What's this day for? e.g. close the Derby deal"
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setValue(initial ?? ""); setEditing(false); }
        }}
        disabled={pending}
        aria-label="The day's intention"
      />
    );
  }

  return (
    <button type="button" className="cc-plan-intention" data-set={initial ? "" : undefined} onClick={() => setEditing(true)}>
      {initial ? (
        <><span className="cc-plan-intention-eyebrow">The point of the day</span><span className="cc-plan-intention-text">{initial}</span></>
      ) : (
        <span className="cc-plan-intention-add">+ What&rsquo;s this day for?</span>
      )}
    </button>
  );
}

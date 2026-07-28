"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDayIntention } from "@/lib/actions/plan-edit";
import type { IntentionVM } from "@/components/concierge";

export function PlanIntention({
  itineraryId,
  initial,
  intentions,
}: {
  itineraryId: string;
  initial?: string | null;
  intentions?: IntentionVM[];
}) {
  const resolvedInitial = initial ?? intentions?.find((x) => x.state !== "toggled_off")?.description ?? null;
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(resolvedInitial ?? "");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!editing) setValue(resolvedInitial ?? "");
  }, [resolvedInitial, editing]);

  function commit() {
    const next = value.trim();
    setEditing(false);
    if ((resolvedInitial ?? "") === next) return;
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
          if (e.key === "Escape") {
            setValue(resolvedInitial ?? "");
            setEditing(false);
          }
        }}
        disabled={pending}
        aria-label="The day's intention"
      />
    );
  }

  return (
    <button type="button" className="cc-plan-intention" data-set={resolvedInitial ? "" : undefined} onClick={() => setEditing(true)}>
      {resolvedInitial ? (
        <>
          <span className="cc-plan-intention-eyebrow">The point of the day</span>
          <span className="cc-plan-intention-text">{resolvedInitial}</span>
        </>
      ) : (
        <span className="cc-plan-intention-add">+ What&rsquo;s this day for?</span>
      )}
    </button>
  );
}

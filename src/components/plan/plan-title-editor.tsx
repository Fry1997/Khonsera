"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateItinerary } from "@/lib/actions/itineraries";

// Inline rename for the day/event title. `named` distinguishes a real stored
// title from a useful day-purpose fallback. Older callers omitted it, which means
// the fallback is not yet a stored name, so false is the safe default.
export function PlanTitleEditor({
  itineraryId,
  title,
  named = false,
}: {
  itineraryId: string;
  title: string;
  named?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(named ? title : "");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    const next = value.trim();
    setEditing(false);
    if ((named ? title : "") === next) return;
    startTransition(async () => {
      await updateItinerary({ id: itineraryId, title: next || null });
      router.refresh();
    });
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="cc-plan-title-input"
        value={value}
        placeholder="Name this day"
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        disabled={pending}
        aria-label="Day name"
      />
    );
  }

  return (
    <button
      type="button"
      className="cc-plan-title"
      data-unnamed={named ? undefined : ""}
      onClick={() => {
        setValue(named ? title : "");
        setEditing(true);
      }}
      title="Rename this day"
    >
      <span>{title}</span>
      <span className="cc-plan-title-edit" aria-hidden>Rename</span>
    </button>
  );
}

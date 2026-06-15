"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateItinerary } from "@/lib/actions/itineraries";

// Inline rename for the day/event title (deep review 2026-06-15). The plan title
// was a static <h1>, so a Journey that arrived without a name stayed "untitled"
// forever. Tap the title (or the "Name this day" prompt) → edit in place →
// `updateItinerary`. `named` distinguishes a real title from the date fallback so
// an unnamed day invites a name instead of freezing the fallback as the name.
export function PlanTitleEditor({
  itineraryId,
  title,
  named,
}: {
  itineraryId: string;
  title: string; // what to display (real title, or the date fallback)
  named: boolean; // whether the Journey actually has a stored title
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
    if ((named ? title : "") === next) return; // no change
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
      <span>{named ? title : title}</span>
      <span className="cc-plan-title-edit" aria-hidden>Rename</span>
    </button>
  );
}

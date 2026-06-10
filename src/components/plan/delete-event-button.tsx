"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteEvent } from "@/lib/actions/events";

// Clear out a day/trip you're no longer planning (esp. demo test data). A quiet
// affordance with a confirm — deleting a plan is not lightly reversible.
export function DeleteEventButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  function del(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Delete "${label || "this plan"}"? This can't be undone.`)) return;
    setPending(true);
    void deleteEvent(id).then((res) => {
      setPending(false);
      if (res.ok) router.refresh();
    });
  }

  return (
    <button type="button" className="cc-journey-del" onClick={del} disabled={pending} aria-label="Delete plan" title="Delete">
      {pending ? "…" : "×"}
    </button>
  );
}

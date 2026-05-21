"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Route } from "next";
import { deleteItinerary } from "@/lib/actions/itineraries";
import { feedbackFromError } from "@/lib/actions/_form";

// Two-click confirm so a stray tap on the itineraries list doesn't drop a
// trip. The first click reveals "Delete · confirm" for ~4s; the second
// click within that window calls the action. Same control on detail and
// list pages — different visual variants via the `variant` prop.

type Variant = "ghost" | "row";

export function DeleteItineraryButton({
  id,
  title,
  redirectTo,
  variant = "ghost",
  label = "Delete",
}: {
  id: string;
  title: string;
  // When set, push here after delete (used by the detail page to bounce
  // back to /itineraries). Otherwise stay and refresh the list.
  redirectTo?: string;
  variant?: Variant;
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      // Auto-revert after 4s so the button doesn't sit armed.
      window.setTimeout(() => setConfirming(false), 4000);
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await deleteItinerary(id);
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        setConfirming(false);
        return;
      }
      if (redirectTo) {
        router.push(redirectTo as Route);
      }
      router.refresh();
    });
  };

  const baseClass =
    variant === "row"
      ? "text-xs hover:underline"
      : "btn btn-ghost btn-sm";

  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
      onClick={(e) => e.stopPropagation()}
    >
      {error ? (
        <span
          style={{
            fontSize: 11,
            color: "var(--rust)",
            marginRight: 4,
          }}
        >
          {error}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={baseClass}
        title={confirming ? `Click again to delete "${title}"` : `Delete "${title}"`}
        style={{
          color: confirming ? "#fff" : "var(--rust)",
          background: confirming ? "var(--rust)" : undefined,
          borderColor: confirming ? "var(--rust)" : undefined,
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending
          ? "Deleting…"
          : confirming
            ? "Confirm delete"
            : label}
      </button>
    </span>
  );
}

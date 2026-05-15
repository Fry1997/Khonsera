"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { completeTrip, startTrip } from "@/lib/actions/trips";
import { feedbackFromError } from "@/lib/actions/_form";
import { FormError } from "@/components/ui/form";

export function TripControls({
  savedTripId,
  canStart,
  canComplete,
}: {
  savedTripId: string;
  canStart: boolean;
  canComplete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    if (!window.confirm("Mark this trip as in progress now?")) return;
    startTransition(async () => {
      setError(null);
      const result = await startTrip(savedTripId);
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      router.refresh();
    });
  };

  const complete = () => {
    if (!window.confirm("Mark this trip as completed?")) return;
    startTransition(async () => {
      setError(null);
      const result = await completeTrip(savedTripId);
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <FormError message={error ?? undefined} />
      {canStart ? (
        <button
          type="button"
          onClick={start}
          disabled={pending}
          className="btn-terra"
        >
          {pending ? "Starting…" : "Start journey"}
        </button>
      ) : null}
      {canComplete ? (
        <button
          type="button"
          onClick={complete}
          disabled={pending}
          className="btn-ghost"
        >
          {pending ? "Saving…" : "Mark complete"}
        </button>
      ) : null}
    </div>
  );
}

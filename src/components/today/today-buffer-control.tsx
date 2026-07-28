"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTravelProfile } from "@/lib/actions/travel-profile";
import { feedbackFromError } from "@/lib/actions/_form";

const DEFAULT_MARGIN_MINUTES = 15;

export function TodayBufferControl({
  initialMinutes,
}: {
  initialMinutes: number;
}) {
  const router = useRouter();
  const preferredMinutes =
    initialMinutes > 0 ? initialMinutes : DEFAULT_MARGIN_MINUTES;
  const [enabled, setEnabled] = useState(initialMinutes > 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const nextEnabled = !enabled;
    setEnabled(nextEnabled);
    setError(null);

    startTransition(async () => {
      const result = await updateTravelProfile({
        default_arrival_buffer_minutes: nextEnabled ? preferredMinutes : 0,
      });

      if (!result.ok) {
        setEnabled(!nextEnabled);
        setError(feedbackFromError(result.error).message);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="cc-today-buffer" data-pending={pending || undefined}>
      <span className="cc-today-buffer-copy">
        <strong>Keep {preferredMinutes}-min margin</strong>
        <span>Adjust the buffer before departure</span>
      </span>
      <button
        type="button"
        className="cc-today-buffer-switch"
        role="switch"
        aria-checked={enabled}
        aria-label={`Keep a ${preferredMinutes}-minute arrival margin`}
        disabled={pending}
        onClick={toggle}
      >
        <span />
      </button>
      {error ? (
        <span className="cc-today-buffer-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

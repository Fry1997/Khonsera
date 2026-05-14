"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reRunPlanning } from "@/lib/actions/calendar-views";
import { feedbackFromError } from "@/lib/actions/_form";
import { FormError } from "@/components/ui/form";

export function RePlanButton({ visitId }: { visitId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <FormError message={error ?? undefined} />
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            setError(null);
            const result = await reRunPlanning({ visitId });
            if (!result.ok) {
              setError(feedbackFromError(result.error).message);
              return;
            }
            router.refresh();
          });
        }}
        className="btn-ghost"
        title="Re-runs planning against current routing/rail data and your latest calendar"
      >
        {pending ? "Re-checking…" : "Re-check feasibility"}
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { GmailImportPanel } from "@/app/(app)/itineraries/[id]/gmail-import-panel";

export function PlanImport({
  itineraryId,
  journeyId,
  lastStopId = null,
  lastStopLabel = "your last stop",
}: {
  itineraryId?: string;
  journeyId?: string;
  lastStopId?: string | null;
  lastStopLabel?: string;
}) {
  const id = itineraryId ?? journeyId;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!id) return null;

  if (!open) {
    return (
      <button type="button" className="cc-add-trigger" onClick={() => setOpen(true)}>
        <span aria-hidden>↧</span> Scan email for tickets
      </button>
    );
  }

  return (
    <GmailImportPanel
      itineraryId={id}
      lastStopId={lastStopId}
      lastStopLabel={lastStopLabel}
      onClose={() => setOpen(false)}
      onImported={() => {
        router.push(`/plan/${id}` as Route);
        router.refresh();
      }}
      standaloneRuns
    />
  );
}

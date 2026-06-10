"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GmailImportPanel } from "@/app/(app)/itineraries/[id]/gmail-import-panel";

// Bring a booking in from email, on the new Plan flow (the user's "I can't bring
// it in" gap). Reuses the working Gmail import panel (the path that imported the
// real Trainline data), scoped to this Event; on import the spine re-folds it into
// a docked Pass and the Wallet picks it up. The panel is legacy-styled —
// DESIGN-PENDING for an Edition II pass.
export function PlanImport({
  itineraryId,
  lastStopId,
  lastStopLabel,
}: {
  itineraryId: string;
  lastStopId: string | null;
  lastStopLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="cc-add-trigger" onClick={() => setOpen(true)}>
        <span aria-hidden>↧</span> Scan email for tickets
      </button>
    );
  }

  return (
    <GmailImportPanel
      itineraryId={itineraryId}
      lastStopId={lastStopId}
      lastStopLabel={lastStopLabel}
      onClose={() => setOpen(false)}
      onImported={() => router.refresh()}
    />
  );
}

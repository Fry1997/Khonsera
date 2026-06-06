import type { ReactNode } from "react";
import { createDraftItinerary } from "@/lib/actions/itineraries";

// "New itinerary" entry point. Creates a blank trip and redirects straight into
// the planning view (no brief / "Build my day" step). A form posting to a
// server action so the trip is created on click — not on a Link prefetch, which
// would spawn phantom itineraries.
export function NewItineraryButton({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <form action={createDraftItinerary} style={{ display: "contents" }}>
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}

import { redirect } from "next/navigation";

// Retired (deep audit 2026-06-15). The transport decision/comparison layer is now
// contextual, not a standalone page: per-leg comparison lives in the plan spine's
// CompareSheet (tap a leg on /plan/[id]) and flight comparison in FlightFinder.
// This early stub (hardcoded options) is superseded — redirect to the itinerary
// list, matching the other orphan redirects. The ComparisonMatrix component stays.
export default function CompareRedirect() {
  redirect("/plan");
}

import { redirect } from "next/navigation";

// Retired (2026-06-15, founder direction). The Brief intake FORM "didn't land
// right" — a new day was meant to open straight into the plan, not a separate
// form. The canonical surface /plan/[id] now carries the full toolkit (manual add
// with changeover-capable transport, Gmail import, flight/stay finders), so the
// blank-plan create flow IS the intake. Every "Plan a day" entry point now routes
// through PlanCreate → /plan/[id]. This route redirects to the Plan index, where
// PlanCreate lives. The form (new-itinerary-form.tsx) stays DORMANT in the tree
// (like the legacy editor) — not deleted, just no longer a destination.
export default function NewItineraryRedirect() {
  redirect("/plan");
}

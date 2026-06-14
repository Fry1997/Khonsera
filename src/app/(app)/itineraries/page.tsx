import { redirect } from "next/navigation";

// `/plan` is the single canonical itinerary list (Edition III P0). This legacy
// list route redirects so there is one place to browse days, not two.
export default function ItinerariesListRedirect() {
  redirect("/plan");
}

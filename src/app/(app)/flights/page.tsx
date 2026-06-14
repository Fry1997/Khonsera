import { redirect } from "next/navigation";

// Flights are captured as anchors via manual entry / Gmail import (Edition III
// P0). The standalone flights page is folded into the one capture surface.
export default function FlightsRedirect() {
  redirect("/itineraries/new");
}

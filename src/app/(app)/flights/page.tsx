import { redirect } from "next/navigation";

// Flights are captured on the plan itself — the FlightFinder + manual transport
// add on /plan/[id]. The standalone flights page folds into the Plan surface.
export default function FlightsRedirect() {
  redirect("/plan");
}

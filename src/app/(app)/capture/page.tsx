import { redirect } from "next/navigation";

// Tell Khonsera (free-text capture) is benched — capture is email + manual for
// now; the natural-language path returns later as an AI-enabled tier (LLM
// parsing). The engine under src/lib/parser + src/components/capture is kept
// dormant. Any stray link/bookmark lands on manual entry.
export default function CaptureBenched() {
  redirect("/itineraries/new");
}

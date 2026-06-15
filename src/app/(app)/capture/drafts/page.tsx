import { redirect } from "next/navigation";

// Benched alongside /capture (see ../page.tsx). Drafts of free-text captures
// have no surface while Tell is parked; land on the Plan index.
export default function CaptureDraftsBenched() {
  redirect("/plan");
}

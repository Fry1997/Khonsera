import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";

export default async function NewItineraryPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);

  const { data: itinerary, error } = await supabase
    .from("itineraries")
    .insert({
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
      date_start: today,
      date_end: today,
      status: "planning",
    })
    .select("id")
    .single();

  if (error || !itinerary) {
    redirect("/itineraries");
  }

  redirect(`/itineraries/${itinerary.id}`);
}

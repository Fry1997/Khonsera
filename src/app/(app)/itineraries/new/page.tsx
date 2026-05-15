import { PageShell } from "@/components/ui/page-shell";
import { NewItineraryForm } from "./new-itinerary-form";

export default function NewItineraryPage() {
  return (
    <PageShell
      title="New itinerary"
      description="Start with a date. You can add stops (appointments, transport, hotels, events) once the itinerary exists."
    >
      <div className="max-w-xl">
        <NewItineraryForm />
      </div>
    </PageShell>
  );
}

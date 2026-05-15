"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  FormError,
  FormField,
  Input,
  SubmitButton,
  Textarea,
} from "@/components/ui/form";
import { createItinerary } from "@/lib/actions/itineraries";
import { feedbackFromError, type FormFeedback } from "@/lib/actions/_form";

export function NewItineraryForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);

  return (
    <form
      className="flex flex-col gap-4"
      action={(formData) => {
        startTransition(async () => {
          setFeedback(null);
          const result = await createItinerary({
            title: String(formData.get("title") ?? "") || null,
            date_start: String(formData.get("date_start") ?? ""),
            date_end: String(formData.get("date_end") ?? "") || undefined,
            notes: String(formData.get("notes") ?? "") || null,
          });
          if (!result.ok) {
            setFeedback(feedbackFromError(result.error));
            return;
          }
          router.push(`/itineraries/${result.value.id}`);
          router.refresh();
        });
      }}
    >
      <FormError message={feedback?.message} />
      <FormField label="Title (optional)" htmlFor="title">
        <Input
          id="title"
          name="title"
          maxLength={200}
          placeholder="e.g. Birmingham trip, 25 May"
          autoFocus
        />
      </FormField>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField
          label="Start date"
          htmlFor="date_start"
          error={feedback?.fieldErrors.date_start}
        >
          <Input id="date_start" name="date_start" type="date" required />
        </FormField>
        <FormField
          label="End date (optional)"
          htmlFor="date_end"
          hint="Leave blank for a single-day itinerary"
          error={feedback?.fieldErrors.date_end}
        >
          <Input id="date_end" name="date_end" type="date" />
        </FormField>
      </div>
      <FormField label="Notes (optional)" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={3} maxLength={4000} />
      </FormField>
      <SubmitButton pending={pending}>Create itinerary</SubmitButton>
    </form>
  );
}

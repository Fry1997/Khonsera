"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  FormError,
  FormField,
  Input,
  SubmitButton,
} from "@/components/ui/form";
import {
  recordTravelBooking,
  updateBookingIntentStatus,
} from "@/lib/actions/bookings";
import { feedbackFromError, type FormFeedback } from "@/lib/actions/_form";

export function MarkAsBookedForm({
  bookingIntentId,
  defaultPrice,
  currency,
}: {
  bookingIntentId: string | null;
  defaultPrice: number | null;
  currency: "GBP" | "EUR" | "USD";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);
  const [saved, setSaved] = useState(false);

  if (!bookingIntentId) {
    return (
      <FormError message="No booking intent found for this visit yet. Re-confirm the visit if needed." />
    );
  }

  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      action={(formData) => {
        startTransition(async () => {
          setFeedback(null);
          setSaved(false);
          const idem = crypto.randomUUID();
          const result = await recordTravelBooking({
            booking_intent_id: bookingIntentId,
            provider: "trainline",
            booking_reference: String(formData.get("booking_reference") ?? ""),
            ticket_status: "booked",
            actual_price: formData.get("actual_price")
              ? Number(formData.get("actual_price"))
              : null,
            currency,
            idempotency_key: idem,
          });
          if (!result.ok) {
            setFeedback(feedbackFromError(result.error));
            return;
          }
          // Flip the intent status to booked too.
          await updateBookingIntentStatus({
            id: bookingIntentId,
            status: "booked",
          });
          setSaved(true);
          router.refresh();
        });
      }}
    >
      <FormError message={feedback?.message} />
      <FormField
        label="Booking reference"
        htmlFor="booking_reference"
        error={feedback?.fieldErrors.booking_reference}
      >
        <Input
          id="booking_reference"
          name="booking_reference"
          placeholder="e.g. ABC123XYZ"
          required
          maxLength={120}
        />
      </FormField>
      <FormField
        label={`Actual price (${currency})`}
        htmlFor="actual_price"
        error={feedback?.fieldErrors.actual_price}
      >
        <Input
          id="actual_price"
          name="actual_price"
          type="number"
          step="0.01"
          min="0"
          defaultValue={defaultPrice ?? undefined}
        />
      </FormField>
      <div className="flex items-center gap-3 md:col-span-2">
        <SubmitButton pending={pending}>Record booking</SubmitButton>
        {saved ? (
          <span className="small text-sage">Saved.</span>
        ) : null}
      </div>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { SubmitButton } from "@/components/ui/form";
import type {
  PlacePickerCustomer,
  PlacePickerCustomerSite,
  PlacePickerLocation,
} from "@/components/place-picker";
import { feedbackFromError } from "@/lib/actions/_form";
import { attachAccommodationBooking } from "@/lib/actions/bookings";
import { createInlineLocation } from "@/lib/actions/locations";
import {
  AccommodationBookingFields,
  emptyAccommodationBooking,
  type AccommodationBookingValue,
} from "@/components/accommodation-booking-fields";

export function AddAccommodationBookingForm({
  afterStopId,
  afterStopLabel,
  existingStopId,
  customers,
  customerSites,
  locations,
  onCancel,
  onDone,
}: {
  afterStopId?: string;
  afterStopLabel?: string;
  existingStopId?: string;
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const [value, setValue] = useState<AccommodationBookingValue>(
    emptyAccommodationBooking(),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    if (!value.checkIn || !value.checkOut) {
      setError("Check-in and check-out times are required");
      return;
    }
    startTransition(async () => {
      let hotelLocationId: string | null = null;
      let resolvedName: string | null = value.hotelName.trim() || null;

      if (value.hotel) {
        if (value.hotel.kind === "location") {
          hotelLocationId = value.hotel.location_id;
          if (!resolvedName) resolvedName = value.hotel.label;
        } else {
          const created = await createInlineLocation({
            name: value.hotel.label,
            type: "hotel",
          });
          if (!created.ok) {
            setError(feedbackFromError(created.error).message);
            return;
          }
          hotelLocationId = created.value.id;
          if (!resolvedName) resolvedName = created.value.name;
        }
      }

      const result = await attachAccommodationBooking({
        stop_id: existingStopId ?? null,
        after_stop_id: existingStopId ? null : afterStopId ?? null,
        hotel_location_id: hotelLocationId,
        hotel_name: resolvedName,
        check_in: new Date(value.checkIn).toISOString(),
        check_out: new Date(value.checkOut).toISOString(),
        provider: value.provider.trim() || null,
        booking_reference: value.reference || null,
        actual_price: value.price ? Number(value.price) : null,
        currency: "GBP",
        room_details: value.room || null,
      });
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      onDone();
    });
  };

  return (
    <div className="k-card flex flex-col gap-4 p-5" role="dialog">
      <header>
        <p className="uc">Manual booking · Accommodation</p>
        <h3 className="h2" style={{ marginTop: 4 }}>
          Hotel stay{afterStopLabel ? ` · after ${afterStopLabel}` : ""}
        </h3>
        <p className="small mt-1">
          Add a confirmed hotel booking. A check-in stop is created (or
          updated) with the dates locked to the booking.
        </p>
      </header>

      <AccommodationBookingFields
        value={value}
        onChange={setValue}
        customers={customers}
        customerSites={customerSites}
        locations={locations}
      />

      {error ? <p className="text-xs text-rust">{error}</p> : null}

      <div className="flex gap-2">
        <SubmitButton pending={pending} onClick={submit} type="button">
          Attach hotel booking
        </SubmitButton>
        <button
          type="button"
          onClick={onCancel}
          className="btn-ghost"
          disabled={pending}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

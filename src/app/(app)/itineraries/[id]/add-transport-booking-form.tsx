"use client";

import { useState, useTransition } from "react";
import { SubmitButton } from "@/components/ui/form";
import type {
  PlacePickerCustomer,
  PlacePickerCustomerSite,
  PlacePickerLocation,
} from "@/components/place-picker";
import { feedbackFromError } from "@/lib/actions/_form";
import { attachTransportBookingToStop } from "@/lib/actions/bookings";
import { createInlineLocation } from "@/lib/actions/locations";
import {
  TransportBookingFields,
  emptyTransportBooking,
  MODE_LABELS,
  COPY,
  type TransportBookingMode,
  type TransportBookingValue,
} from "@/components/transport-booking-fields";

export type { TransportBookingMode } from "@/components/transport-booking-fields";

export function AddTransportBookingForm({
  fromStopId,
  fromStopLabel,
  initialMode = "train",
  customers,
  customerSites,
  locations,
  onCancel,
  onDone,
}: {
  fromStopId: string;
  fromStopLabel: string;
  initialMode?: TransportBookingMode;
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const [value, setValue] = useState<TransportBookingValue>(
    emptyTransportBooking(initialMode),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const copy = COPY[value.mode];
  const supportsChangeovers =
    value.mode === "train" || value.mode === "flight" || value.mode === "tube";

  const submit = () => {
    setError(null);
    if (!value.arrival) {
      setError(`Pick a ${copy.toLabel.toLowerCase()}`);
      return;
    }
    for (const s of value.segments) {
      if (
        !s.from_location_name ||
        !s.to_location_name ||
        !s.departure_at ||
        !s.arrival_at
      ) {
        setError(
          `Each ${supportsChangeovers ? "segment" : "leg"} needs from, to, depart and arrive times`,
        );
        return;
      }
    }
    startTransition(async () => {
      let arrivalLocationId: string | null = null;
      let arrivalLocationName: string | null = null;
      const arrivalType = copy.placeKind === "station" ? "station" : "other";

      if (value.arrival!.kind === "location") {
        arrivalLocationId = value.arrival!.location_id;
      } else {
        const created = await createInlineLocation({
          name: value.arrival!.label,
          type: arrivalType,
        });
        if (!created.ok) {
          setError(feedbackFromError(created.error).message);
          return;
        }
        arrivalLocationId = created.value.id;
        arrivalLocationName = created.value.name;
      }
      const result = await attachTransportBookingToStop({
        from_stop_id: fromStopId,
        mode: value.mode,
        provider: value.provider.trim() || null,
        arrival_location_id: arrivalLocationId,
        arrival_location_name: arrivalLocationName,
        arrival_location_type: arrivalType as never,
        booking_reference: value.reference || null,
        actual_price: value.price ? Number(value.price) : null,
        currency: "GBP",
        seat_reservation: value.seat || null,
        segments: value.segments.map((s) => ({
          from_location_name: s.from_location_name,
          to_location_name: s.to_location_name,
          departure_at: new Date(s.departure_at).toISOString(),
          arrival_at: new Date(s.arrival_at).toISOString(),
          service_number: s.service_number || null,
          platform_dep: s.platform_dep || null,
          platform_arr: s.platform_arr || null,
        })),
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
        <p className="uc">Manual booking · From {fromStopLabel}</p>
        <h3 className="h2" style={{ marginTop: 4 }}>
          {MODE_LABELS[value.mode]} ticket
        </h3>
        <p className="small mt-1">
          Capture a confirmed booking. The destination is added as the next
          point, and the leg between is locked to the ticket&apos;s times.
        </p>
      </header>

      <TransportBookingFields
        value={value}
        onChange={setValue}
        fromLabel={fromStopLabel}
        customers={customers}
        customerSites={customerSites}
        locations={locations}
        disabled={pending}
      />

      {error ? <p className="text-xs text-rust">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <SubmitButton pending={pending} onClick={submit} type="button">
          Attach {MODE_LABELS[value.mode].toLowerCase()} booking
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

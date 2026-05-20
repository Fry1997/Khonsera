"use client";

import { useState, useTransition } from "react";
import { FormField, Input, SubmitButton } from "@/components/ui/form";
import {
  PlacePicker,
  type PlaceSelection,
  type PlacePickerCustomer,
  type PlacePickerCustomerSite,
  type PlacePickerLocation,
} from "@/components/place-picker";
import { feedbackFromError } from "@/lib/actions/_form";
import { attachAccommodationBooking } from "@/lib/actions/bookings";
import { createInlineLocation } from "@/lib/actions/locations";

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
  // If editing an existing accommodation stop pass `existingStopId`.
  // For a new stay, pass `afterStopId`.
  afterStopId?: string;
  afterStopLabel?: string;
  existingStopId?: string;
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const [hotel, setHotel] = useState<PlaceSelection | null>(null);
  const [hotelName, setHotelName] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [reference, setReference] = useState("");
  const [provider, setProvider] = useState("");
  const [price, setPrice] = useState("");
  const [room, setRoom] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hotelLocations = locations.filter(
    (l) => l.type === "hotel" || l.type === "other",
  );

  const submit = () => {
    setError(null);
    if (!checkIn || !checkOut) {
      setError("Check-in and check-out times are required");
      return;
    }
    startTransition(async () => {
      let hotelLocationId: string | null = null;
      let resolvedName: string | null = hotelName.trim() || null;

      if (hotel) {
        if (hotel.kind === "location") {
          hotelLocationId = hotel.location_id;
          if (!resolvedName) resolvedName = hotel.label;
        } else {
          // Materialise customer/site/customer picks as a hotel-type location.
          const created = await createInlineLocation({
            name: hotel.label,
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
        check_in: new Date(checkIn).toISOString(),
        check_out: new Date(checkOut).toISOString(),
        provider: provider.trim() || null,
        booking_reference: reference || null,
        actual_price: price ? Number(price) : null,
        currency: "GBP",
        room_details: room || null,
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

      <FormField label="Hotel" htmlFor="hotel">
        <PlacePicker
          customers={customers}
          customerSites={customerSites}
          locations={hotelLocations}
          value={hotel}
          onChange={setHotel}
          showCustomers={false}
          googleTypes="lodging"
          defaultNewType="hotel"
          placeholder="Search a hotel or pick a saved one"
        />
      </FormField>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Check-in" htmlFor="ci">
          <Input
            id="ci"
            type="datetime-local"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
          />
        </FormField>
        <FormField label="Check-out" htmlFor="co">
          <Input
            id="co"
            type="datetime-local"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Provider" htmlFor="provider">
          <Input
            id="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="Booking.com"
          />
        </FormField>
        <FormField label="Booking ref." htmlFor="ref">
          <Input
            id="ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="ABC123"
          />
        </FormField>
        <FormField label="Price (£)" htmlFor="price">
          <Input
            id="price"
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </FormField>
        <FormField label="Room details" htmlFor="room">
          <Input
            id="room"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="King · breakfast included"
          />
        </FormField>
      </div>

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

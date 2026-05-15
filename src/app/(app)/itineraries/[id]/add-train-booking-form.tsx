"use client";

import { useState, useTransition } from "react";
import {
  FormField,
  Input,
  SubmitButton,
} from "@/components/ui/form";
import {
  PlacePicker,
  type PlaceSelection,
  type PlacePickerCustomer,
  type PlacePickerCustomerSite,
  type PlacePickerLocation,
} from "@/components/place-picker";
import { feedbackFromError } from "@/lib/actions/_form";
import { attachTrainBookingToStop } from "@/lib/actions/bookings";
import { createInlineLocation } from "@/lib/actions/locations";

type Segment = {
  from_location_name: string;
  to_location_name: string;
  departure_at: string; // datetime-local string
  arrival_at: string;
  train_number: string;
  platform_dep: string;
  platform_arr: string;
};

function emptySegment(): Segment {
  return {
    from_location_name: "",
    to_location_name: "",
    departure_at: "",
    arrival_at: "",
    train_number: "",
    platform_dep: "",
    platform_arr: "",
  };
}

export function AddTrainBookingForm({
  fromStopId,
  fromStopLabel,
  customers,
  customerSites,
  locations,
  onCancel,
  onDone,
}: {
  fromStopId: string;
  fromStopLabel: string;
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const [arrival, setArrival] = useState<PlaceSelection | null>(null);
  const [segments, setSegments] = useState<Segment[]>([emptySegment()]);
  const [reference, setReference] = useState("");
  const [price, setPrice] = useState("");
  const [seat, setSeat] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Restrict the place picker to stations + free-text. We do that by only
  // surfacing station-type locations here.
  const stationOnly = locations.filter((l) => l.type === "station");

  const updateSegment = (i: number, patch: Partial<Segment>) => {
    setSegments((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );
  };

  const addSegment = () => setSegments((prev) => [...prev, emptySegment()]);
  const removeSegment = (i: number) =>
    setSegments((prev) => prev.filter((_, idx) => idx !== i));

  const submit = () => {
    setError(null);
    if (!arrival) {
      setError("Pick an arrival station");
      return;
    }
    for (const s of segments) {
      if (
        !s.from_location_name ||
        !s.to_location_name ||
        !s.departure_at ||
        !s.arrival_at
      ) {
        setError("Each segment needs from, to, depart and arrive times");
        return;
      }
    }
    startTransition(async () => {
      let arrivalLocationId: string | null = null;
      let arrivalLocationName: string | null = null;
      if (arrival.kind === "location") {
        arrivalLocationId = arrival.location_id;
      } else {
        // Customer / customer_site doesn't fit "arrival station" — create
        // a station location from the picker's label as a fallback.
        const created = await createInlineLocation({
          name: arrival.label,
          type: "station",
        });
        if (!created.ok) {
          setError(feedbackFromError(created.error).message);
          return;
        }
        arrivalLocationId = created.value.id;
        arrivalLocationName = created.value.name;
      }
      const result = await attachTrainBookingToStop({
        from_stop_id: fromStopId,
        arrival_location_id: arrivalLocationId,
        arrival_location_name: arrivalLocationName,
        booking_reference: reference || null,
        actual_price: price ? Number(price) : null,
        currency: "GBP",
        seat_reservation: seat || null,
        segments: segments.map((s) => ({
          from_location_name: s.from_location_name,
          to_location_name: s.to_location_name,
          departure_at: new Date(s.departure_at).toISOString(),
          arrival_at: new Date(s.arrival_at).toISOString(),
          train_number: s.train_number || null,
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
    <div className="j-card flex flex-col gap-4 p-5">
      <header>
        <p className="uc">Booked train</p>
        <h3 className="h3">From {fromStopLabel}</h3>
        <p className="small mt-1">
          Add a confirmed train ticket. The destination station will be added
          as the next point, and the leg between will be locked to the
          ticket's times.
        </p>
      </header>

      <FormField label="Arrival station" htmlFor="arrival">
        <PlacePicker
          customers={customers}
          customerSites={customerSites}
          locations={stationOnly}
          value={arrival}
          onChange={setArrival}
          placeholder="Pick a saved station or type to add"
        />
      </FormField>

      <div className="flex flex-col gap-3">
        {segments.map((s, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-md border border-rule bg-card-2/40 p-3"
          >
            <div className="flex items-center justify-between">
              <p className="uc">
                Segment {i + 1}
                {segments.length > 1 ? ` of ${segments.length}` : ""}
              </p>
              {segments.length > 1 ? (
                <button
                  type="button"
                  className="text-xs text-rust hover:underline"
                  onClick={() => removeSegment(i)}
                  disabled={pending}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <FormField label="From station" htmlFor={`seg-from-${i}`}>
                <Input
                  id={`seg-from-${i}`}
                  value={s.from_location_name}
                  onChange={(e) =>
                    updateSegment(i, { from_location_name: e.target.value })
                  }
                  placeholder="e.g. Wellingborough"
                />
              </FormField>
              <FormField label="To station" htmlFor={`seg-to-${i}`}>
                <Input
                  id={`seg-to-${i}`}
                  value={s.to_location_name}
                  onChange={(e) =>
                    updateSegment(i, { to_location_name: e.target.value })
                  }
                  placeholder="e.g. Birmingham New St"
                />
              </FormField>
              <FormField label="Departure" htmlFor={`seg-dep-${i}`}>
                <Input
                  id={`seg-dep-${i}`}
                  type="datetime-local"
                  value={s.departure_at}
                  onChange={(e) =>
                    updateSegment(i, { departure_at: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Arrival" htmlFor={`seg-arr-${i}`}>
                <Input
                  id={`seg-arr-${i}`}
                  type="datetime-local"
                  value={s.arrival_at}
                  onChange={(e) =>
                    updateSegment(i, { arrival_at: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Train no. (optional)" htmlFor={`seg-no-${i}`}>
                <Input
                  id={`seg-no-${i}`}
                  value={s.train_number}
                  onChange={(e) =>
                    updateSegment(i, { train_number: e.target.value })
                  }
                  placeholder="e.g. 1A45"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-2">
                <FormField label="Platform dep." htmlFor={`seg-pd-${i}`}>
                  <Input
                    id={`seg-pd-${i}`}
                    value={s.platform_dep}
                    onChange={(e) =>
                      updateSegment(i, { platform_dep: e.target.value })
                    }
                  />
                </FormField>
                <FormField label="Platform arr." htmlFor={`seg-pa-${i}`}>
                  <Input
                    id={`seg-pa-${i}`}
                    value={s.platform_arr}
                    onChange={(e) =>
                      updateSegment(i, { platform_arr: e.target.value })
                    }
                  />
                </FormField>
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addSegment}
          className="btn-ghost self-start"
          style={{ padding: "6px 12px", fontSize: 13 }}
          disabled={pending}
        >
          + Add changeover
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField label="Booking ref. (optional)" htmlFor="ref">
          <Input
            id="ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="ABC123"
          />
        </FormField>
        <FormField label="Price (£, optional)" htmlFor="price">
          <Input
            id="price"
            value={price}
            type="number"
            min={0}
            step="0.01"
            onChange={(e) => setPrice(e.target.value)}
          />
        </FormField>
        <FormField label="Seat (optional)" htmlFor="seat">
          <Input
            id="seat"
            value={seat}
            onChange={(e) => setSeat(e.target.value)}
            placeholder="Coach C, Seat 42"
          />
        </FormField>
      </div>

      {error ? <p className="text-xs text-rust">{error}</p> : null}

      <div className="flex gap-2">
        <SubmitButton pending={pending} onClick={submit} type="button">
          Attach train booking
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

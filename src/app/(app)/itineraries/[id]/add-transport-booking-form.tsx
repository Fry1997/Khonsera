"use client";

import { useState, useTransition } from "react";
import { TransportIcon } from "@/components/icons";
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
import { attachTransportBookingToStop } from "@/lib/actions/bookings";
import { createInlineLocation } from "@/lib/actions/locations";

export type TransportBookingMode =
  | "train"
  | "flight"
  | "taxi"
  | "bus"
  | "tube"
  | "drive";

const MODE_LABELS: Record<TransportBookingMode, string> = {
  train: "Train",
  flight: "Flight",
  taxi: "Taxi",
  bus: "Bus",
  tube: "Tube",
  drive: "Car hire",
};

function ModeIcon({ mode }: { mode: TransportBookingMode }) {
  const props = { size: 14 } as const;
  switch (mode) {
    case "train":
      return <TransportIcon.train {...props} />;
    case "flight":
      return <TransportIcon.flight {...props} />;
    case "taxi":
      return <TransportIcon.taxi {...props} />;
    case "bus":
      return <TransportIcon.bus {...props} />;
    case "tube":
      return <TransportIcon.tube {...props} />;
    case "drive":
      return <TransportIcon.drive {...props} />;
  }
}

const COPY: Record<
  TransportBookingMode,
  {
    fromLabel: string;
    toLabel: string;
    serviceLabel: string;
    servicePlaceholder: string;
    platformDepLabel: string;
    platformArrLabel: string;
    platformDepPh: string;
    seatLabel: string;
    seatPlaceholder: string;
    googleTypes?: string;
    placeKind: "station" | "hotel" | "other";
  }
> = {
  train: {
    fromLabel: "From station",
    toLabel: "To station",
    serviceLabel: "Train no.",
    servicePlaceholder: "e.g. 1A45",
    platformDepLabel: "Platform dep.",
    platformArrLabel: "Platform arr.",
    platformDepPh: "5",
    seatLabel: "Seat",
    seatPlaceholder: "Coach C, Seat 42",
    googleTypes: "train_station",
    placeKind: "station",
  },
  flight: {
    fromLabel: "From airport",
    toLabel: "To airport",
    serviceLabel: "Flight no.",
    servicePlaceholder: "e.g. BA245",
    platformDepLabel: "Departure terminal",
    platformArrLabel: "Arrival terminal",
    platformDepPh: "T5",
    seatLabel: "Seat",
    seatPlaceholder: "12A",
    googleTypes: "airport",
    placeKind: "station",
  },
  taxi: {
    fromLabel: "Pickup",
    toLabel: "Drop-off",
    serviceLabel: "Booking ref.",
    servicePlaceholder: "ABC-123",
    platformDepLabel: "Pickup note",
    platformArrLabel: "Drop-off note",
    platformDepPh: "Main entrance",
    seatLabel: "Passengers",
    seatPlaceholder: "2",
    placeKind: "other",
  },
  bus: {
    fromLabel: "From stop",
    toLabel: "To stop",
    serviceLabel: "Route",
    servicePlaceholder: "Bus 24",
    platformDepLabel: "Stop ID",
    platformArrLabel: "Stop ID",
    platformDepPh: "—",
    seatLabel: "Seat",
    seatPlaceholder: "(optional)",
    googleTypes: "bus_station",
    placeKind: "station",
  },
  tube: {
    fromLabel: "From station",
    toLabel: "To station",
    serviceLabel: "Line",
    servicePlaceholder: "Northern Line",
    platformDepLabel: "Platform dep.",
    platformArrLabel: "Platform arr.",
    platformDepPh: "—",
    seatLabel: "",
    seatPlaceholder: "",
    googleTypes: "subway_station",
    placeKind: "station",
  },
  drive: {
    fromLabel: "Pickup location",
    toLabel: "Return location",
    serviceLabel: "Hire ref.",
    servicePlaceholder: "Hertz #ABC123",
    platformDepLabel: "",
    platformArrLabel: "",
    platformDepPh: "",
    seatLabel: "Vehicle",
    seatPlaceholder: "VW Golf",
    placeKind: "other",
  },
};

type Segment = {
  from_location_name: string;
  to_location_name: string;
  departure_at: string;
  arrival_at: string;
  service_number: string;
  platform_dep: string;
  platform_arr: string;
};

function emptySegment(): Segment {
  return {
    from_location_name: "",
    to_location_name: "",
    departure_at: "",
    arrival_at: "",
    service_number: "",
    platform_dep: "",
    platform_arr: "",
  };
}

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
  const [mode, setMode] = useState<TransportBookingMode>(initialMode);
  const [arrival, setArrival] = useState<PlaceSelection | null>(null);
  const [segments, setSegments] = useState<Segment[]>([emptySegment()]);
  const [reference, setReference] = useState("");
  const [price, setPrice] = useState("");
  const [seat, setSeat] = useState("");
  const [provider, setProvider] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const copy = COPY[mode];

  // For station-like modes, only surface station-type locations.
  const pickerLocations =
    copy.placeKind === "station"
      ? locations.filter((l) => l.type === "station")
      : locations;

  const updateSegment = (i: number, patch: Partial<Segment>) => {
    setSegments((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );
  };

  const addSegment = () => setSegments((prev) => [...prev, emptySegment()]);
  const removeSegment = (i: number) =>
    setSegments((prev) => prev.filter((_, idx) => idx !== i));

  const supportsChangeovers = mode === "train" || mode === "flight" || mode === "tube";

  const submit = () => {
    setError(null);
    if (!arrival) {
      setError(`Pick a ${copy.toLabel.toLowerCase()}`);
      return;
    }
    for (const s of segments) {
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

      if (arrival.kind === "location") {
        arrivalLocationId = arrival.location_id;
      } else {
        const created = await createInlineLocation({
          name: arrival.label,
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
        mode,
        provider: provider.trim() || null,
        arrival_location_id: arrivalLocationId,
        arrival_location_name: arrivalLocationName,
        arrival_location_type: arrivalType as never,
        booking_reference: reference || null,
        actual_price: price ? Number(price) : null,
        currency: "GBP",
        seat_reservation: seat || null,
        segments: segments.map((s) => ({
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
          {MODE_LABELS[mode]} ticket
        </h3>
        <p className="small mt-1">
          Capture a confirmed booking. The destination is added as the next
          point, and the leg between is locked to the ticket's times.
        </p>
      </header>

      <div className="flex flex-wrap gap-1">
        {(Object.keys(MODE_LABELS) as TransportBookingMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className="mode-pill"
            data-active={mode === m}
            disabled={pending}
          >
            <span aria-hidden style={{ display: "inline-flex" }}>
              <ModeIcon mode={m} />
            </span>
            <span>{MODE_LABELS[m]}</span>
          </button>
        ))}
      </div>

      <FormField label={`${copy.toLabel}`} htmlFor="arrival">
        <PlacePicker
          customers={customers}
          customerSites={customerSites}
          locations={pickerLocations}
          value={arrival}
          onChange={setArrival}
          showCustomers={copy.placeKind !== "station"}
          googleTypes={copy.googleTypes}
          defaultNewType={copy.placeKind === "station" ? "station" : "other"}
          placeholder={`Pick or search a ${copy.toLabel.toLowerCase()}`}
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
                {supportsChangeovers ? `Segment ${i + 1}` : "Leg"}
                {supportsChangeovers && segments.length > 1
                  ? ` of ${segments.length}`
                  : ""}
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
              <FormField label={copy.fromLabel} htmlFor={`seg-from-${i}`}>
                <Input
                  id={`seg-from-${i}`}
                  value={s.from_location_name}
                  onChange={(e) =>
                    updateSegment(i, { from_location_name: e.target.value })
                  }
                  placeholder={fromStopLabel}
                />
              </FormField>
              <FormField label={copy.toLabel} htmlFor={`seg-to-${i}`}>
                <Input
                  id={`seg-to-${i}`}
                  value={s.to_location_name}
                  onChange={(e) =>
                    updateSegment(i, { to_location_name: e.target.value })
                  }
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
              <FormField label={copy.serviceLabel} htmlFor={`seg-no-${i}`}>
                <Input
                  id={`seg-no-${i}`}
                  value={s.service_number}
                  onChange={(e) =>
                    updateSegment(i, { service_number: e.target.value })
                  }
                  placeholder={copy.servicePlaceholder}
                />
              </FormField>
              {copy.platformDepLabel ? (
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    label={copy.platformDepLabel}
                    htmlFor={`seg-pd-${i}`}
                  >
                    <Input
                      id={`seg-pd-${i}`}
                      value={s.platform_dep}
                      onChange={(e) =>
                        updateSegment(i, { platform_dep: e.target.value })
                      }
                      placeholder={copy.platformDepPh}
                    />
                  </FormField>
                  <FormField
                    label={copy.platformArrLabel}
                    htmlFor={`seg-pa-${i}`}
                  >
                    <Input
                      id={`seg-pa-${i}`}
                      value={s.platform_arr}
                      onChange={(e) =>
                        updateSegment(i, { platform_arr: e.target.value })
                      }
                    />
                  </FormField>
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {supportsChangeovers ? (
          <button
            type="button"
            onClick={addSegment}
            className="btn-ghost self-start"
            style={{ padding: "6px 12px", fontSize: 13 }}
            disabled={pending}
          >
            + Add changeover
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Provider (optional)" htmlFor="provider">
          <Input
            id="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder={
              mode === "flight"
                ? "British Airways"
                : mode === "train"
                  ? "Avanti, GWR…"
                  : "Hertz, Uber…"
            }
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
            value={price}
            type="number"
            min={0}
            step="0.01"
            onChange={(e) => setPrice(e.target.value)}
          />
        </FormField>
        {copy.seatLabel ? (
          <FormField label={copy.seatLabel} htmlFor="seat">
            <Input
              id="seat"
              value={seat}
              onChange={(e) => setSeat(e.target.value)}
              placeholder={copy.seatPlaceholder}
            />
          </FormField>
        ) : null}
      </div>

      {error ? <p className="text-xs text-rust">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <SubmitButton pending={pending} onClick={submit} type="button">
          Attach {MODE_LABELS[mode].toLowerCase()} booking
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

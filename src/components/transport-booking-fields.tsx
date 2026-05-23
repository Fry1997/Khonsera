"use client";

import { TransportIcon } from "@/components/icons";
import {
  FormField,
  Input,
} from "@/components/ui/form";
import {
  PlacePicker,
  type PlaceSelection,
  type PlacePickerCustomer,
  type PlacePickerCustomerSite,
  type PlacePickerLocation,
} from "@/components/place-picker";

export type TransportBookingMode =
  | "train"
  | "flight"
  | "taxi"
  | "bus"
  | "tube"
  | "drive";

export const MODE_LABELS: Record<TransportBookingMode, string> = {
  train: "Train",
  flight: "Flight",
  taxi: "Taxi",
  bus: "Bus",
  tube: "Tube",
  drive: "Car hire",
};

export function ModeIcon({ mode, size = 14 }: { mode: TransportBookingMode; size?: number }) {
  const Icon = TransportIcon[mode];
  return <Icon size={size} />;
}

export const COPY: Record<
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

export type TransportSegment = {
  from_location_name: string;
  to_location_name: string;
  departure_at: string;
  arrival_at: string;
  service_number: string;
  platform_dep: string;
  platform_arr: string;
};

export function emptySegment(): TransportSegment {
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

export type TransportBookingValue = {
  mode: TransportBookingMode;
  arrival: PlaceSelection | null;
  segments: TransportSegment[];
  reference: string;
  price: string;
  seat: string;
  provider: string;
};

export function emptyTransportBooking(
  initialMode: TransportBookingMode = "train",
): TransportBookingValue {
  return {
    mode: initialMode,
    arrival: null,
    segments: [emptySegment()],
    reference: "",
    price: "",
    seat: "",
    provider: "",
  };
}

export function TransportBookingFields({
  value,
  onChange,
  fromLabel,
  customers,
  customerSites,
  locations,
  disabled,
  idPrefix = "tbf",
}: {
  value: TransportBookingValue;
  onChange: (next: TransportBookingValue) => void;
  fromLabel?: string;
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  disabled?: boolean;
  idPrefix?: string;
}) {
  const copy = COPY[value.mode];
  const pickerLocations =
    copy.placeKind === "station"
      ? locations.filter((l) => l.type === "station")
      : locations;

  const updateSegment = (i: number, patch: Partial<TransportSegment>) => {
    const next = value.segments.map((s, idx) =>
      idx === i ? { ...s, ...patch } : s,
    );
    onChange({ ...value, segments: next });
  };

  const addSegment = () =>
    onChange({ ...value, segments: [...value.segments, emptySegment()] });
  const removeSegment = (i: number) =>
    onChange({ ...value, segments: value.segments.filter((_, idx) => idx !== i) });

  const supportsChangeovers =
    value.mode === "train" || value.mode === "flight" || value.mode === "tube";

  return (
    <>
      <div className="flex flex-wrap gap-1">
        {(Object.keys(MODE_LABELS) as TransportBookingMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() =>
              onChange({
                ...value,
                mode: m,
                segments: value.segments.length ? value.segments : [emptySegment()],
              })
            }
            className="mode-pill"
            data-active={value.mode === m}
            disabled={disabled}
          >
            <span aria-hidden style={{ display: "inline-flex" }}>
              <ModeIcon mode={m} />
            </span>
            <span>{MODE_LABELS[m]}</span>
          </button>
        ))}
      </div>

      <FormField label={copy.toLabel} htmlFor={`${idPrefix}-arrival`}>
        <PlacePicker
          customers={customers}
          customerSites={customerSites}
          locations={pickerLocations}
          value={value.arrival}
          onChange={(a) => onChange({ ...value, arrival: a })}
          showCustomers={copy.placeKind !== "station"}
          googleTypes={copy.googleTypes}
          defaultNewType={copy.placeKind === "station" ? "station" : "other"}
          placeholder={`Pick or search a ${copy.toLabel.toLowerCase()}`}
        />
      </FormField>

      <div className="flex flex-col gap-3">
        {value.segments.map((s, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-md border border-rule bg-card-2/40 p-3"
          >
            <div className="flex items-center justify-between">
              <p className="uc">
                {supportsChangeovers ? `Segment ${i + 1}` : "Leg"}
                {supportsChangeovers && value.segments.length > 1
                  ? ` of ${value.segments.length}`
                  : ""}
              </p>
              {value.segments.length > 1 ? (
                <button
                  type="button"
                  className="text-xs text-rust hover:underline"
                  onClick={() => removeSegment(i)}
                  disabled={disabled}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <FormField label={copy.fromLabel} htmlFor={`${idPrefix}-seg-from-${i}`}>
                <Input
                  id={`${idPrefix}-seg-from-${i}`}
                  value={s.from_location_name}
                  onChange={(e) =>
                    updateSegment(i, { from_location_name: e.target.value })
                  }
                  placeholder={fromLabel}
                />
              </FormField>
              <FormField label={copy.toLabel} htmlFor={`${idPrefix}-seg-to-${i}`}>
                <Input
                  id={`${idPrefix}-seg-to-${i}`}
                  value={s.to_location_name}
                  onChange={(e) =>
                    updateSegment(i, { to_location_name: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Departure" htmlFor={`${idPrefix}-seg-dep-${i}`}>
                <Input
                  id={`${idPrefix}-seg-dep-${i}`}
                  type="datetime-local"
                  value={s.departure_at}
                  onChange={(e) =>
                    updateSegment(i, { departure_at: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Arrival" htmlFor={`${idPrefix}-seg-arr-${i}`}>
                <Input
                  id={`${idPrefix}-seg-arr-${i}`}
                  type="datetime-local"
                  value={s.arrival_at}
                  onChange={(e) =>
                    updateSegment(i, { arrival_at: e.target.value })
                  }
                />
              </FormField>
              <FormField label={copy.serviceLabel} htmlFor={`${idPrefix}-seg-no-${i}`}>
                <Input
                  id={`${idPrefix}-seg-no-${i}`}
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
                    htmlFor={`${idPrefix}-seg-pd-${i}`}
                  >
                    <Input
                      id={`${idPrefix}-seg-pd-${i}`}
                      value={s.platform_dep}
                      onChange={(e) =>
                        updateSegment(i, { platform_dep: e.target.value })
                      }
                      placeholder={copy.platformDepPh}
                    />
                  </FormField>
                  <FormField
                    label={copy.platformArrLabel}
                    htmlFor={`${idPrefix}-seg-pa-${i}`}
                  >
                    <Input
                      id={`${idPrefix}-seg-pa-${i}`}
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
            disabled={disabled}
          >
            + Add changeover
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Provider (optional)" htmlFor={`${idPrefix}-provider`}>
          <Input
            id={`${idPrefix}-provider`}
            value={value.provider}
            onChange={(e) => onChange({ ...value, provider: e.target.value })}
            placeholder={
              value.mode === "flight"
                ? "British Airways"
                : value.mode === "train"
                  ? "Avanti, GWR…"
                  : "Hertz, Uber…"
            }
          />
        </FormField>
        <FormField label="Booking ref." htmlFor={`${idPrefix}-ref`}>
          <Input
            id={`${idPrefix}-ref`}
            value={value.reference}
            onChange={(e) => onChange({ ...value, reference: e.target.value })}
            placeholder="ABC123"
          />
        </FormField>
        <FormField label="Price (£)" htmlFor={`${idPrefix}-price`}>
          <Input
            id={`${idPrefix}-price`}
            value={value.price}
            type="number"
            min={0}
            step="0.01"
            onChange={(e) => onChange({ ...value, price: e.target.value })}
          />
        </FormField>
        {copy.seatLabel ? (
          <FormField label={copy.seatLabel} htmlFor={`${idPrefix}-seat`}>
            <Input
              id={`${idPrefix}-seat`}
              value={value.seat}
              onChange={(e) => onChange({ ...value, seat: e.target.value })}
              placeholder={copy.seatPlaceholder}
            />
          </FormField>
        ) : null}
      </div>
    </>
  );
}

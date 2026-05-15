"use client";

import { useState } from "react";
import {
  FormField,
  Input,
  Select,
  SubmitButton,
  Textarea,
} from "@/components/ui/form";
import {
  PlacePicker,
  type PlaceSelection,
  type PlacePickerCustomer,
  type PlacePickerCustomerSite,
  type PlacePickerLocation,
} from "@/components/place-picker";
import type { StopType } from "@/lib/types/domain";

type StopFormValues = {
  itinerary_id: string;
  type: StopType;
  title?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes?: number | null;
  is_time_fixed?: boolean;
  location_id?: string | null;
  customer_id?: string | null;
  customer_site_id?: string | null;
  contact_id?: string | null;
  external_reference?: string | null;
  external_url?: string | null;
  metadata?: Record<string, unknown> | null;
  notes?: string | null;
};

const STOP_TYPE_OPTIONS: { value: StopType; label: string }[] = [
  { value: "appointment", label: "Customer appointment" },
  { value: "transit_arrival", label: "Arrival at station / airport" },
  { value: "accommodation", label: "Accommodation (hotel)" },
  { value: "event", label: "Event (expo / talk / training)" },
  { value: "meal", label: "Meal / reservation" },
  { value: "transport_booked", label: "Booked transport" },
  { value: "start", label: "Start of day" },
  { value: "end", label: "End of day" },
  { value: "other", label: "Other" },
];

// Infer a sensible default stop type from the chosen place.
function inferStopType(sel: PlaceSelection): StopType {
  if (sel.kind === "customer" || sel.kind === "customer_site")
    return "appointment";
  switch (sel.location_type) {
    case "station":
      return "transit_arrival";
    case "hotel":
      return "accommodation";
    case "home":
    case "office":
      return "other";
    case "parking":
      return "other";
    case "customer_site":
      return "appointment";
    case "other":
      return "other";
  }
}

export function AddStopForm({
  itineraryId,
  customers,
  customerSites,
  locations,
  contacts,
  onCancel,
  onSubmit,
  pending,
}: {
  itineraryId: string;
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  contacts: { id: string; customer_id: string; name: string }[];
  onCancel: () => void;
  onSubmit: (input: StopFormValues) => void;
  pending: boolean;
}) {
  const [place, setPlace] = useState<PlaceSelection | null>(null);
  const [type, setType] = useState<StopType>("other");
  const [typeTouched, setTypeTouched] = useState(false);
  const [isAnchor, setIsAnchor] = useState(false);

  const contactsForCustomer =
    place && (place.kind === "customer" || place.kind === "customer_site")
      ? contacts.filter((c) => c.customer_id === place.customer_id)
      : [];

  const onPick = (sel: PlaceSelection | null) => {
    setPlace(sel);
    if (sel && !typeTouched) setType(inferStopType(sel));
  };

  return (
    <form
      className="j-card flex flex-col gap-4 p-5"
      action={(formData) => {
        if (!place) return;
        const values: StopFormValues = {
          itinerary_id: itineraryId,
          type,
          title: String(formData.get("title") ?? "") || null,
          start_time: formData.get("start_time")
            ? new Date(String(formData.get("start_time"))).toISOString()
            : null,
          end_time: formData.get("end_time")
            ? new Date(String(formData.get("end_time"))).toISOString()
            : null,
          duration_minutes: formData.get("duration_minutes")
            ? Number(formData.get("duration_minutes"))
            : null,
          is_time_fixed: isAnchor,
          location_id: place.kind === "location" ? place.location_id : null,
          customer_id:
            place.kind === "customer" || place.kind === "customer_site"
              ? place.customer_id
              : null,
          customer_site_id:
            place.kind === "customer_site" ? place.customer_site_id : null,
          contact_id: (formData.get("contact_id") as string) || null,
          external_reference:
            String(formData.get("external_reference") ?? "") || null,
          notes: String(formData.get("notes") ?? "") || null,
        };
        const flightIata = String(formData.get("flight_iata") ?? "").trim();
        if (flightIata) {
          values.metadata = { flight_iata: flightIata.toUpperCase() };
        }
        onSubmit(values);
      }}
    >
      <FormField label="Where?" htmlFor="place">
        <PlacePicker
          customers={customers}
          customerSites={customerSites}
          locations={locations}
          value={place}
          onChange={onPick}
          disabled={pending}
        />
      </FormField>

      <FormField label="What kind of stop?" htmlFor="type">
        <Select
          id="type"
          value={type}
          onChange={(e) => {
            setType(e.target.value as StopType);
            setTypeTouched(true);
          }}
        >
          {STOP_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Title (optional)" htmlFor="title">
        <Input
          id="title"
          name="title"
          maxLength={200}
          placeholder="Short label for this stop"
        />
      </FormField>

      {place &&
      (place.kind === "customer" || place.kind === "customer_site") &&
      contactsForCustomer.length > 0 ? (
        <FormField label="Contact (optional)" htmlFor="contact_id">
          <Select id="contact_id" name="contact_id" defaultValue="">
            <option value="">— None —</option>
            {contactsForCustomer.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
      ) : null}

      {type === "transport_booked" ? (
        <>
          <FormField label="Flight number (optional)" htmlFor="flight_iata">
            <Input
              id="flight_iata"
              name="flight_iata"
              placeholder="e.g. BA123"
              maxLength={10}
              autoComplete="off"
            />
          </FormField>
          <FormField
            label="Booking reference (optional)"
            htmlFor="external_reference"
          >
            <Input
              id="external_reference"
              name="external_reference"
              maxLength={200}
            />
          </FormField>
        </>
      ) : null}

      <div className="rounded-md border border-rule bg-card-2/50 p-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isAnchor}
            onChange={(e) => setIsAnchor(e.target.checked)}
          />
          <span>
            This time is fixed (anchor) — e.g. a booked train, a scheduled event
          </span>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField
          label={isAnchor ? "Start time (fixed)" : "Start time (optional)"}
          htmlFor="start_time"
        >
          <Input id="start_time" name="start_time" type="datetime-local" />
        </FormField>
        <FormField label="End time (optional)" htmlFor="end_time">
          <Input id="end_time" name="end_time" type="datetime-local" />
        </FormField>
      </div>

      <FormField
        label="How long here? (minutes, optional)"
        htmlFor="duration_minutes"
      >
        <Input
          id="duration_minutes"
          name="duration_minutes"
          type="number"
          min={5}
          max={24 * 60}
          placeholder="e.g. 180 for a 3-hour event"
        />
      </FormField>

      <FormField label="Notes (optional)" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={3} maxLength={4000} />
      </FormField>

      <div className="flex gap-2">
        <SubmitButton pending={pending} disabled={!place}>
          Add point
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
    </form>
  );
}


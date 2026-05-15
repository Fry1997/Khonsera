"use client";

import { useMemo, useState } from "react";
import {
  FormField,
  Input,
  Select,
  SubmitButton,
  Textarea,
} from "@/components/ui/form";
import type { LocationType, StopType } from "@/lib/types/domain";

type StopFormValues = {
  itinerary_id: string;
  type: StopType;
  title?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes?: number | null;
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
  { value: "transport_booked", label: "Booked transport (train/flight/bus)" },
  { value: "transit_arrival", label: "Arrival point (e.g. London King's Cross)" },
  { value: "accommodation", label: "Accommodation (hotel)" },
  { value: "event", label: "Event (expo / talk / training)" },
  { value: "meal", label: "Meal / reservation" },
  { value: "start", label: "Start of day" },
  { value: "end", label: "End of day" },
  { value: "other", label: "Other" },
];

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
  customers: { id: string; name: string }[];
  customerSites: { id: string; customer_id: string; name: string | null; address: string | null }[];
  locations: { id: string; name: string; type: LocationType; address: string | null }[];
  contacts: { id: string; customer_id: string; name: string }[];
  onCancel: () => void;
  onSubmit: (input: StopFormValues) => void;
  pending: boolean;
}) {
  const [type, setType] = useState<StopType>("appointment");
  const [customerId, setCustomerId] = useState<string>("");

  const filteredSites = useMemo(
    () => customerSites.filter((s) => s.customer_id === customerId),
    [customerSites, customerId],
  );
  const filteredContacts = useMemo(
    () => contacts.filter((c) => c.customer_id === customerId),
    [contacts, customerId],
  );

  return (
    <form
      className="j-card flex flex-col gap-4 p-5"
      action={(formData) => {
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
          location_id: (formData.get("location_id") as string) || null,
          customer_id: (formData.get("customer_id") as string) || null,
          customer_site_id: (formData.get("customer_site_id") as string) || null,
          contact_id: (formData.get("contact_id") as string) || null,
          external_reference: String(formData.get("external_reference") ?? "") || null,
          external_url: String(formData.get("external_url") ?? "") || null,
          notes: String(formData.get("notes") ?? "") || null,
        };
        // Type-specific metadata (e.g. flight number for transport_booked).
        const flightIata = String(formData.get("flight_iata") ?? "").trim();
        if (flightIata) {
          values.metadata = { flight_iata: flightIata.toUpperCase() };
        }
        onSubmit(values);
      }}
    >
      <FormField label="Type" htmlFor="type">
        <Select
          id="type"
          value={type}
          onChange={(e) => setType(e.target.value as StopType)}
        >
          {STOP_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Title (optional)" htmlFor="title">
        <Input id="title" name="title" maxLength={200} />
      </FormField>

      {/* Type-specific fields */}
      {type === "appointment" ? (
        <>
          <FormField label="Customer" htmlFor="customer_id">
            <Select
              id="customer_id"
              name="customer_id"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">— Select a customer —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Site (optional)" htmlFor="customer_site_id">
            <Select
              id="customer_site_id"
              name="customer_site_id"
              defaultValue=""
              disabled={!customerId}
            >
              <option value="">— None —</option>
              {filteredSites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name ?? s.address ?? "Site"}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Contact (optional)" htmlFor="contact_id">
            <Select
              id="contact_id"
              name="contact_id"
              defaultValue=""
              disabled={!customerId}
            >
              <option value="">— None —</option>
              {filteredContacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
        </>
      ) : null}

      {type === "accommodation" ||
      type === "event" ||
      type === "meal" ||
      type === "start" ||
      type === "end" ||
      type === "other" ||
      type === "transit_arrival" ? (
        <FormField label="Location" htmlFor="location_id">
          <Select id="location_id" name="location_id" defaultValue="">
            <option value="">— None —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.type})
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

      {/* Times */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Start time" htmlFor="start_time">
          <Input id="start_time" name="start_time" type="datetime-local" />
        </FormField>
        <FormField label="End time (optional)" htmlFor="end_time">
          <Input id="end_time" name="end_time" type="datetime-local" />
        </FormField>
      </div>

      <FormField label="Duration (minutes, optional)" htmlFor="duration_minutes">
        <Input
          id="duration_minutes"
          name="duration_minutes"
          type="number"
          min={5}
          max={24 * 60}
          placeholder="If end time not set"
        />
      </FormField>

      <FormField label="Notes (optional)" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={3} maxLength={4000} />
      </FormField>

      <div className="flex gap-2">
        <SubmitButton pending={pending}>Add stop</SubmitButton>
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

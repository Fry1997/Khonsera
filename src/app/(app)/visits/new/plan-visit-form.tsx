"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  FormError,
  FormField,
  Input,
  Select,
  SubmitButton,
  Textarea,
} from "@/components/ui/form";
import { createAndPlanVisit } from "@/lib/actions/planning";
import { feedbackFromError, type FormFeedback } from "@/lib/actions/_form";
import type { LocationType, TravelModePreference } from "@/lib/types/domain";

type Customer = { id: string; name: string };
type Site = { id: string; customer_id: string; name: string | null; address: string | null };
type Location = { id: string; name: string; type: LocationType };

export function PlanVisitForm({
  customers,
  sites,
  locations,
  defaults,
}: {
  customers: Customer[];
  sites: Site[];
  locations: Location[];
  defaults: {
    startLocationId: string | null;
    returnLocationId: string | null;
    preferredMode: TravelModePreference;
    arrivalBuffer: number;
    returnBuffer: number;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);
  const [customerId, setCustomerId] = useState<string>(customers[0]?.id ?? "");

  const filteredSites = useMemo(
    () => sites.filter((s) => s.customer_id === customerId),
    [sites, customerId],
  );

  return (
    <form
      className="flex flex-col gap-4"
      action={(formData) => {
        startTransition(async () => {
          setFeedback(null);
          const result = await createAndPlanVisit({
            customer_id: String(formData.get("customer_id") ?? ""),
            customer_site_id: (formData.get("customer_site_id") as string) || null,
            title: String(formData.get("title") ?? "") || undefined,
            proposed_start_time: new Date(
              String(formData.get("proposed_start_time") ?? ""),
            ).toISOString(),
            meeting_duration_minutes: Number(formData.get("meeting_duration_minutes") ?? 60),
            latest_return_time:
              formData.get("latest_return_time")
                ? new Date(String(formData.get("latest_return_time"))).toISOString()
                : null,
            start_location_id: String(formData.get("start_location_id") ?? ""),
            return_location_id: String(formData.get("return_location_id") ?? ""),
            travel_mode_preference: formData.get(
              "travel_mode_preference",
            ) as TravelModePreference,
            arrival_buffer_minutes: Number(formData.get("arrival_buffer_minutes") ?? 15),
            return_buffer_minutes: Number(formData.get("return_buffer_minutes") ?? 15),
            notes: String(formData.get("notes") ?? "") || undefined,
          });
          if (!result.ok) {
            setFeedback(feedbackFromError(result.error));
            return;
          }
          router.push(`/visits/${result.value.visitId}`);
          router.refresh();
        });
      }}
    >
      <FormError message={feedback?.message} />

      <FormField label="Customer" htmlFor="customer_id" error={feedback?.fieldErrors.customer_id}>
        <Select
          id="customer_id"
          name="customer_id"
          required
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        label="Site (optional)"
        htmlFor="customer_site_id"
        hint={
          filteredSites.length === 0
            ? "No sites for this customer yet — you can still proceed with the customer's main address."
            : undefined
        }
      >
        <Select id="customer_site_id" name="customer_site_id" defaultValue="">
          <option value="">— None —</option>
          {filteredSites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name ?? s.address ?? "Site"}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Title (optional)" htmlFor="title">
        <Input id="title" name="title" maxLength={200} placeholder="e.g. Site survey" />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Proposed start"
          htmlFor="proposed_start_time"
          error={feedback?.fieldErrors.proposed_start_time}
        >
          <Input
            id="proposed_start_time"
            name="proposed_start_time"
            type="datetime-local"
            required
          />
        </FormField>
        <FormField
          label="Duration (min)"
          htmlFor="meeting_duration_minutes"
          error={feedback?.fieldErrors.meeting_duration_minutes}
        >
          <Input
            id="meeting_duration_minutes"
            name="meeting_duration_minutes"
            type="number"
            min={5}
            max={1440}
            defaultValue={120}
            required
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Start location"
          htmlFor="start_location_id"
          error={feedback?.fieldErrors.start_location_id}
        >
          <Select
            id="start_location_id"
            name="start_location_id"
            defaultValue={defaults.startLocationId ?? ""}
            required
          >
            <option value="">— Pick a location —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.type})
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Return location"
          htmlFor="return_location_id"
          error={feedback?.fieldErrors.return_location_id}
        >
          <Select
            id="return_location_id"
            name="return_location_id"
            defaultValue={defaults.returnLocationId ?? ""}
            required
          >
            <option value="">— Pick a location —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.type})
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Travel preference" htmlFor="travel_mode_preference">
          <Select
            id="travel_mode_preference"
            name="travel_mode_preference"
            defaultValue={defaults.preferredMode}
          >
            <option value="compare">Compare rail and drive</option>
            <option value="rail">Rail</option>
            <option value="drive">Drive</option>
            <option value="mixed">Mixed</option>
          </Select>
        </FormField>
        <FormField label="Latest return (optional)" htmlFor="latest_return_time">
          <Input id="latest_return_time" name="latest_return_time" type="datetime-local" />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Arrival buffer (min)" htmlFor="arrival_buffer_minutes">
          <Input
            id="arrival_buffer_minutes"
            name="arrival_buffer_minutes"
            type="number"
            min={0}
            max={180}
            defaultValue={defaults.arrivalBuffer}
          />
        </FormField>
        <FormField label="Return buffer (min)" htmlFor="return_buffer_minutes">
          <Input
            id="return_buffer_minutes"
            name="return_buffer_minutes"
            type="number"
            min={0}
            max={180}
            defaultValue={defaults.returnBuffer}
          />
        </FormField>
      </div>

      <FormField label="Notes (optional)" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={3} maxLength={4000} />
      </FormField>

      <SubmitButton pending={pending}>
        {pending ? "Checking feasibility…" : "Check feasibility"}
      </SubmitButton>
    </form>
  );
}

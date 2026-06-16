"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  FormError,
  FormField,
  Input,
  Select,
  SubmitButton,
} from "@/components/ui/form";
import { updateTravelProfile } from "@/lib/actions/travel-profile";
import { feedbackFromError, type FormFeedback } from "@/lib/actions/_form";
import type { LocationType, TravelModePreference } from "@/lib/types/domain";
import { TransportHubPicker } from "@/components/transport-hub-picker";

type LocationOption = { id: string; name: string; type: LocationType };

export function TravelProfileForm({
  initial,
  locations,
  defaultRailHub,
  defaultFlightHub,
}: {
  initial: {
    default_drive_origin_location_id: string | null;
    default_rail_origin_location_id: string | null;
    default_return_location_id: string | null;
    default_rail_origin_transport_hub_id: string | null;
    default_flight_origin_transport_hub_id: string | null;
    preferred_mode: TravelModePreference;
    default_arrival_buffer_minutes: number;
    default_airport_buffer_minutes: number;
    default_meeting_buffer_minutes: number;
    default_return_buffer_minutes: number;
    mileage_rate: number;
    walking_threshold_minutes: number;
    max_taxi_fare_pence: number;
    luggage_default: "none" | "light" | "heavy";
  };
  locations: LocationOption[];
  // Pre-resolved labels for the two hub defaults so the picker
  // shows a friendly name (not a uuid) on first paint without a
  // round-trip.
  defaultRailHub: { id: string; label: string } | null;
  defaultFlightHub: { id: string; label: string } | null;
}) {
  const [railHub, setRailHub] = useState<{
    id: string | null;
    label: string | null;
  }>(
    defaultRailHub
      ? { id: defaultRailHub.id, label: defaultRailHub.label }
      : { id: initial.default_rail_origin_transport_hub_id, label: null },
  );
  const [flightHub, setFlightHub] = useState<{
    id: string | null;
    label: string | null;
  }>(
    defaultFlightHub
      ? { id: defaultFlightHub.id, label: defaultFlightHub.label }
      : { id: initial.default_flight_origin_transport_hub_id, label: null },
  );
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const locationOptions = (filter?: LocationType) => (
    <>
      <option value="">— None —</option>
      {locations
        .filter((l) => (filter ? l.type === filter : true))
        .map((l) => (
          <option key={l.id} value={l.id}>
            {l.name} ({l.type})
          </option>
        ))}
      {/* Catch-all: always show every location even if filter is set, in case
          the user wants a non-default mapping (e.g. driving from a hotel). */}
      {filter
        ? locations
            .filter((l) => l.type !== filter)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.type})
              </option>
            ))
        : null}
    </>
  );

  return (
    <form
      className="flex flex-col gap-3"
      action={(formData) => {
        startTransition(async () => {
          setFeedback(null);
          setSavedNote(null);
          const result = await updateTravelProfile({
            default_drive_origin_location_id:
              (formData.get("drive_origin") as string) || null,
            default_rail_origin_location_id:
              (formData.get("rail_origin") as string) || null,
            default_return_location_id:
              (formData.get("return_location") as string) || null,
            default_rail_origin_transport_hub_id: railHub.id,
            default_flight_origin_transport_hub_id: flightHub.id,
            preferred_mode: formData.get("preferred_mode") as TravelModePreference,
            default_arrival_buffer_minutes: Number(formData.get("arrival_buffer") ?? 15),
            default_airport_buffer_minutes: Number(formData.get("airport_buffer") ?? 90),
            default_meeting_buffer_minutes: Number(formData.get("meeting_buffer") ?? 10),
            default_return_buffer_minutes: Number(formData.get("return_buffer") ?? 15),
            mileage_rate: Number(formData.get("mileage_rate") ?? 0.45),
            walking_threshold_minutes: Number(
              formData.get("walking_threshold") ?? 15,
            ),
            max_taxi_fare_pence: Math.round(
              Number(formData.get("max_taxi_fare") ?? 15) * 100,
            ),
            luggage_default: (formData.get("luggage_default") as
              | "none"
              | "light"
              | "heavy") ?? "none",
          });
          if (!result.ok) {
            setFeedback(feedbackFromError(result.error));
            return;
          }
          setSavedNote("Saved.");
          router.refresh();
        });
      }}
    >
      <FormError message={feedback?.message} />

      <FormField
        label="Preferred travel mode"
        htmlFor="preferred_mode"
        hint="Scoring nudge: a +15% tiebreaker toward this mode when it's a close call. Legacy options ('rail', 'mixed', 'compare') are kept for older accounts and treated as 'no preference' by the scorer."
        error={feedback?.fieldErrors.preferred_mode}
      >
        <Select
          id="preferred_mode"
          name="preferred_mode"
          defaultValue={initial.preferred_mode}
        >
          <option value="no_preference">No preference</option>
          <option value="walk">Walk</option>
          <option value="drive">Drive</option>
          <option value="taxi">Taxi</option>
        </Select>
      </FormField>

      <FormField
        label="Walking threshold (min)"
        htmlFor="walking_threshold"
        hint="Above this length, the scorer drops walk from the candidates entirely."
      >
        <Input
          id="walking_threshold"
          name="walking_threshold"
          type="number"
          min={0}
          max={60}
          defaultValue={initial.walking_threshold_minutes}
        />
      </FormField>

      <FormField
        label="Taxi spend (£)"
        htmlFor="max_taxi_fare"
        hint="When would a taxi feel like good value vs. a bit much? We'll suggest taxis under this amount, mention it when they're a bit over, and only push more expensive ones when they save significant time."
      >
        <Input
          id="max_taxi_fare"
          name="max_taxi_fare"
          type="number"
          min={5}
          max={40}
          step={1}
          defaultValue={(initial.max_taxi_fare_pence / 100).toFixed(0)}
        />
      </FormField>

      <FormField
        label="Default luggage"
        htmlFor="luggage_default"
        hint="Affects how much walk is penalised. Light = -10, heavy = -25."
      >
        <Select
          id="luggage_default"
          name="luggage_default"
          defaultValue={initial.luggage_default}
        >
          <option value="none">None</option>
          <option value="light">Light</option>
          <option value="heavy">Heavy</option>
        </Select>
      </FormField>

      <FormField
        label="Default driving origin"
        htmlFor="drive_origin"
        hint="Where the planner assumes you'll be driving from."
        error={feedback?.fieldErrors.default_drive_origin_location_id}
      >
        <Select
          id="drive_origin"
          name="drive_origin"
          defaultValue={initial.default_drive_origin_location_id ?? ""}
        >
          {locationOptions("home")}
        </Select>
      </FormField>

      <FormField
        label="Default rail origin"
        htmlFor="rail_origin"
        hint="Your nearest/preferred station."
        error={feedback?.fieldErrors.default_rail_origin_location_id}
      >
        <Select
          id="rail_origin"
          name="rail_origin"
          defaultValue={initial.default_rail_origin_location_id ?? ""}
        >
          {locationOptions("station")}
        </Select>
      </FormField>

      <FormField
        label="Default return location"
        htmlFor="return_location"
        hint="Where you need to get back to (home, office, hotel)."
        error={feedback?.fieldErrors.default_return_location_id}
      >
        <Select
          id="return_location"
          name="return_location"
          defaultValue={initial.default_return_location_id ?? ""}
        >
          {locationOptions()}
        </Select>
      </FormField>

      <FormField
        label="Default rail station"
        htmlFor="rail_hub"
        hint="The station Khonsera assumes when a leg is by train or tube. Brief auto-inserts a transit_departure stop here."
      >
        <TransportHubPicker
          kind="rail_station"
          name="rail_hub"
          value={railHub}
          onChange={setRailHub}
          placeholder="Search a rail station…"
        />
      </FormField>

      <FormField
        label="Default airport"
        htmlFor="flight_hub"
        hint="Used the same way for flight legs."
      >
        <TransportHubPicker
          kind="airport"
          name="flight_hub"
          value={flightHub}
          onChange={setFlightHub}
          placeholder="Search an airport…"
        />
      </FormField>

      <p className="uc" style={{ marginTop: 4 }}>Comfort buffers</p>
      <p
        className="serif-i"
        style={{ fontSize: 13.5, color: "var(--ink-dim)", margin: "-4px 0 0" }}
      >
        How early you like to be, by what you&rsquo;re catching. Khonsera plans
        your departures so you arrive this much ahead — and never warns about the
        slack it built you. Tube and bus changes use a quick 5&nbsp;min.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField
          label="Station buffer (min)"
          htmlFor="arrival_buffer"
          hint="Rail platform — getting to the train."
          error={feedback?.fieldErrors.default_arrival_buffer_minutes}
        >
          <Input
            id="arrival_buffer"
            name="arrival_buffer"
            type="number"
            min={0}
            max={180}
            defaultValue={initial.default_arrival_buffer_minutes}
          />
        </FormField>
        <FormField
          label="Airport buffer (min)"
          htmlFor="airport_buffer"
          hint="Check-in + security before a flight."
          error={feedback?.fieldErrors.default_airport_buffer_minutes}
        >
          <Input
            id="airport_buffer"
            name="airport_buffer"
            type="number"
            min={0}
            max={300}
            defaultValue={initial.default_airport_buffer_minutes}
          />
        </FormField>
        <FormField
          label="Meeting buffer (min)"
          htmlFor="meeting_buffer"
          hint="Arrive a touch early for an appointment."
          error={feedback?.fieldErrors.default_meeting_buffer_minutes}
        >
          <Input
            id="meeting_buffer"
            name="meeting_buffer"
            type="number"
            min={0}
            max={120}
            defaultValue={initial.default_meeting_buffer_minutes}
          />
        </FormField>
      </div>
      <FormField
        label="Return buffer (min)"
        htmlFor="return_buffer"
        hint="Slack when getting back to base."
        error={feedback?.fieldErrors.default_return_buffer_minutes}
      >
        <Input
          id="return_buffer"
          name="return_buffer"
          type="number"
          min={0}
          max={180}
          defaultValue={initial.default_return_buffer_minutes}
        />
      </FormField>

      <FormField
        label="Mileage rate (£/mile)"
        htmlFor="mileage_rate"
        error={feedback?.fieldErrors.mileage_rate}
      >
        <Input
          id="mileage_rate"
          name="mileage_rate"
          type="number"
          step="0.01"
          min={0}
          max={10}
          defaultValue={initial.mileage_rate}
        />
      </FormField>

      <div className="flex items-center gap-3">
        <SubmitButton pending={pending}>Save preferences</SubmitButton>
        {savedNote ? <span className="text-xs text-muted-foreground">{savedNote}</span> : null}
      </div>
    </form>
  );
}

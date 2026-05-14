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

type LocationOption = { id: string; name: string; type: LocationType };

export function TravelProfileForm({
  initial,
  locations,
}: {
  initial: {
    default_drive_origin_location_id: string | null;
    default_rail_origin_location_id: string | null;
    default_return_location_id: string | null;
    preferred_mode: TravelModePreference;
    default_arrival_buffer_minutes: number;
    default_return_buffer_minutes: number;
    mileage_rate: number;
  };
  locations: LocationOption[];
}) {
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
            preferred_mode: formData.get("preferred_mode") as TravelModePreference,
            default_arrival_buffer_minutes: Number(formData.get("arrival_buffer") ?? 15),
            default_return_buffer_minutes: Number(formData.get("return_buffer") ?? 15),
            mileage_rate: Number(formData.get("mileage_rate") ?? 0.45),
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
        error={feedback?.fieldErrors.preferred_mode}
      >
        <Select
          id="preferred_mode"
          name="preferred_mode"
          defaultValue={initial.preferred_mode}
        >
          <option value="compare">Compare rail and drive</option>
          <option value="rail">Rail</option>
          <option value="drive">Drive</option>
          <option value="mixed">Mixed</option>
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

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Arrival buffer (min)"
          htmlFor="arrival_buffer"
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
          label="Return buffer (min)"
          htmlFor="return_buffer"
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
      </div>

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

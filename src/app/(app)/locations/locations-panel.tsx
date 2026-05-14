"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  FormError,
  FormField,
  Input,
  Select,
  SubmitButton,
  Textarea,
} from "@/components/ui/form";
import { createLocation, deleteLocation } from "@/lib/actions/locations";
import { feedbackFromError, type FormFeedback } from "@/lib/actions/_form";
import type { LocationType } from "@/lib/types/domain";

type Location = {
  id: string;
  name: string;
  type: LocationType;
  address: string | null;
  postcode: string | null;
  notes: string | null;
};

const TYPES: LocationType[] = [
  "home",
  "office",
  "station",
  "hotel",
  "parking",
  "other",
];

const TYPE_LABEL: Record<LocationType, string> = {
  home: "Home",
  office: "Office",
  station: "Station",
  hotel: "Hotel",
  customer_site: "Customer site",
  parking: "Parking",
  other: "Other",
};

export function LocationsPanel({ locations }: { locations: Location[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(locations.length === 0);

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteLocation(id);
      setDeletingId(null);
      if (!result.ok) {
        setFeedback(feedbackFromError(result.error));
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <FormError message={feedback?.message} />

      {locations.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {locations.map((l) => (
            <li key={l.id} className="flex items-start justify-between gap-2 p-4 text-sm">
              <div>
                <p className="font-medium">
                  {l.name}
                  <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground">
                    {TYPE_LABEL[l.type]}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {[l.address, l.postcode].filter(Boolean).join(", ") || "no address"}
                </p>
                {l.notes ? <p className="mt-1 text-xs">{l.notes}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(l.id, l.name)}
                disabled={pending && deletingId === l.id}
                className="text-xs text-destructive hover:underline disabled:opacity-50"
              >
                {deletingId === l.id ? "…" : "Delete"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No locations yet — add your home and office to get started.
        </p>
      )}

      {showForm ? (
        <form
          className="grid gap-3 rounded-md border border-dashed border-border p-4 md:grid-cols-2"
          action={(formData) => {
            startTransition(async () => {
              setFeedback(null);
              const result = await createLocation({
                name: String(formData.get("name") ?? ""),
                type: String(formData.get("type") ?? "other") as LocationType,
                address: String(formData.get("address") ?? "") || null,
                postcode: String(formData.get("postcode") ?? "") || null,
                notes: String(formData.get("notes") ?? "") || null,
              });
              if (!result.ok) {
                setFeedback(feedbackFromError(result.error));
                return;
              }
              setShowForm(false);
              router.refresh();
            });
          }}
        >
          <FormField label="Name" htmlFor="loc-name" error={feedback?.fieldErrors.name}>
            <Input id="loc-name" name="name" required placeholder="e.g. Home" />
          </FormField>
          <FormField label="Type" htmlFor="loc-type" error={feedback?.fieldErrors.type}>
            <Select id="loc-type" name="type" defaultValue="home">
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Address" htmlFor="loc-address" error={feedback?.fieldErrors.address}>
            <Input id="loc-address" name="address" />
          </FormField>
          <FormField label="Postcode" htmlFor="loc-postcode" error={feedback?.fieldErrors.postcode}>
            <Input id="loc-postcode" name="postcode" maxLength={16} />
          </FormField>
          <FormField label="Notes" htmlFor="loc-notes" error={feedback?.fieldErrors.notes}>
            <Textarea id="loc-notes" name="notes" rows={2} />
          </FormField>
          <div className="flex items-end gap-2">
            <SubmitButton pending={pending}>Add location</SubmitButton>
            {locations.length > 0 ? (
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1.5 text-sm"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-fit rounded-md border border-border px-3 py-1.5 text-sm"
        >
          + Add location
        </button>
      )}
    </div>
  );
}

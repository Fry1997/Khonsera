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
import {
  createLocation,
  deleteLocation,
  updateLocation,
} from "@/lib/actions/locations";
import { feedbackFromError, type FormFeedback } from "@/lib/actions/_form";
import {
  PlacePicker,
  type PlaceSelection,
} from "@/components/place-picker";
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);
  const [showAddForm, setShowAddForm] = useState(locations.length === 0);

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    setBusyId(id);
    startTransition(async () => {
      const result = await deleteLocation(id);
      setBusyId(null);
      if (!result.ok) {
        setFeedback(feedbackFromError(result.error));
        return;
      }
      router.refresh();
    });
  };

  const [quickPicked, setQuickPicked] = useState<PlaceSelection | null>(null);
  // Quick-add via Google Places — the PlacePicker materialises the chosen
  // place into the locations table on the server. We just refresh once it's
  // done.
  const handleQuickPick = (selection: PlaceSelection | null) => {
    setQuickPicked(selection);
    if (selection?.kind === "location") {
      // PlacePicker already inserted the row + geocoded; just refresh.
      router.refresh();
      setQuickPicked(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <FormError message={feedback?.message} />

      <div className="k-card-soft flex flex-col gap-2 p-4">
        <p className="uc">Quick add · search anywhere</p>
        <PlacePicker
          customers={[]}
          customerSites={[]}
          locations={[]}
          showCustomers={false}
          value={quickPicked}
          onChange={handleQuickPick}
          placeholder="Search a station, hotel, office or address…"
        />
        <p className="small">
          Pick a result from Google to save it instantly, or type a new name
          and choose "add as a new place".
        </p>
      </div>

      {locations.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {locations.map((l) =>
            editingId === l.id ? (
              <li key={l.id} className="p-4">
                <LocationForm
                  location={l}
                  pending={pending && busyId === l.id}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(values) => {
                    setBusyId(l.id);
                    startTransition(async () => {
                      setFeedback(null);
                      const result = await updateLocation({
                        id: l.id,
                        ...values,
                      });
                      setBusyId(null);
                      if (!result.ok) {
                        setFeedback(feedbackFromError(result.error));
                        return;
                      }
                      setEditingId(null);
                      router.refresh();
                    });
                  }}
                />
              </li>
            ) : (
              <li
                key={l.id}
                className="flex items-start justify-between gap-2 p-4 text-sm"
              >
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
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFeedback(null);
                      setEditingId(l.id);
                    }}
                    className="text-xs hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(l.id, l.name)}
                    disabled={pending && busyId === l.id}
                    className="text-xs text-destructive hover:underline disabled:opacity-50"
                  >
                    {busyId === l.id ? "…" : "Delete"}
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No locations yet — add your home and office to get started.
        </p>
      )}

      {showAddForm ? (
        <LocationForm
          pending={pending && busyId === "new"}
          onCancel={locations.length > 0 ? () => setShowAddForm(false) : undefined}
          onSubmit={(values) => {
            setBusyId("new");
            startTransition(async () => {
              setFeedback(null);
              const result = await createLocation(values);
              setBusyId(null);
              if (!result.ok) {
                setFeedback(feedbackFromError(result.error));
                return;
              }
              setShowAddForm(false);
              router.refresh();
            });
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="w-fit rounded-md border border-border px-3 py-1.5 text-sm"
        >
          + Add location
        </button>
      )}
    </div>
  );
}

function LocationForm({
  location,
  pending,
  onCancel,
  onSubmit,
}: {
  location?: Location;
  pending: boolean;
  onCancel?: () => void;
  onSubmit: (values: {
    name: string;
    type: LocationType;
    address: string | null;
    postcode: string | null;
    notes: string | null;
  }) => void;
}) {
  const idSuffix = location?.id ?? "new";
  return (
    <form
      className="grid gap-3 rounded-md border border-dashed border-border p-4 md:grid-cols-2"
      action={(formData) => {
        onSubmit({
          name: String(formData.get("name") ?? ""),
          type: String(formData.get("type") ?? "other") as LocationType,
          address: String(formData.get("address") ?? "") || null,
          postcode: String(formData.get("postcode") ?? "") || null,
          notes: String(formData.get("notes") ?? "") || null,
        });
      }}
    >
      <FormField label="Name" htmlFor={`loc-name-${idSuffix}`}>
        <Input
          id={`loc-name-${idSuffix}`}
          name="name"
          required
          defaultValue={location?.name ?? ""}
          placeholder="e.g. Home"
        />
      </FormField>
      <FormField label="Type" htmlFor={`loc-type-${idSuffix}`}>
        <Select
          id={`loc-type-${idSuffix}`}
          name="type"
          defaultValue={location?.type ?? "home"}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Address" htmlFor={`loc-address-${idSuffix}`}>
        <Input
          id={`loc-address-${idSuffix}`}
          name="address"
          defaultValue={location?.address ?? ""}
        />
      </FormField>
      <FormField label="Postcode" htmlFor={`loc-postcode-${idSuffix}`}>
        <Input
          id={`loc-postcode-${idSuffix}`}
          name="postcode"
          maxLength={16}
          defaultValue={location?.postcode ?? ""}
        />
      </FormField>
      <FormField label="Notes" htmlFor={`loc-notes-${idSuffix}`}>
        <Textarea
          id={`loc-notes-${idSuffix}`}
          name="notes"
          rows={2}
          defaultValue={location?.notes ?? ""}
        />
      </FormField>
      <div className="flex items-end gap-2">
        <SubmitButton pending={pending}>{location ? "Save" : "Add location"}</SubmitButton>
        {onCancel ? (
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-sm"
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

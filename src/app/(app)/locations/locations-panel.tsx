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
  const [notice, setNotice] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(locations.length === 0);

  // Optimistic removal — the row disappears immediately; reverts if the delete
  // fails. (Was: rely on router.refresh, and deleteLocation didn't revalidate, so
  // the row lingered until a manual refresh.)
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    setHidden((prev) => new Set(prev).add(id));
    startTransition(async () => {
      const result = await deleteLocation(id);
      if (!result.ok) {
        setHidden((prev) => { const n = new Set(prev); n.delete(id); return n; });
        setFeedback(feedbackFromError(result.error));
        return;
      }
      router.refresh();
    });
  };

  const [quickPicked, setQuickPicked] = useState<PlaceSelection | null>(null);
  // Quick-add via Google Places — the PlacePicker materialises the chosen place
  // into the locations table on the server (createInlineLocation now revalidates
  // /locations, so the new row appears reliably). Confirm it visibly.
  const handleQuickPick = (selection: PlaceSelection | null) => {
    setQuickPicked(selection);
    if (selection?.kind === "location") {
      setNotice(`Saved ${selection.label}.`);
      router.refresh();
      setQuickPicked(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <FormError message={feedback?.message} />
      {notice ? <p className="cc-save-notice" style={{ color: "var(--success)", fontSize: 13 }}>{notice}</p> : null}

      <div
        className="card-hero"
        style={{
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span className="uc">Search anywhere</span>
          <span
            className="serif-i"
            style={{ fontSize: 13.5, color: "var(--gold-2)" }}
          >
            powered by Google
          </span>
        </div>
        <PlacePicker
          customers={[]}
          customerSites={[]}
          locations={[]}
          showCustomers={false}
          value={quickPicked}
          onChange={handleQuickPick}
          placeholder="Station, hotel, office or address…"
        />
        <p
          className="serif-i"
          style={{ fontSize: 13.5, color: "var(--ink-dim)", margin: 0 }}
        >
          Pick a result to save it instantly — Khonsera stores the address,
          postcode and coordinates. Or type a fresh name and choose{" "}
          <em style={{ color: "var(--gold)" }}>add as a new place</em>.
        </p>
      </div>

      {locations.length > 0 ? (
        <div
          className="card"
          style={{ padding: 0, overflow: "hidden" }}
        >
          {locations.filter((l) => !hidden.has(l.id)).map((l, i) =>
            editingId === l.id ? (
              <div
                key={l.id}
                style={{
                  padding: 16,
                  borderTop: i === 0 ? 0 : "1px solid var(--rule)",
                }}
              >
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
              </div>
            ) : (
              <div
                key={l.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "14px 18px",
                  borderTop: i === 0 ? 0 : "1px solid var(--rule)",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--sans)",
                        fontWeight: 600,
                        fontSize: 14.5,
                        color: "var(--ink)",
                      }}
                    >
                      {l.name}
                    </span>
                    <span className="pill pill-soft">{TYPE_LABEL[l.type]}</span>
                  </div>
                  <p
                    style={{
                      fontSize: 12.5,
                      color: "var(--ink-dim)",
                      marginTop: 2,
                    }}
                  >
                    {[l.address, l.postcode].filter(Boolean).join(", ") ||
                      "no address"}
                  </p>
                  {l.notes ? (
                    <p
                      style={{
                        marginTop: 4,
                        fontSize: 12.5,
                        color: "var(--ink-dim)",
                      }}
                    >
                      {l.notes}
                    </p>
                  ) : null}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 4,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setFeedback(null);
                      setEditingId(l.id);
                    }}
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "var(--gold-2)",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(l.id, l.name)}
                    disabled={pending && busyId === l.id}
                    style={{
                      fontSize: 11.5,
                      color: "var(--rust)",
                      opacity: pending && busyId === l.id ? 0.5 : 1,
                    }}
                  >
                    {busyId === l.id ? "…" : "Delete"}
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      ) : null}

      {showAddForm ? (
        <LocationForm
          pending={pending && busyId === "new"}
          onCancel={
            locations.length > 0 ? () => setShowAddForm(false) : undefined
          }
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
          className="btn btn-ghost btn-sm"
          style={{ alignSelf: "flex-start" }}
        >
          + Add manually
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
      className="card"
      style={{
        padding: 18,
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      }}
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
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
        }}
      >
        <SubmitButton pending={pending}>
          {location ? "Save" : "Add location"}
        </SubmitButton>
        {onCancel ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

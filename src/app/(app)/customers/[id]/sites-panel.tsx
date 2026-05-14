"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormError, FormField, Input, SubmitButton, Textarea } from "@/components/ui/form";
import {
  createCustomerSite,
  deleteCustomerSite,
  updateCustomerSite,
} from "@/lib/actions/sites";
import { feedbackFromError, type FormFeedback } from "@/lib/actions/_form";

type Site = {
  id: string;
  name: string | null;
  address: string | null;
  postcode: string | null;
  parking_notes: string | null;
  nearest_station_notes: string | null;
};

export function SitesPanel({
  customerId,
  sites,
}: {
  customerId: string;
  sites: Site[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);
  const [showAddForm, setShowAddForm] = useState(sites.length === 0);

  const handleDelete = (id: string) => {
    if (!window.confirm("Delete this site?")) return;
    setBusyId(id);
    startTransition(async () => {
      const result = await deleteCustomerSite(id);
      setBusyId(null);
      if (!result.ok) {
        setFeedback(feedbackFromError(result.error));
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <FormError message={feedback?.message} />

      {sites.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {sites.map((s) =>
            editingId === s.id ? (
              <li key={s.id} className="p-3">
                <SiteEditForm
                  site={s}
                  pending={pending && busyId === s.id}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(values) => {
                    setBusyId(s.id);
                    startTransition(async () => {
                      setFeedback(null);
                      const result = await updateCustomerSite({
                        id: s.id,
                        customer_id: customerId,
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
              <li key={s.id} className="p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-medium">{s.name ?? "(unnamed site)"}</p>
                    <p className="text-xs text-muted-foreground">
                      {[s.address, s.postcode].filter(Boolean).join(", ") || "no address"}
                    </p>
                    {s.parking_notes ? (
                      <p className="mt-1 text-xs">Parking: {s.parking_notes}</p>
                    ) : null}
                    {s.nearest_station_notes ? (
                      <p className="text-xs">Station: {s.nearest_station_notes}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setFeedback(null);
                        setEditingId(s.id);
                      }}
                      className="text-xs hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      disabled={pending && busyId === s.id}
                      className="text-xs text-destructive hover:underline disabled:opacity-50"
                    >
                      {busyId === s.id ? "…" : "Delete"}
                    </button>
                  </div>
                </div>
              </li>
            ),
          )}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No sites yet.</p>
      )}

      {showAddForm ? (
        <SiteEditForm
          pending={pending && busyId === "new"}
          onCancel={sites.length > 0 ? () => setShowAddForm(false) : undefined}
          onSubmit={(values) => {
            setBusyId("new");
            startTransition(async () => {
              setFeedback(null);
              const result = await createCustomerSite({
                customer_id: customerId,
                ...values,
              });
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
          + Add site
        </button>
      )}
    </div>
  );
}

// Single form used for both add and edit. Empty `site` = add mode.
function SiteEditForm({
  site,
  pending,
  onCancel,
  onSubmit,
}: {
  site?: Site;
  pending: boolean;
  onCancel?: () => void;
  onSubmit: (values: {
    name: string | null;
    address: string | null;
    postcode: string | null;
    parking_notes: string | null;
    nearest_station_notes: string | null;
  }) => void;
}) {
  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-dashed border-border p-3"
      action={(formData) => {
        onSubmit({
          name: String(formData.get("name") ?? "") || null,
          address: String(formData.get("address") ?? "") || null,
          postcode: String(formData.get("postcode") ?? "") || null,
          parking_notes: String(formData.get("parking_notes") ?? "") || null,
          nearest_station_notes: String(formData.get("nearest_station_notes") ?? "") || null,
        });
      }}
    >
      <FormField label="Site name" htmlFor={`site-name-${site?.id ?? "new"}`}>
        <Input
          id={`site-name-${site?.id ?? "new"}`}
          name="name"
          defaultValue={site?.name ?? ""}
          placeholder="e.g. Belper office"
        />
      </FormField>
      <FormField label="Address" htmlFor={`site-address-${site?.id ?? "new"}`}>
        <Input
          id={`site-address-${site?.id ?? "new"}`}
          name="address"
          defaultValue={site?.address ?? ""}
        />
      </FormField>
      <FormField label="Postcode" htmlFor={`site-postcode-${site?.id ?? "new"}`}>
        <Input
          id={`site-postcode-${site?.id ?? "new"}`}
          name="postcode"
          defaultValue={site?.postcode ?? ""}
          maxLength={16}
        />
      </FormField>
      <FormField label="Parking notes" htmlFor={`site-parking-${site?.id ?? "new"}`}>
        <Textarea
          id={`site-parking-${site?.id ?? "new"}`}
          name="parking_notes"
          defaultValue={site?.parking_notes ?? ""}
          rows={2}
        />
      </FormField>
      <FormField label="Nearest station notes" htmlFor={`site-station-${site?.id ?? "new"}`}>
        <Textarea
          id={`site-station-${site?.id ?? "new"}`}
          name="nearest_station_notes"
          defaultValue={site?.nearest_station_notes ?? ""}
          rows={2}
        />
      </FormField>
      <div className="flex gap-2">
        <SubmitButton pending={pending}>{site ? "Save" : "Add site"}</SubmitButton>
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

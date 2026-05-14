"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormError, FormField, Input, SubmitButton } from "@/components/ui/form";
import { createContact, deleteContact, updateContact } from "@/lib/actions/contacts";
import { feedbackFromError, type FormFeedback } from "@/lib/actions/_form";

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
};

export function ContactsPanel({
  customerId,
  contacts,
}: {
  customerId: string;
  contacts: Contact[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);

  const handleDelete = (id: string) => {
    if (!window.confirm("Delete this contact?")) return;
    setBusyId(id);
    startTransition(async () => {
      const result = await deleteContact(id);
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
      {contacts.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {contacts.map((c) =>
            editingId === c.id ? (
              <li key={c.id} className="p-3">
                <ContactForm
                  contact={c}
                  pending={pending && busyId === c.id}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(values) => {
                    setBusyId(c.id);
                    startTransition(async () => {
                      setFeedback(null);
                      const result = await updateContact({
                        id: c.id,
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
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 p-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {c.name}
                    {c.role ? <span className="text-muted-foreground"> · {c.role}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[c.email, c.phone].filter(Boolean).join(" · ") || "no contact details"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFeedback(null);
                      setEditingId(c.id);
                    }}
                    className="text-xs hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    disabled={pending && busyId === c.id}
                    className="text-xs text-destructive hover:underline disabled:opacity-50"
                  >
                    {busyId === c.id ? "…" : "Delete"}
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No contacts yet.</p>
      )}

      <ContactForm
        pending={pending && busyId === "new"}
        onSubmit={(values) => {
          setBusyId("new");
          startTransition(async () => {
            setFeedback(null);
            const result = await createContact({
              customer_id: customerId,
              name: values.name ?? "",
              email: values.email,
              phone: values.phone,
              role: values.role,
            });
            setBusyId(null);
            if (!result.ok) {
              setFeedback(feedbackFromError(result.error));
              return;
            }
            router.refresh();
          });
        }}
      />
    </div>
  );
}

function ContactForm({
  contact,
  pending,
  onCancel,
  onSubmit,
}: {
  contact?: Contact;
  pending: boolean;
  onCancel?: () => void;
  onSubmit: (values: {
    name: string;
    email: string | null;
    phone: string | null;
    role: string | null;
  }) => void;
}) {
  const idSuffix = contact?.id ?? "new";
  return (
    <form
      className="grid gap-2 rounded-md border border-dashed border-border p-3 md:grid-cols-2 md:items-end md:gap-3"
      action={(formData) => {
        onSubmit({
          name: String(formData.get("name") ?? ""),
          email: String(formData.get("email") ?? "") || null,
          phone: String(formData.get("phone") ?? "") || null,
          role: String(formData.get("role") ?? "") || null,
        });
      }}
    >
      <FormField label="Name" htmlFor={`contact-name-${idSuffix}`}>
        <Input
          id={`contact-name-${idSuffix}`}
          name="name"
          required
          maxLength={200}
          defaultValue={contact?.name ?? ""}
        />
      </FormField>
      <FormField label="Role" htmlFor={`contact-role-${idSuffix}`}>
        <Input
          id={`contact-role-${idSuffix}`}
          name="role"
          defaultValue={contact?.role ?? ""}
        />
      </FormField>
      <FormField label="Email" htmlFor={`contact-email-${idSuffix}`}>
        <Input
          id={`contact-email-${idSuffix}`}
          name="email"
          type="email"
          defaultValue={contact?.email ?? ""}
        />
      </FormField>
      <FormField label="Phone" htmlFor={`contact-phone-${idSuffix}`}>
        <Input
          id={`contact-phone-${idSuffix}`}
          name="phone"
          defaultValue={contact?.phone ?? ""}
        />
      </FormField>
      <div className="flex gap-2 md:col-span-2">
        <SubmitButton pending={pending}>{contact ? "Save" : "Add contact"}</SubmitButton>
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

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormError, FormField, Input, SubmitButton } from "@/components/ui/form";
import { createContact, deleteContact } from "@/lib/actions/contacts";
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
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    if (!window.confirm("Delete this contact?")) return;
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteContact(id);
      setDeletingId(null);
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
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 p-3 text-sm">
              <div>
                <p className="font-medium">
                  {c.name}
                  {c.role ? <span className="text-muted-foreground"> · {c.role}</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[c.email, c.phone].filter(Boolean).join(" · ") || "no contact details"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(c.id)}
                disabled={pending && deletingId === c.id}
                className="text-xs text-destructive hover:underline disabled:opacity-50"
              >
                {deletingId === c.id ? "…" : "Delete"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No contacts yet.</p>
      )}

      <form
        className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3 md:grid md:grid-cols-2 md:items-end md:gap-3"
        action={(formData) => {
          startTransition(async () => {
            setFeedback(null);
            const result = await createContact({
              customer_id: customerId,
              name: String(formData.get("name") ?? ""),
              email: String(formData.get("email") ?? "") || null,
              phone: String(formData.get("phone") ?? "") || null,
              role: String(formData.get("role") ?? "") || null,
            });
            if (!result.ok) {
              setFeedback(feedbackFromError(result.error));
              return;
            }
            (formData as unknown as { reset?: () => void }).reset?.();
            router.refresh();
          });
        }}
      >
        <FormField label="Name" htmlFor="contact-name" error={feedback?.fieldErrors.name}>
          <Input id="contact-name" name="name" required maxLength={200} />
        </FormField>
        <FormField label="Role" htmlFor="contact-role" error={feedback?.fieldErrors.role}>
          <Input id="contact-role" name="role" />
        </FormField>
        <FormField label="Email" htmlFor="contact-email" error={feedback?.fieldErrors.email}>
          <Input id="contact-email" name="email" type="email" />
        </FormField>
        <FormField label="Phone" htmlFor="contact-phone" error={feedback?.fieldErrors.phone}>
          <Input id="contact-phone" name="phone" />
        </FormField>
        <div className="md:col-span-2">
          <SubmitButton pending={pending}>Add contact</SubmitButton>
        </div>
      </form>
    </div>
  );
}

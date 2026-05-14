"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormError, FormField, Input, SubmitButton, Textarea } from "@/components/ui/form";
import { updateCustomer } from "@/lib/actions/customers";
import { feedbackFromError, type FormFeedback } from "@/lib/actions/_form";

export function CustomerEditForm({
  customer,
}: {
  customer: { id: string; name: string; notes: string | null };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-3"
      action={(formData) => {
        startTransition(async () => {
          setFeedback(null);
          setSavedNote(null);
          const result = await updateCustomer({
            id: customer.id,
            name: String(formData.get("name") ?? ""),
            notes: String(formData.get("notes") ?? "") || null,
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
      <FormField label="Name" htmlFor="name" error={feedback?.fieldErrors.name}>
        <Input id="name" name="name" defaultValue={customer.name} required maxLength={200} />
      </FormField>
      <FormField label="Notes" htmlFor="notes" error={feedback?.fieldErrors.notes}>
        <Textarea id="notes" name="notes" defaultValue={customer.notes ?? ""} maxLength={2000} />
      </FormField>
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending}>Save</SubmitButton>
        {savedNote ? <span className="text-xs text-muted-foreground">{savedNote}</span> : null}
      </div>
    </form>
  );
}

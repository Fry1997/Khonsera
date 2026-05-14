"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormError, FormField, Input, SubmitButton, Textarea } from "@/components/ui/form";
import { createCustomer } from "@/lib/actions/customers";
import { feedbackFromError, type FormFeedback } from "@/lib/actions/_form";

export function NewCustomerForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);

  return (
    <form
      className="flex flex-col gap-4"
      action={(formData) => {
        startTransition(async () => {
          setFeedback(null);
          const result = await createCustomer({
            name: String(formData.get("name") ?? ""),
            notes: String(formData.get("notes") ?? "") || null,
          });
          if (!result.ok) {
            setFeedback(feedbackFromError(result.error));
            return;
          }
          router.push(`/customers/${result.value.id}`);
          router.refresh();
        });
      }}
    >
      <FormError message={feedback?.message} />
      <FormField label="Name" htmlFor="name" error={feedback?.fieldErrors.name}>
        <Input id="name" name="name" required maxLength={200} autoFocus />
      </FormField>
      <FormField label="Notes" htmlFor="notes" error={feedback?.fieldErrors.notes}>
        <Textarea id="notes" name="notes" maxLength={2000} />
      </FormField>
      <div className="flex gap-2">
        <SubmitButton pending={pending}>Create customer</SubmitButton>
      </div>
    </form>
  );
}

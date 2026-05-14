"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteCustomer } from "@/lib/actions/customers";
import { feedbackFromError } from "@/lib/actions/_form";
import { FormError } from "@/components/ui/form";

export function DeleteCustomerButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onDelete = () => {
    if (!window.confirm(`Delete ${name}? Sites, contacts and any linked visits go with it.`)) {
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await deleteCustomer(id);
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      router.push("/customers");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <FormError message={error ?? undefined} />
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="w-fit rounded-md border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/5 disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete customer"}
      </button>
    </div>
  );
}

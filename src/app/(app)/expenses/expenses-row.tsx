"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteExpense, setReimbursementStatus } from "@/lib/actions/expenses";
import { feedbackFromError } from "@/lib/actions/_form";
import { FormError } from "@/components/ui/form";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "reimbursed", label: "Reimbursed" },
] as const;

const STATUS_COLOR: Record<string, string> = {
  draft: "var(--ink-dim)",
  submitted: "var(--amber)",
  approved: "var(--sage)",
  rejected: "var(--rust)",
  reimbursed: "var(--sage)",
};

export function ExpensesRow({
  expense,
}: {
  expense: {
    id: string;
    type: string;
    typeLabel: string;
    amount: number | null;
    currency: string;
    reimbursementStatus: string;
    notes: string | null;
    createdAt: string;
    itinerary: { id: string; label: string } | null;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(expense.reimbursementStatus);
  const [error, setError] = useState<string | null>(null);

  const onStatusChange = (next: string) => {
    const previous = status;
    setStatus(next);
    startTransition(async () => {
      setError(null);
      const result = await setReimbursementStatus({
        id: expense.id,
        reimbursement_status: next as never,
      });
      if (!result.ok) {
        setStatus(previous);
        setError(feedbackFromError(result.error).message);
        return;
      }
      router.refresh();
    });
  };

  const onDelete = () => {
    if (!window.confirm("Delete this expense?")) return;
    startTransition(async () => {
      setError(null);
      const result = await deleteExpense(expense.id);
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      router.refresh();
    });
  };

  const amount = expense.amount
    ? new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: expense.currency,
      }).format(expense.amount)
    : "—";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="font-medium">{expense.typeLabel}</span>
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: STATUS_COLOR[status] ?? "var(--ink-faint)" }}
          />
          <span className="small">{expense.createdAt}</span>
        </div>
        {expense.itinerary ? (
          <Link
            href={`/itineraries/${expense.itinerary.id}`}
            className="small truncate hover:underline"
          >
            {expense.itinerary.label}
          </Link>
        ) : null}
        {expense.notes ? (
          <p className="small line-clamp-1 text-ink-faint">{expense.notes}</p>
        ) : null}
        <FormError message={error ?? undefined} />
      </div>
      <div className="flex items-center gap-3">
        <span className="mono text-base font-medium text-ink">{amount}</span>
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          disabled={pending}
          className="input-base"
          style={{ width: "auto", padding: "6px 8px", fontSize: 12 }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="text-xs text-rust hover:underline disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

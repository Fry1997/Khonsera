"use client";

import type { ContactVM, ExpenseVM, TaskVM } from "./types";
import { formatMoney } from "./types";

// ContactChip / TaskRow / ExpenseRow — the people & ledger primitives (§4.8–4.10).

const CHANNEL_LABEL: Record<NonNullable<ContactVM["channel"]>, string> = {
  phone: "Phone",
  email: "Email",
  whatsapp: "WhatsApp",
};

export function ContactChip({
  contact,
  onSelect,
}: {
  contact: ContactVM;
  onSelect?: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className="chip"
      onClick={onSelect ? () => onSelect(contact.id) : undefined}
    >
      <span className="text-ink">{contact.name}</span>
      {contact.channel ? (
        <span className="tiny" style={{ color: "var(--ink-soft)" }}>
          {" "}
          · {CHANNEL_LABEL[contact.channel]}
        </span>
      ) : null}
    </button>
  );
}

export function TaskRow({
  task,
  onToggle,
}: {
  task: TaskVM;
  onToggle?: (id: string, done: boolean) => void;
}) {
  return (
    <label
      className="row flex items-center gap-3 rounded-field p-3"
      style={{ background: "var(--card-2)", cursor: "pointer" }}
    >
      <input
        type="checkbox"
        checked={task.done}
        onChange={(e) => onToggle?.(task.id, e.target.checked)}
      />
      <span
        className="text-ink flex-1"
        style={
          task.done
            ? { textDecoration: "line-through", color: "var(--ink-soft)" }
            : undefined
        }
      >
        {task.title}
      </span>
      {task.due ? <span className="mono small">{task.due}</span> : null}
    </label>
  );
}

export function ExpenseRow({ expense }: { expense: ExpenseVM }) {
  return (
    <div
      className="row flex items-center justify-between gap-3 rounded-field p-3"
      style={{ background: "var(--card-2)" }}
    >
      <div>
        <p className="text-ink">{expense.category ?? "Expense"}</p>
        {expense.date ? <p className="tiny">{expense.date}</p> : null}
      </div>
      <span className="mono text-ink">
        {formatMoney(expense.amount, expense.currency)}
      </span>
    </div>
  );
}

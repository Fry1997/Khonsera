"use client";

import type { ContactVM, ExpenseVM, TaskVM } from "./types";
import { formatMoney } from "./types";

// People & ledger primitives, rebuilt to Design's contract (`.cc-task-row` /
// `.cc-expense-row` / `.cc-contact-chip`). (Round 1 components · Round 2 classes.)

export function TaskRow({
  task,
  onToggle,
}: {
  task: TaskVM;
  onToggle?: (id: string, done: boolean) => void;
}) {
  return (
    <div className="cc-task-row" data-done={task.done ? "true" : "false"}>
      <button
        type="button"
        className="cc-task-tick"
        aria-label={task.done ? "Mark not done" : "Mark done"}
        onClick={() => onToggle?.(task.id, !task.done)}
        style={{ cursor: "pointer", padding: 0 }}
      />
      <span className="cc-task-title">{task.title}</span>
      {task.due ? <span className="cc-task-due">{task.due}</span> : null}
    </div>
  );
}

export function ExpenseRow({ expense }: { expense: ExpenseVM }) {
  return (
    <div className="cc-expense-row">
      <div>
        <p className="cc-expense-cat">{expense.category ?? "Expense"}</p>
        {expense.date ? <p className="tiny" style={{ marginTop: 2 }}>{expense.date}</p> : null}
      </div>
      <span className="cc-expense-amt">{formatMoney(expense.amount, expense.currency)}</span>
    </div>
  );
}

const CH: Record<NonNullable<ContactVM["channel"]>, string> = {
  phone: "M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  email: "M4 6h16v12H4z M4 7l8 6 8-6",
  whatsapp: "M12 3a9 9 0 0 0-8 13l-1 5 5-1a9 9 0 1 0 4-17z M8 10c0 4 2 6 6 6",
};

export function ContactChip({
  contact,
  onSelect,
}: {
  contact: ContactVM;
  onSelect?: (id: string) => void;
}) {
  const initials = contact.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <button
      type="button"
      className="cc-contact-chip"
      data-bound={contact.channel ? "true" : "false"}
      onClick={onSelect ? () => onSelect(contact.id) : undefined}
      style={{ cursor: onSelect ? "pointer" : "default" }}
    >
      <span className="cc-contact-avatar">{initials || "·"}</span>
      <span className="cc-contact-name">{contact.name}</span>
      {contact.channel ? (
        <span className="cc-contact-ch" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d={CH[contact.channel]} />
          </svg>
        </span>
      ) : null}
    </button>
  );
}

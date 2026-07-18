"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ContactChip } from "@/components/concierge";
import type { ContactVM } from "@/components/concierge";
import { EmptyStateActions } from "@/components/ui/empty-state-actions";
import { createContactQuick } from "@/lib/actions/contact-search";

// People — Design Round 2 secondary template: .cc-add + a .cc-contact-chip grid,
// the faint-emblem empty state.
export function ContactsScreen({ initial }: { initial: ContactVM[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    const t = name.trim();
    if (!t) return;
    startTransition(async () => {
      const res = await createContactQuick({ name: t });
      if (res.ok) {
        setName("");
        router.refresh();
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <label className="cc-add">
        <span className="ic" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </span>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add someone by name"
          style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 15, color: "var(--ink)" }}
          disabled={pending}
        />
      </label>

      {initial.length === 0 ? (
        <EmptyStateActions
          title="No people or clients yet"
          description="Add them once, then attach them to visits and meeting days in Plan."
          actions={[{ label: "Add client", href: "/customers/new", variant: "secondary" }]}
        >
          <button type="button" className="cc-btn cc-btn-gold" onClick={() => inputRef.current?.focus()}>
            Add person
          </button>
        </EmptyStateActions>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          {initial.map((c) => <ContactChip key={c.id} contact={c} />)}
        </div>
      )}
    </div>
  );
}

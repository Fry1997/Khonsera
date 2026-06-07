"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ContactChip } from "@/components/concierge";
import type { ContactVM } from "@/components/concierge";
import { createContactQuick } from "@/lib/actions/contact-search";

// Contacts surface — ContactChip grid over the mode-scoped contacts table, with a
// quick-add (decoupled from the legacy customer linkage via createContactQuick).
export function ContactsScreen({ initial }: { initial: ContactVM[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const res = await createContactQuick({ name: trimmed });
      if (!res.ok) {
        setError("Could not add that contact.");
        return;
      }
      setName("");
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div className="row flex items-center gap-2">
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Add someone by name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
        />
        <button
          type="button"
          className="btn btn-gold"
          onClick={add}
          disabled={pending || !name.trim()}
        >
          Add
        </button>
      </div>
      {error ? (
        <p className="small" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      ) : null}

      {initial.length === 0 ? (
        <div className="j-card p-6" style={{ textAlign: "center" }}>
          <p className="small">
            No contacts yet. Add the people you meet and travel to see — Khonsera
            keeps them close to the days they belong to.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap" style={{ gap: "var(--space-2)" }}>
          {initial.map((c) => (
            <ContactChip key={c.id} contact={c} />
          ))}
        </div>
      )}
    </div>
  );
}

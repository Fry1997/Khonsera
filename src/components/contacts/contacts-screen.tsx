"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ContactChip } from "@/components/concierge";
import type { ContactVM } from "@/components/concierge";
import { createContactQuick } from "@/lib/actions/contact-search";

// People — Design Round 2 secondary template: .cc-add + a .cc-contact-chip grid,
// the faint-emblem empty state.
export function ContactsScreen({ initial }: { initial: ContactVM[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
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
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add someone by name"
          style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 15, color: "var(--ink)" }}
          disabled={pending}
        />
      </label>

      {initial.length === 0 ? (
        <div className="cc-empty">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mk-ink.png" alt="" />
          <p className="cc-empty-title">No one here yet</p>
          <p className="cc-empty-sub">Add the people you meet and travel to see — Khonsera keeps them close to the days they belong to.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          {initial.map((c) => <ContactChip key={c.id} contact={c} />)}
        </div>
      )}
    </div>
  );
}

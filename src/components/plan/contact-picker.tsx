"use client";

// "Who's coming?" picker for the plan add sheet — debounced contact search
// with inline create, returning a bound contact (id + name). Reuses the
// hub-picker dropdown styling so it sits consistently inside PlanAdd.
import { useEffect, useRef, useState } from "react";
import {
  searchContacts,
  createContactQuick,
  type ContactHit,
} from "@/lib/actions/contact-search";

export type BoundContact = { id: string; name: string };

export function ContactPicker({
  value,
  onChange,
  placeholder = "Search people, or add a new one",
}: {
  value: BoundContact | null;
  onChange: (next: BoundContact | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ContactHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await searchContacts({ query });
      if (result.ok) setHits(result.value);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [open, query]);

  const trimmed = query.trim();
  const exactExists = hits.some(
    (h) => h.name.toLowerCase() === trimmed.toLowerCase(),
  );

  async function handleCreate() {
    if (!trimmed || creating) return;
    setCreating(true);
    const result = await createContactQuick({ name: trimmed });
    setCreating(false);
    if (result.ok) {
      onChange({ id: result.value.id, name: result.value.name });
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="field"
        style={{
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <span style={{ color: value ? "var(--ink)" : "var(--ink-faint)" }}>
          {value ? value.name : placeholder}
        </span>
        {value ? (
          <span
            role="button"
            aria-label="Clear"
            style={{ opacity: 0.55 }}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
          >
            ×
          </span>
        ) : (
          <span aria-hidden style={{ opacity: 0.5 }}>
            ▾
          </span>
        )}
      </button>

      {open ? (
        <div className="hub-picker-pop">
          <input
            type="text"
            className="field"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name…"
            autoFocus
          />
          <div className="hub-picker-list" role="listbox">
            {loading ? (
              <div className="hub-picker-empty">Searching…</div>
            ) : (
              hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  role="option"
                  aria-selected={h.id === value?.id}
                  className="hub-picker-item"
                  onClick={() => {
                    onChange({ id: h.id, name: h.name });
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="hub-picker-name">{h.name}</span>
                  {h.role ? <span className="hub-picker-meta">{h.role}</span> : null}
                </button>
              ))
            )}
            {trimmed && !exactExists ? (
              <button
                type="button"
                className="hub-picker-item"
                onClick={handleCreate}
                disabled={creating}
              >
                <span className="hub-picker-name">
                  {creating ? "Adding…" : `Add "${trimmed}"`}
                </span>
                <span className="hub-picker-meta">new person</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

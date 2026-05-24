"use client";

import { useEffect, useRef, useState } from "react";
import {
  searchTransportHubs,
  getTransportHub,
  type TransportHubHit,
} from "@/lib/actions/travel-profile";

// TransportHubPicker — autocomplete dropdown over the global
// transport_hubs catalogue (11k+ rail stations / airports). Used by
// the settings page to let a user pin a default station / airport;
// search is debounced so we don't fire on every keystroke.
//
// Fully controlled: the parent owns the selected hub id and the
// label to display. We only manage the dropdown's open state and the
// in-flight query.
export function TransportHubPicker({
  kind,
  value,
  onChange,
  name,
  placeholder,
}: {
  kind: "rail_station" | "airport";
  value: { id: string | null; label: string | null };
  onChange: (next: { id: string | null; label: string | null }) => void;
  // Form field name so the settings form can pick the value up via
  // FormData like its other inputs.
  name: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<TransportHubHit[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Debounced search. Reset to empty (seed list) when the popover
  // is reopened so the user always has something to pick from.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await searchTransportHubs({ query, kind });
      if (result.ok) setHits(result.value);
      setLoading(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [open, query, kind]);

  // If the parent passed an id but no label (first render of a
  // saved value), resolve the label asynchronously so the closed
  // picker doesn't show a raw uuid.
  useEffect(() => {
    if (!value.id || value.label) return;
    let cancelled = false;
    (async () => {
      const result = await getTransportHub(value.id!);
      if (!cancelled && result.ok && result.value) {
        onChange({ id: result.value.id, label: hitLabel(result.value) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value.id, value.label, onChange]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input type="hidden" name={name} value={value.id ?? ""} />
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
        <span
          style={{
            color: value.id ? "var(--ink)" : "var(--ink-faint)",
          }}
        >
          {value.label ?? placeholder ?? "Pick a hub"}
        </span>
        <span aria-hidden style={{ opacity: 0.5 }}>
          ▾
        </span>
      </button>

      {open ? (
        <div className="hub-picker-pop">
          <input
            type="text"
            className="field"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              kind === "rail_station"
                ? "Wellingborough, Liverpool Lime Street, …"
                : "LHR, Manchester airport, …"
            }
            autoFocus
          />
          <div className="hub-picker-list" role="listbox">
            {value.id ? (
              <button
                type="button"
                role="option"
                className="hub-picker-item hub-picker-item-clear"
                onClick={() => {
                  onChange({ id: null, label: null });
                  setOpen(false);
                }}
              >
                Clear default
              </button>
            ) : null}
            {loading ? (
              <div className="hub-picker-empty">Searching…</div>
            ) : hits.length === 0 ? (
              <div className="hub-picker-empty">No matches.</div>
            ) : (
              hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  role="option"
                  aria-selected={h.id === value.id}
                  className="hub-picker-item"
                  onClick={() => {
                    onChange({ id: h.id, label: hitLabel(h) });
                    setOpen(false);
                  }}
                >
                  <span className="hub-picker-name">{h.name}</span>
                  <span className="hub-picker-meta">
                    {[h.code, h.city, h.country].filter(Boolean).join(" · ")}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function hitLabel(h: TransportHubHit): string {
  if (h.code) return `${h.name} (${h.code})`;
  return h.name;
}

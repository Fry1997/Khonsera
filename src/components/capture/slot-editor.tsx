"use client";

import { useEffect, useRef, useState } from "react";
import { TransportHubPicker } from "@/components/transport-hub-picker";
import {
  PlacePicker,
  type PlacePickerCustomer,
  type PlacePickerCustomerSite,
  type PlacePickerLocation,
  type PlaceSelection,
} from "@/components/place-picker";
import { searchContacts, type ContactHit } from "@/lib/actions/contact-search";
import type { SlotDef } from "@/lib/dictionary/types";
import type { Slot } from "@/lib/parser/types";

export interface PickerData {
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
}

// Build the corrected Slot the user authored. Confirmed values are high-confidence
// and never inferred — the parser doesn't get to override them.
function commitSlot(value: unknown, sourceText: string, prev: Slot | undefined): Slot {
  return {
    value,
    source_text: sourceText,
    source_range: prev?.source_range ?? { start: 0, end: 0 },
    confidence: "high",
    inferred: false,
  };
}

export function SlotEditor({
  factType,
  def,
  current,
  pickerData,
  onCommit,
  onCancel,
}: {
  factType: string;
  def: SlotDef;
  current: Slot | undefined;
  pickerData: PickerData;
  onCommit: (slot: Slot) => void;
  onCancel: () => void;
}) {
  const stringValue =
    typeof current?.value === "string" ? current.value : "";

  // ── Transit hub (station/airport) ──────────────────────────────────────────
  if (def.dataType === "hub") {
    const kind = factType === "flight_journey" ? "airport" : "rail_station";
    const label =
      current && typeof current.value === "object" && current.value
        ? String((current.value as { label?: unknown }).label ?? "")
        : null;
    return (
      <div className="capture-editor">
        <TransportHubPicker
          kind={kind}
          name={`slot-${def.key}`}
          value={{ id: null, label }}
          onChange={(next) => {
            if (next.id) onCommit(commitSlot({ hub_id: next.id, label: next.label }, next.label ?? "", current));
            else onCancel();
          }}
        />
      </div>
    );
  }

  // ── Event place ────────────────────────────────────────────────────────────
  if (def.dataType === "place") {
    return (
      <div className="capture-editor">
        <PlacePicker
          customers={pickerData.customers}
          customerSites={pickerData.customerSites}
          locations={pickerData.locations}
          value={null}
          onChange={(sel: PlaceSelection | null) => {
            if (!sel) return onCancel();
            if (sel.kind === "location") onCommit(commitSlot({ location_id: sel.location_id, label: sel.label }, sel.label, current));
            else if (sel.kind === "customer_site") onCommit(commitSlot({ customer_site_id: sel.customer_site_id, customer_id: sel.customer_id, label: sel.label }, sel.label, current));
            else onCommit(commitSlot(sel.label, sel.label, current));
          }}
        />
      </div>
    );
  }

  // ── Person (contacts) ──────────────────────────────────────────────────────
  if (def.dataType === "person") {
    return <PersonEditor current={current} onCommit={onCommit} />;
  }

  // ── Native inputs (date / time / number / text) ─────────────────────────────
  const inputType =
    def.dataType === "date"
      ? "date"
      : def.dataType === "time"
        ? "time"
        : def.dataType === "party_size" || def.dataType === "duration" || def.dataType === "money" || def.dataType === "number"
          ? "number"
          : "text";

  return (
    <div className="capture-editor">
      <input
        className="field"
        type={inputType}
        defaultValue={stringValue}
        autoFocus
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (!v) return onCancel();
          const value = inputType === "number" ? Number(v) : v;
          onCommit(commitSlot(value, v, current));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") onCancel();
        }}
      />
    </div>
  );
}

function PersonEditor({
  current,
  onCommit,
}: {
  current: Slot | undefined;
  onCommit: (slot: Slot) => void;
}) {
  const [query, setQuery] = useState(
    typeof current?.value === "string" ? current.value : "",
  );
  const [hits, setHits] = useState<ContactHit[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const res = await searchContacts({ query });
      if (res.ok) setHits(res.value);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="capture-editor" ref={ref}>
      <input
        className="field"
        value={query}
        autoFocus
        placeholder="Who?"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && query.trim()) {
            onCommit(commitSlot(query.trim(), query.trim(), current));
          }
        }}
      />
      <div className="hub-picker-list" role="listbox">
        {hits.map((h) => (
          <button
            key={h.id}
            type="button"
            role="option"
            className="hub-picker-item"
            onClick={() => onCommit(commitSlot({ contact_id: h.id, label: h.name }, h.name, current))}
          >
            <span className="hub-picker-name">{h.name}</span>
            {h.role ? <span className="hub-picker-meta">{h.role}</span> : null}
          </button>
        ))}
        {query.trim() ? (
          <button
            type="button"
            role="option"
            className="hub-picker-item"
            onClick={() => onCommit(commitSlot(query.trim(), query.trim(), current))}
          >
            <span className="hub-picker-name">Use “{query.trim()}”</span>
            <span className="hub-picker-meta">as written</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

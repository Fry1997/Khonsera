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
import { searchContacts, createContactQuick, type ContactHit } from "@/lib/actions/contact-search";
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
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const res = await searchContacts({ query });
      if (res.ok) setHits(res.value);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  if (creating) {
    return (
      <NewContactForm
        initialName={query.trim()}
        onCancel={() => setCreating(false)}
        onCreated={(hit) => onCommit(commitSlot({ contact_id: hit.id, label: hit.name }, hit.name, current))}
      />
    );
  }

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
        <button
          type="button"
          role="option"
          className="hub-picker-item"
          onClick={() => setCreating(true)}
        >
          <span className="hub-picker-name">+ New contact{query.trim() ? ` “${query.trim()}”` : ""}</span>
          <span className="hub-picker-meta">add to your people</span>
        </button>
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

// Compact inline contact create: name, relation, company. A personal contact
// (no customer) — see migration 0029 + createContactQuick.
function NewContactForm({
  initialName,
  onCreated,
  onCancel,
}: {
  initialName: string;
  onCreated: (hit: ContactHit) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [relation, setRelation] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) return onCancel();
    setSaving(true);
    setError(null);
    const res = await createContactQuick({
      name: name.trim(),
      relation: relation.trim() || undefined,
      company: company.trim() || undefined,
    });
    setSaving(false);
    if (res.ok) onCreated(res.value);
    else setError("Could not save — try again.");
  };

  return (
    <div className="capture-editor" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <input className="field" value={name} autoFocus placeholder="Name" onChange={(e) => setName(e.target.value)} />
      <input className="field" value={relation} placeholder="Relation (e.g. customer, colleague)" onChange={(e) => setRelation(e.target.value)} />
      <input className="field" value={company} placeholder="Company (optional)" onChange={(e) => setCompany(e.target.value)} />
      {error ? <span style={{ color: "var(--terra)", fontSize: 12.5 }}>{error}</span> : null}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn btn-gold btn-sm" onClick={save} disabled={saving || !name.trim()}>
          {saving ? "Saving…" : "Save contact"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { SlotDef } from "@/lib/dictionary/types";
import type { ParsedFact, Slot } from "@/lib/parser/types";
import { factTypeLabel, formatSlotValue, slotLabel } from "./draft-model";
import { SlotEditor, type PickerData } from "./slot-editor";

const LINK_WORDS: Record<string, string> = {
  destination_of: "destination of",
  return_of: "return of",
  same_day: "same day as",
  at_same_place: "same place as",
  contains: "includes",
};

export function FactCard({
  fact,
  defs,
  dismissed,
  pickerData,
  labelForLocalId,
  onCommitSlot,
  onToggleDismiss,
  onHoverRange,
}: {
  fact: ParsedFact;
  defs: SlotDef[];
  dismissed: boolean;
  pickerData: PickerData;
  labelForLocalId: (id: string) => string;
  onCommitSlot: (slotKey: string, slot: Slot) => void;
  onToggleDismiss: () => void;
  onHoverRange: (range: { start: number; end: number } | null) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  // For verbatim shapes, show only the label + any captured anchor slots.
  const visibleDefs = defs.filter((d) => {
    if (fact.slots[d.key]) return true;
    return d.tier === "essential_to_work"; // surface missing essentials as "not set"
  });

  const confidencePill =
    fact.confidence === "low" ? "pill-amber" : fact.confidence === "high" ? "pill-sage" : "";

  return (
    <div
      className="card"
      style={{
        padding: "14px 16px",
        opacity: dismissed ? 0.5 : 1,
        borderColor: dismissed ? "var(--rule)" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--display)", fontWeight: 500, fontSize: 15, color: "var(--ink)" }}>
            {factTypeLabel(fact.fact_type)}
          </span>
          <span className={`pill ${confidencePill}`}>{fact.confidence}</span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onToggleDismiss}
        >
          {dismissed ? "Include" : "Don’t include"}
        </button>
      </div>

      {!dismissed ? (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {visibleDefs.map((def) => {
            const slot = fact.slots[def.key];
            const isEditing = editing === def.key;
            return (
              <div key={def.key}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span className="uc" style={{ minWidth: 96 }}>{slotLabel(def.key)}</span>
                  {isEditing ? null : (
                    <button
                      type="button"
                      onClick={() => setEditing(def.key)}
                      onMouseEnter={() => slot && onHoverRange(slot.source_range)}
                      onMouseLeave={() => onHoverRange(null)}
                      style={{
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        color: slot ? "var(--ink)" : "var(--ink-faint)",
                        fontFamily: "var(--sans)",
                        fontSize: 14,
                      }}
                    >
                      {slot ? formatSlotValue(slot) : "not set"}
                      {slot?.inferred ? <span style={{ color: "var(--ink-faint)" }}> (inferred)</span> : null}
                      {slot && slot.confidence === "low" ? (
                        <span style={{ color: "var(--amber)" }}> ? tap to confirm</span>
                      ) : null}
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <SlotEditor
                    factType={fact.fact_type}
                    def={def}
                    current={slot}
                    pickerData={pickerData}
                    onCommit={(s) => {
                      onCommitSlot(def.key, s);
                      setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : null}
              </div>
            );
          })}

          {fact.warnings.length > 0 ? (
            <div style={{ marginTop: 4 }}>
              {fact.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 12.5, color: "var(--terra)" }}>{w}</div>
              ))}
            </div>
          ) : null}

          {fact.links.length > 0 ? (
            <div style={{ marginTop: 2, fontSize: 12.5, color: "var(--ink-dim)" }}>
              {fact.links.map((l, i) => (
                <span key={i}>→ {LINK_WORDS[l.kind] ?? l.kind}: {labelForLocalId(l.target)}</span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

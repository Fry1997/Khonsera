"use client";

import { useState } from "react";
import type { SlotDef } from "@/lib/dictionary/types";
import type { ParsedFact, Slot } from "@/lib/parser/types";
import {
  factTypeLabel,
  formatSlotValue,
  slotLabel,
  slotEntityStatus,
  factAnchor,
  sortCandidatesByProximity,
  type RankedCandidate,
} from "./draft-model";
import { EntityBadge, CandidateDropdown } from "./entity-badge";
import { SlotEditor, type PickerData } from "./slot-editor";

// Build the bound Slot for a candidate the user picked from the chooser. Picks
// are user-authoritative: high confidence, not inferred. Station candidates
// carry coords so downstream proximity stays accurate.
function slotFromCandidate(c: RankedCandidate, prev: Slot | undefined): Slot {
  return {
    value: { hub_id: c.id, label: c.name, code: c.code ?? null, latitude: c.latitude ?? null, longitude: c.longitude ?? null },
    source_text: prev?.source_text ?? c.name,
    source_range: prev?.source_range ?? { start: 0, end: 0 },
    confidence: "high",
    inferred: false,
  };
}

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
  const [choosing, setChoosing] = useState<string | null>(null);
  const anchor = factAnchor(fact);

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
            const entityStatus = slotEntityStatus(slot, def.dataType);
            const isChoosing = choosing === def.key;
            return (
              <div key={def.key}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span className="uc" style={{ minWidth: 96 }}>{slotLabel(def.key)}</span>
                  {isEditing ? null : entityStatus ? (
                    <EntityBadge
                      label={formatSlotValue(slot!)}
                      status={entityStatus}
                      hint={entityStatus === "ambiguous" ? "which one?" : entityStatus === "unknown" ? "tap to set" : null}
                      onMouseEnter={() => onHoverRange(slot!.source_range)}
                      onMouseLeave={() => onHoverRange(null)}
                      onClick={() => {
                        if (entityStatus === "ambiguous") setChoosing(isChoosing ? null : def.key);
                        else setEditing(def.key);
                      }}
                    />
                  ) : (
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
                {isChoosing && entityStatus === "ambiguous" && slot ? (
                  <CandidateDropdown
                    candidates={sortCandidatesByProximity(slot.candidates ?? [], anchor)}
                    rawText={slot.source_text}
                    onPick={(c) => {
                      onCommitSlot(def.key, slotFromCandidate(c, slot));
                      setChoosing(null);
                    }}
                    onKeepAsTyped={() => setChoosing(null)}
                  />
                ) : null}
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

          {fact.recurrence_pattern ? (
            <div style={{ marginTop: 4 }}>
              <span className="uc" style={{ color: "var(--gold-2)" }}>recurring: {fact.recurrence_pattern}</span>
              <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
                I&rsquo;ve captured the next one. Full recurrence support is coming.
              </div>
            </div>
          ) : null}

          {fact.warnings.length > 0 ? (
            <div style={{ marginTop: 4 }}>
              {fact.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 12.5, color: "var(--terra)" }}>{w}</div>
              ))}
            </div>
          ) : null}

          {fact.links.length > 0 ? (
            <div style={{ marginTop: 2, fontSize: 12.5, color: "var(--ink-dim)" }}>
              {fact.links.map((l, i) =>
                l.kind === "event_day" && l.day_index ? (
                  <span key={i}>→ Day {l.day_index} of {labelForLocalId(l.target)}</span>
                ) : (
                  <span key={i}>→ {LINK_WORDS[l.kind] ?? l.kind}: {labelForLocalId(l.target)}</span>
                ),
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

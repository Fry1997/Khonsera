"use client";

import { useState } from "react";
import type { SlotDef } from "@/lib/dictionary/types";
import type { ParsedFact, Slot } from "@/lib/parser/types";
import { searchTransportHubs } from "@/lib/actions/travel-profile";
import { formatMiles } from "@/lib/geo";
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
import { StopIcon, TransportIcon } from "@/components/icons";

type IconCmp = (p: { size?: number }) => React.ReactElement;

// The icon that heads a fact block — by fact type.
function headerIcon(factType: string): IconCmp {
  if (factType in TransportIcon) {
    const mode = factType.replace(/_journey|_leg/, "") as keyof typeof TransportIcon;
    if (TransportIcon[mode]) return TransportIcon[mode];
  }
  const map: Record<string, IconCmp> = {
    train_journey: TransportIcon.train,
    flight_journey: TransportIcon.flight,
    bus_journey: TransportIcon.bus,
    coach_journey: TransportIcon.bus,
    ferry_journey: TransportIcon.bus,
    taxi_journey: TransportIcon.taxi,
    walking_leg: TransportIcon.walk,
    driving_leg: TransportIcon.drive,
    scheduled_event: StopIcon.appointment,
    appointment: StopIcon.appointment,
    scheduled_call: StopIcon.appointment,
    business_event: StopIcon.event,
    meal_plan: StopIcon.meal,
    accommodation_booking: StopIcon.stay,
    note: StopIcon.note,
    task: StopIcon.note,
    intent: StopIcon.note,
  };
  return map[factType] ?? StopIcon.note;
}

// The icon for a slot row — by slot key first (origin/destination/changeover),
// then by data type.
function slotIcon(key: string, dataType: string | undefined): IconCmp {
  if (/origin|depart|from/.test(key)) return StopIcon.station;
  if (/destination|arriv|to\b/.test(key)) return StopIcon.pin;
  if (/changeover|change|via/.test(key)) return TransportIcon.mixed;
  if (/check_in|check_out/.test(key)) return StopIcon.stay;
  switch (dataType) {
    case "person": return StopIcon.person;
    case "hub": return StopIcon.station;
    case "place": return StopIcon.pin;
    case "date": return StopIcon.calendar;
    case "time": return StopIcon.wait;
    case "money": return StopIcon.money;
    case "duration": return StopIcon.wait;
    default:
      if (/_time$/.test(key)) return StopIcon.wait;
      return StopIcon.note;
  }
}

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
  nearbyAnchor,
  onCommitSlot,
  onToggleDismiss,
  onHoverRange,
}: {
  fact: ParsedFact;
  defs: SlotDef[];
  dismissed: boolean;
  pickerData: PickerData;
  labelForLocalId: (id: string) => string;
  nearbyAnchor?: { lat: number; lng: number } | null;
  onCommitSlot: (slotKey: string, slot: Slot) => void;
  onToggleDismiss: () => void;
  onHoverRange: (range: { start: number; end: number } | null) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<string | null>(null);
  // Prefer coords from within the fact; fall back to a nearby stop elsewhere
  // in the draft so a station with no coords can still find its nearest hub.
  const anchor = factAnchor(fact) ?? nearbyAnchor ?? null;

  // For verbatim shapes, show only the label + any captured anchor slots.
  const visibleDefs = defs.filter((d) => {
    if (fact.slots[d.key]) return true;
    return d.tier === "essential_to_work"; // surface missing essentials as "not set"
  });

  const HeadIcon = headerIcon(fact.fact_type);

  return (
    <div
      className="card"
      style={{
        padding: "14px 16px",
        opacity: dismissed ? 0.45 : 1,
        borderColor: dismissed ? "var(--rule)" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ color: "var(--gold-2)", display: "flex" }}><HeadIcon size={18} /></span>
          <span style={{ fontFamily: "var(--display)", fontWeight: 500, fontSize: 15.5, color: "var(--ink)" }}>
            {factTypeLabel(fact.fact_type)}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ color: "var(--ink-faint)" }}
          onClick={onToggleDismiss}
        >
          {dismissed ? "Include" : "Don’t include"}
        </button>
      </div>

      {!dismissed ? (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 9 }}>
          {visibleDefs.map((def) => {
            const slot = fact.slots[def.key];
            const isEditing = editing === def.key;
            const entityStatus = slotEntityStatus(slot, def.dataType);
            const isChoosing = choosing === def.key;
            const RowIcon = slotIcon(def.key, def.dataType);
            return (
              <div key={def.key} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ color: "var(--ink-faint)", display: "flex", flex: "0 0 auto", marginTop: 2 }}>
                  <RowIcon size={16} />
                </span>
                <span className="uc" style={{ flex: "0 0 auto", minWidth: 72, marginTop: 3 }}>{slotLabel(def.key)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
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
                  ) : entityStatus ? (
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
                        fontSize: 14.5,
                      }}
                    >
                      {slot ? formatSlotValue(slot) : "not set"}
                      {slot?.inferred ? <span style={{ color: "var(--ink-faint)" }}> (inferred)</span> : null}
                      {slot && slot.confidence === "low" ? (
                        <span style={{ color: "var(--amber)" }}> · tap to confirm</span>
                      ) : null}
                    </button>
                  )}
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
                  {!isEditing && def.dataType === "hub" && anchor && entityStatus !== "bound" && entityStatus !== "ambiguous" ? (
                    <NearestStation
                      anchor={anchor}
                      kind={fact.fact_type === "flight_journey" ? "airport" : "rail_station"}
                      onPick={(c) => onCommitSlot(def.key, slotFromCandidate(c, slot))}
                    />
                  ) : null}
                </div>
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

// A one-tap "nearest station" affordance for an unset/unknown hub slot, ranked
// against a nearby anchor (a hotel/event with coords elsewhere in the draft).
function NearestStation({
  anchor,
  kind,
  onPick,
}: {
  anchor: { lat: number; lng: number };
  kind: "rail_station" | "airport";
  onPick: (c: RankedCandidate) => void;
}) {
  const [nearest, setNearest] = useState<RankedCandidate | null>(null);
  const [loaded, setLoaded] = useState(false);

  const find = async () => {
    setLoaded(true);
    const res = await searchTransportHubs({ query: "", kind, near: anchor });
    if (res.ok && res.value[0]) {
      const h = res.value[0];
      setNearest({
        id: h.id,
        name: h.name,
        code: h.code,
        latitude: h.latitude,
        longitude: h.longitude,
        distanceLabel: h.distance_m != null ? formatMiles(h.distance_m) : undefined,
      });
    }
  };

  if (!loaded) {
    return (
      <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={find}>
        Find nearest station
      </button>
    );
  }
  if (!nearest) return <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--ink-faint)" }}>No station found nearby.</div>;
  return (
    <button type="button" className="hub-picker-item" style={{ marginTop: 6 }} onClick={() => onPick(nearest)}>
      <span className="hub-picker-name">
        Nearest: {nearest.name}
        {nearest.code ? <span style={{ color: "var(--ink-faint)" }}> · {nearest.code}</span> : null}
      </span>
      {nearest.distanceLabel ? <span className="hub-picker-meta">{nearest.distanceLabel}</span> : null}
    </button>
  );
}

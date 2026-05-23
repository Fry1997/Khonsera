"use client";

import type { PlacePickerLocation } from "@/components/place-picker";

export type BaseLocation = {
  id: string;
  name: string;
  type: "home" | "office";
  address: string | null;
};

export function BaseLocationCard({
  baseLocations,
  defaultBaseId,
  selectedBaseId,
  onSelect,
}: {
  baseLocations: BaseLocation[];
  defaultBaseId: string | null;
  selectedBaseId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const selected = baseLocations.find((b) => b.id === selectedBaseId) ?? null;

  if (baseLocations.length === 0) {
    return (
      <div className="brief-subcard">
        <span className="uc">Base</span>
        <p className="brief-helper" style={{ margin: "6px 0 0" }}>
          Set a home or office in{" "}
          <a href="/settings/locations" className="link">
            Settings &rsaquo; Locations
          </a>{" "}
          so Khonsera knows where your day starts.
        </p>
      </div>
    );
  }

  if (baseLocations.length === 1) {
    const loc = baseLocations[0];
    return (
      <div className="brief-subcard">
        <span className="uc">Base</span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 6,
          }}
        >
          <span className={`kind-dot kind-dot-${loc.type}`} />
          <span style={{ fontWeight: 500, color: "var(--ink)" }}>
            {loc.name}
          </span>
          <span className="badge badge-ghost" style={{ fontSize: 11 }}>
            {loc.type === "home" ? "Home" : "Office"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="brief-subcard">
      <span className="uc">Base</span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 6,
          flexWrap: "wrap",
        }}
      >
        {baseLocations.map((loc) => (
          <button
            key={loc.id}
            type="button"
            className={`btn btn-sm ${loc.id === selectedBaseId ? "btn-gold" : "btn-ghost"}`}
            onClick={() => onSelect(loc.id)}
          >
            <span className={`kind-dot kind-dot-${loc.type}`} />
            {loc.name}
          </button>
        ))}
      </div>
    </div>
  );
}

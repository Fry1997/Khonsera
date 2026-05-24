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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span className="uc">Base</span>
          <a
            href="/settings/locations"
            className="link"
            style={{ fontSize: 12 }}
          >
            + Add a location
          </a>
        </div>
        <p className="brief-helper" style={{ margin: "6px 0 0" }}>
          Set a home or office in Settings so Khonsera knows where your day
          starts.
        </p>
      </div>
    );
  }

  return (
    <div className="brief-subcard">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span className="uc">Base</span>
        <a
          href="/settings/locations"
          className="link"
          style={{ fontSize: 12 }}
        >
          + Add new
        </a>
      </div>
      {baseLocations.length === 1 ? (
        <div style={{ marginTop: 6 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span className={`kind-dot kind-dot-${baseLocations[0].type}`} />
            <span style={{ fontWeight: 500, color: "var(--ink)" }}>
              {baseLocations[0].name}
            </span>
            <span className="badge badge-ghost" style={{ fontSize: 11 }}>
              {baseLocations[0].type === "home" ? "Home" : "Office"}
            </span>
          </div>
          {baseLocations[0].address ? (
            <p
              className="brief-helper"
              style={{ margin: "4px 0 0", paddingLeft: 20 }}
            >
              {baseLocations[0].address}
            </p>
          ) : null}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginTop: 6,
          }}
        >
          {baseLocations.map((loc) => (
            <button
              key={loc.id}
              type="button"
              className={`btn btn-sm ${loc.id === selectedBaseId ? "btn-gold" : "btn-ghost"}`}
              onClick={() => onSelect(loc.id)}
              style={{ textAlign: "left", justifyContent: "flex-start" }}
            >
              <span className={`kind-dot kind-dot-${loc.type}`} />
              <span style={{ display: "flex", flexDirection: "column" }}>
                <span>
                  {loc.name}
                  <span
                    style={{
                      fontSize: 10.5,
                      color: "var(--ink-dim)",
                      marginLeft: 6,
                    }}
                  >
                    {loc.type === "home" ? "Home" : "Office"}
                  </span>
                </span>
                {loc.address ? (
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--ink-dim)",
                      fontWeight: 400,
                    }}
                  >
                    {loc.address}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

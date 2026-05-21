"use client";

import {
  PlacePicker,
  type PlacePickerCustomer,
  type PlacePickerCustomerSite,
  type PlacePickerLocation,
} from "@/components/place-picker";
import { DurationRow } from "./duration-row";
import { STOPOVER_DURATIONS, fmtDur } from "./helpers";
import type { Anchor, Stopover } from "./types";

// StopoverCard — an *intent* card for a place you want to fit between
// two anchors. Visually indented + dashed border so it reads as a
// secondary item that depends on its neighbours, not a hard-pinned
// anchor of its own.
//
// The actual "leave by" / "available duration" back-calculation needs
// travel-time data from the Routes API plus debouncing/caching — that
// is a follow-up (Slice D in the editor plan). For now the card
// scaffolds the data model + UI and shows the user a helper line
// describing what Khonsera will do.
export function StopoverCard({
  stopover,
  fromAnchor,
  toAnchor,
  customers,
  customerSites,
  locations,
  onChange,
  onRemove,
  mode = "expanded",
  onModeChange,
}: {
  stopover: Stopover;
  fromAnchor: Anchor;
  toAnchor: Anchor;
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  onChange: (patch: Partial<Stopover>) => void;
  onRemove: () => void;
  mode?: "expanded" | "summary";
  onModeChange?: (next: "expanded" | "summary") => void;
}) {
  const fromLabel = fromAnchor.place?.label ?? "the previous stop";
  const toLabel = toAnchor.place?.label ?? "the next anchor";

  if (mode === "summary") {
    return (
      <div className="stopover-card stopover-card-summary">
        <header className="stopover-card-head">
          <div className="stopover-card-eyebrow">
            <span className="uc">Stopover</span>
            <span className="stopover-card-helper">
              {stopover.place?.label ?? "Pick a place"} ·{" "}
              {fmtDur(stopover.durationMins)}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {onModeChange ? (
              <button
                type="button"
                onClick={() => onModeChange("expanded")}
                className="anchor-card-toggle"
              >
                Edit
              </button>
            ) : null}
            <button
              type="button"
              className="stopover-card-remove"
              onClick={onRemove}
              aria-label="Remove stopover"
            >
              Remove
            </button>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="stopover-card">
      <header className="stopover-card-head">
        <div className="stopover-card-eyebrow">
          <span className="uc">Stopover</span>
          <span className="stopover-card-helper">
            Fits between {fromLabel} and {toLabel}.
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {onModeChange ? (
            <button
              type="button"
              onClick={() => onModeChange("summary")}
              className="anchor-card-toggle"
            >
              Done
            </button>
          ) : null}
          <button
            type="button"
            className="stopover-card-remove"
            onClick={onRemove}
            aria-label="Remove stopover"
          >
            Remove
          </button>
        </div>
      </header>

      <PlacePicker
        customers={customers}
        customerSites={customerSites}
        locations={locations}
        value={stopover.place}
        onChange={(place) => onChange({ place })}
        placeholder="Where do you want to drop in?"
      />

      <DurationRow
        label="Ideal duration"
        presets={STOPOVER_DURATIONS}
        value={stopover.durationMins}
        onChange={(mins) => onChange({ durationMins: mins })}
      />

      <p className="stopover-followup">
        Khonsera will work out the latest you can leave {fromLabel} and
        leave here so you still hit {toLabel} on time — travel-time math
        coming next.
      </p>
    </div>
  );
}

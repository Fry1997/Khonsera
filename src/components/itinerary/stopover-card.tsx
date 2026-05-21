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

// Back-calc summary for a stopover, derived from the surrounding
// anchors' fixed times and the leg transitions' computed durations.
// Editor surfaces this on the summary card so a planning user can
// see "if you leave the previous anchor at its endTime you'll be
// here by X; the next anchor starts at Y so you need to leave by Z".
//
// `status` reflects whether the user's ideal duration fits inside
// the derived window:
//   * 'fits'        — ideal duration <= available window, slack > 10m
//   * 'tight'       — slack is < 10m
//   * 'infeasible'  — window is too small for the ideal duration
//   * 'unknown'     — we don't have enough data to compute (e.g. a
//                     non-fixed neighbour or a missing travel time)
export type StopoverBackCalc = {
  earliestArrive?: string; // HH:MM in workspace tz
  latestLeave?: string; // HH:MM in workspace tz
  availableMinutes?: number;
  status: "fits" | "tight" | "infeasible" | "unknown";
  // Optional one-line override message when status is tight /
  // infeasible — used to spell out exactly which constraint is
  // breaking ("needs 30m, only 18m available").
  message?: string;
};

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
  // Optional back-calc; editor computes this from neighbour anchors +
  // leg transitions and passes it in. Brief leaves it undefined.
  backCalc,
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
  backCalc?: StopoverBackCalc;
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
        {backCalc ? <BackCalcLine backCalc={backCalc} /> : null}
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

      {backCalc ? (
        <BackCalcLine backCalc={backCalc} />
      ) : (
        <p className="stopover-followup">
          Khonsera will work out the latest you can leave {fromLabel}{" "}
          and leave here so you still hit {toLabel} on time.
        </p>
      )}
    </div>
  );
}

// Inline back-calc display — same in summary and expanded modes.
function BackCalcLine({ backCalc }: { backCalc: StopoverBackCalc }) {
  if (backCalc.status === "unknown") return null;
  const positive =
    backCalc.status === "fits" || backCalc.status === "tight"
      ? "stopover-backcalc-line"
      : "stopover-backcalc-line stopover-backcalc-bad";
  if (backCalc.message) {
    return <p className={positive}>{backCalc.message}</p>;
  }
  const slack =
    backCalc.availableMinutes != null
      ? `${backCalc.availableMinutes}m available`
      : null;
  const arrive = backCalc.earliestArrive
    ? `arrive ~${backCalc.earliestArrive}`
    : null;
  const leave = backCalc.latestLeave
    ? `leave by ${backCalc.latestLeave}`
    : null;
  return (
    <p className={positive}>
      {[arrive, leave, slack].filter(Boolean).join(" · ")}
    </p>
  );
}

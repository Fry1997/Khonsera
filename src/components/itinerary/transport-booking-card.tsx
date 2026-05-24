"use client";

import { useState } from "react";
import { TransportIcon } from "@/components/icons";
import { TransportHubPicker } from "@/components/transport-hub-picker";
import { cryptoUid } from "./helpers";

export type TransportBookingMode =
  | "train"
  | "flight"
  | "taxi"
  | "bus"
  | "tube"
  | "drive";

const MODE_OPTIONS: Array<{
  value: TransportBookingMode;
  label: string;
}> = [
  { value: "train", label: "Train" },
  { value: "flight", label: "Flight" },
  { value: "taxi", label: "Taxi" },
  { value: "bus", label: "Bus" },
  { value: "tube", label: "Tube" },
  { value: "drive", label: "Car hire" },
];

export type BriefTransportBooking = {
  uid: string;
  mode: TransportBookingMode | null;
  date: string;
  departureHub: { id: string | null; label: string | null };
  destinationHub: { id: string | null; label: string | null };
  departTime: string;
  arriveTime: string;
  serviceNumber: string;
  reference: string;
  seat: string;
  price: string;
  confirmed: boolean;
};

export function emptyTransportBookingItem(): BriefTransportBooking {
  return {
    uid: cryptoUid(),
    mode: null,
    date: "",
    departureHub: { id: null, label: null },
    destinationHub: { id: null, label: null },
    departTime: "",
    arriveTime: "",
    serviceNumber: "",
    reference: "",
    seat: "",
    price: "",
    confirmed: false,
  };
}

export function returnTransportBooking(
  from: BriefTransportBooking,
): BriefTransportBooking {
  return {
    uid: cryptoUid(),
    mode: from.mode,
    date: "",
    departureHub: { ...from.destinationHub },
    destinationHub: { ...from.departureHub },
    departTime: "",
    arriveTime: "",
    serviceNumber: "",
    reference: "",
    seat: "",
    price: "",
    confirmed: false,
  };
}

const SERVICE_PH: Partial<Record<TransportBookingMode, string>> = {
  train: "e.g. 1A45",
  flight: "e.g. BA245",
  bus: "e.g. Bus 24",
  tube: "e.g. Northern Line",
  drive: "e.g. Hertz #ABC",
};

export function TransportBookingCard({
  booking,
  onChange,
  onRemove,
}: {
  booking: BriefTransportBooking;
  onChange: (patch: Partial<BriefTransportBooking>) => void;
  onRemove: () => void;
}) {
  const mode = booking.mode;
  const hubKind: "rail_station" | "airport" =
    mode === "flight" ? "airport" : "rail_station";
  const stationBased =
    mode === "train" ||
    mode === "flight" ||
    mode === "tube" ||
    mode === "bus";

  if (!mode) {
    return (
      <section className="brief-card brief-card-soft">
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <span className="uc">Booked transport</span>
          <button
            type="button"
            onClick={onRemove}
            style={{ fontSize: 11.5, color: "var(--rust)" }}
          >
            Remove
          </button>
        </header>
        <p
          className="brief-helper"
          style={{ margin: "0 0 10px", fontSize: 13 }}
        >
          What kind of ticket do you have?
        </p>
        <div className="brief-pill-row" style={{ flexWrap: "wrap" }}>
          {MODE_OPTIONS.map((o) => {
            const Icon = TransportIcon[o.value];
            return (
              <button
                key={o.value}
                type="button"
                className="pill brief-pill"
                onClick={() => onChange({ mode: o.value })}
              >
                <Icon size={13} />
                {o.label}
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  const modeLabel =
    MODE_OPTIONS.find((o) => o.value === mode)?.label ?? mode;
  const ModeIcon = TransportIcon[mode];

  return (
    <section className="brief-card brief-card-soft">
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <ModeIcon size={14} />
          <span className="uc">{modeLabel} booking</span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          style={{ fontSize: 11.5, color: "var(--rust)" }}
        >
          Remove
        </button>
      </header>

      <label className="brief-field" style={{ marginBottom: 8 }}>
        <span className="uc">Date</span>
        <input
          type="date"
          className="field"
          value={booking.date}
          onChange={(e) => onChange({ date: e.target.value })}
        />
      </label>

      {stationBased ? (
        <div className="brief-when-row">
          <div className="brief-field">
            <span className="uc">
              {mode === "flight" ? "From airport" : "From station"}
            </span>
            <TransportHubPicker
              kind={hubKind}
              value={booking.departureHub}
              onChange={(hub) => onChange({ departureHub: hub })}
              name={`dep-hub-${booking.uid}`}
              placeholder={
                mode === "flight"
                  ? "LHR, East Midlands…"
                  : "WLB, Milton Keynes…"
              }
            />
          </div>
          <div className="brief-field">
            <span className="uc">
              {mode === "flight" ? "To airport" : "To station"}
            </span>
            <TransportHubPicker
              kind={hubKind}
              value={booking.destinationHub}
              onChange={(hub) => onChange({ destinationHub: hub })}
              name={`arr-hub-${booking.uid}`}
              placeholder={
                mode === "flight"
                  ? "Manchester, JFK…"
                  : "Liverpool, Euston…"
              }
            />
          </div>
        </div>
      ) : null}

      <div className="brief-when-row">
        <label className="brief-field">
          <span className="uc">Depart</span>
          <input
            type="time"
            className="field"
            value={booking.departTime}
            onChange={(e) => onChange({ departTime: e.target.value })}
          />
        </label>
        <label className="brief-field">
          <span className="uc">Arrive</span>
          <input
            type="time"
            className="field"
            value={booking.arriveTime}
            onChange={(e) => onChange({ arriveTime: e.target.value })}
          />
        </label>
      </div>

      <div className="brief-when-row">
        <label className="brief-field">
          <span className="uc">Service no.</span>
          <input
            type="text"
            className="field"
            placeholder={SERVICE_PH[mode] ?? ""}
            value={booking.serviceNumber}
            onChange={(e) => onChange({ serviceNumber: e.target.value })}
          />
        </label>
        <label className="brief-field">
          <span className="uc">Booking ref.</span>
          <input
            type="text"
            className="field"
            placeholder="ABC123"
            value={booking.reference}
            onChange={(e) => onChange({ reference: e.target.value })}
          />
        </label>
      </div>

      <div className="brief-when-row">
        <label className="brief-field">
          <span className="uc">Seat</span>
          <input
            type="text"
            className="field"
            placeholder={mode === "flight" ? "12A" : "Coach C, Seat 42"}
            value={booking.seat}
            onChange={(e) => onChange({ seat: e.target.value })}
          />
        </label>
        <label className="brief-field">
          <span className="uc">Price (£)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className="field"
            placeholder="148.50"
            value={booking.price}
            onChange={(e) => onChange({ price: e.target.value })}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          type="button"
          className="btn btn-gold btn-sm"
          onClick={() => onChange({ confirmed: true })}
        >
          Done
        </button>
      </div>
    </section>
  );
}

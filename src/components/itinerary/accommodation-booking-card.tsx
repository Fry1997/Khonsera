"use client";

import {
  PlacePicker,
  type PlaceSelection,
  type PlacePickerCustomer,
  type PlacePickerCustomerSite,
  type PlacePickerLocation,
} from "@/components/place-picker";
import { cryptoUid } from "./helpers";

export type BriefAccommodationBooking = {
  uid: string;
  hotel: PlaceSelection | null;
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
  provider: string;
  reference: string;
  price: string;
  room: string;
  confirmed: boolean;
};

export function emptyAccommodationBookingItem(): BriefAccommodationBooking {
  return {
    uid: cryptoUid(),
    hotel: null,
    checkInDate: "",
    checkInTime: "15:00",
    checkOutDate: "",
    checkOutTime: "11:00",
    provider: "",
    reference: "",
    price: "",
    room: "",
    confirmed: false,
  };
}

export function AccommodationBookingCard({
  booking,
  customers,
  customerSites,
  locations,
  onChange,
  onRemove,
}: {
  booking: BriefAccommodationBooking;
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  onChange: (patch: Partial<BriefAccommodationBooking>) => void;
  onRemove: () => void;
}) {
  const hotelLocations = locations.filter(
    (l) => l.type === "hotel" || l.type === "other",
  );

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
        <span className="uc">Accommodation booking</span>
        <button
          type="button"
          onClick={onRemove}
          style={{ fontSize: 11.5, color: "var(--rust)" }}
        >
          Remove
        </button>
      </header>

      <div className="brief-field" style={{ marginBottom: 8 }}>
        <span className="uc">Hotel</span>
        <PlacePicker
          customers={customers}
          customerSites={customerSites}
          locations={hotelLocations}
          value={booking.hotel}
          onChange={(h) => onChange({ hotel: h })}
          showCustomers={false}
          googleTypes="lodging"
          defaultNewType="hotel"
          placeholder="Search a hotel or pick a saved one"
        />
      </div>

      <div className="brief-when-row">
        <label className="brief-field">
          <span className="uc">Check-in from</span>
          <input
            type="date"
            className="field"
            value={booking.checkInDate}
            onChange={(e) => onChange({ checkInDate: e.target.value })}
          />
        </label>
        <label className="brief-field">
          <span className="uc" style={{ opacity: 0 }}>Time</span>
          <input
            type="time"
            className="field"
            value={booking.checkInTime}
            onChange={(e) => onChange({ checkInTime: e.target.value })}
          />
        </label>
      </div>
      <div className="brief-when-row">
        <label className="brief-field">
          <span className="uc">Check-out by</span>
          <input
            type="date"
            className="field"
            value={booking.checkOutDate}
            onChange={(e) => onChange({ checkOutDate: e.target.value })}
          />
        </label>
        <label className="brief-field">
          <span className="uc" style={{ opacity: 0 }}>Time</span>
          <input
            type="time"
            className="field"
            value={booking.checkOutTime}
            onChange={(e) => onChange({ checkOutTime: e.target.value })}
          />
        </label>
      </div>

      <div className="brief-when-row">
        <label className="brief-field">
          <span className="uc">Provider</span>
          <input
            type="text"
            className="field"
            placeholder="Booking.com"
            value={booking.provider}
            onChange={(e) => onChange({ provider: e.target.value })}
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
        <label className="brief-field">
          <span className="uc">Room</span>
          <input
            type="text"
            className="field"
            placeholder="King · breakfast included"
            value={booking.room}
            onChange={(e) => onChange({ room: e.target.value })}
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

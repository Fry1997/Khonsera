"use client";

import {
  FormField,
  Input,
} from "@/components/ui/form";
import {
  PlacePicker,
  type PlaceSelection,
  type PlacePickerCustomer,
  type PlacePickerCustomerSite,
  type PlacePickerLocation,
} from "@/components/place-picker";

export type AccommodationBookingValue = {
  hotel: PlaceSelection | null;
  hotelName: string;
  checkIn: string;
  checkOut: string;
  provider: string;
  reference: string;
  price: string;
  room: string;
};

export function emptyAccommodationBooking(): AccommodationBookingValue {
  return {
    hotel: null,
    hotelName: "",
    checkIn: "",
    checkOut: "",
    provider: "",
    reference: "",
    price: "",
    room: "",
  };
}

export function AccommodationBookingFields({
  value,
  onChange,
  customers,
  customerSites,
  locations,
  idPrefix = "abf",
}: {
  value: AccommodationBookingValue;
  onChange: (next: AccommodationBookingValue) => void;
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  idPrefix?: string;
}) {
  const hotelLocations = locations.filter(
    (l) => l.type === "hotel" || l.type === "other",
  );

  return (
    <>
      <FormField label="Hotel" htmlFor={`${idPrefix}-hotel`}>
        <PlacePicker
          customers={customers}
          customerSites={customerSites}
          locations={hotelLocations}
          value={value.hotel}
          onChange={(h) => onChange({ ...value, hotel: h })}
          showCustomers={false}
          googleTypes="lodging"
          defaultNewType="hotel"
          placeholder="Search a hotel or pick a saved one"
        />
      </FormField>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Check-in" htmlFor={`${idPrefix}-ci`}>
          <Input
            id={`${idPrefix}-ci`}
            type="datetime-local"
            value={value.checkIn}
            onChange={(e) => onChange({ ...value, checkIn: e.target.value })}
          />
        </FormField>
        <FormField label="Check-out" htmlFor={`${idPrefix}-co`}>
          <Input
            id={`${idPrefix}-co`}
            type="datetime-local"
            value={value.checkOut}
            onChange={(e) => onChange({ ...value, checkOut: e.target.value })}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Provider" htmlFor={`${idPrefix}-provider`}>
          <Input
            id={`${idPrefix}-provider`}
            value={value.provider}
            onChange={(e) => onChange({ ...value, provider: e.target.value })}
            placeholder="Booking.com"
          />
        </FormField>
        <FormField label="Booking ref." htmlFor={`${idPrefix}-ref`}>
          <Input
            id={`${idPrefix}-ref`}
            value={value.reference}
            onChange={(e) => onChange({ ...value, reference: e.target.value })}
            placeholder="ABC123"
          />
        </FormField>
        <FormField label="Price (£)" htmlFor={`${idPrefix}-price`}>
          <Input
            id={`${idPrefix}-price`}
            type="number"
            min={0}
            step="0.01"
            value={value.price}
            onChange={(e) => onChange({ ...value, price: e.target.value })}
          />
        </FormField>
        <FormField label="Room details" htmlFor={`${idPrefix}-room`}>
          <Input
            id={`${idPrefix}-room`}
            value={value.room}
            onChange={(e) => onChange({ ...value, room: e.target.value })}
            placeholder="King · breakfast included"
          />
        </FormField>
      </div>
    </>
  );
}

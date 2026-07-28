"use client";

import {
  FlightFinder as CoreFlightFinder,
  type DefaultPassenger,
} from "./flight-finder";

type FullProps = {
  itineraryId: string;
  defaultDate: string;
  defaultPassenger: DefaultPassenger;
  journeyId?: never;
  passenger?: never;
};

type CompactProps = {
  journeyId: string;
  passenger: DefaultPassenger;
  defaultDate?: string;
  itineraryId?: never;
  defaultPassenger?: never;
};

export type { DefaultPassenger };

export function FlightFinder(props: FullProps | CompactProps) {
  const itineraryId = props.itineraryId ?? props.journeyId;
  const defaultPassenger = props.defaultPassenger ?? props.passenger;
  const defaultDate = props.defaultDate ?? new Date().toISOString().slice(0, 10);
  if (!itineraryId || !defaultPassenger) return null;

  return (
    <CoreFlightFinder
      itineraryId={itineraryId}
      defaultDate={defaultDate}
      defaultPassenger={defaultPassenger}
    />
  );
}

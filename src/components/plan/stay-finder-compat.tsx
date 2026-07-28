"use client";

import { StayFinder as CoreStayFinder } from "./stay-finder";

type FullProps = {
  itineraryId: string;
  defaultDate: string;
  journeyId?: never;
};

type CompactProps = {
  journeyId: string;
  defaultDate?: string;
  itineraryId?: never;
};

export function StayFinder(props: FullProps | CompactProps) {
  const itineraryId = "itineraryId" in props ? props.itineraryId : props.journeyId;
  const defaultDate = props.defaultDate ?? new Date().toISOString().slice(0, 10);
  return <CoreStayFinder itineraryId={itineraryId} defaultDate={defaultDate} />;
}

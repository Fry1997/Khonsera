"use client";

import { useEffect, useState } from "react";
import { LegCard, type LegVM } from "@/components/concierge";
import { PlanSpine as CorePlanSpine, type SpineNode } from "./plan-spine";
import { loadBookendLegs } from "@/lib/actions/bookend-legs";
import type { PlacePickerCustomer, PlacePickerCustomerSite, PlacePickerLocation } from "@/components/place-picker";

type Props = {
  nodes: SpineNode[];
  journeyDate: string;
  eventId: string;
  isWork: boolean;
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
};

export type { SpineNode };

export function PlanSpine(props: Props) {
  const [leading, setLeading] = useState<LegVM | null>(null);
  const [trailing, setTrailing] = useState<LegVM | null>(null);

  useEffect(() => {
    let active = true;
    setLeading(null);
    setTrailing(null);
    void loadBookendLegs(props.eventId).then((bookends) => {
      if (!active) return;
      setLeading(bookends.leading);
      setTrailing(bookends.trailing);
    });
    return () => { active = false; };
  }, [props.eventId]);

  return (
    <>
      {leading ? (
        <section className="cc-bookend-leg" aria-label="Journey from your base">
          <span className="cc-eyebrow">From your base</span>
          <LegCard leg={leading} />
        </section>
      ) : null}
      <CorePlanSpine {...props} />
      {trailing ? (
        <section className="cc-bookend-leg" aria-label="Journey back to your base">
          <span className="cc-eyebrow">Back to your base</span>
          <LegCard leg={trailing} />
        </section>
      ) : null}
    </>
  );
}

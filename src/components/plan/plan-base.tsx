"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPlanBase } from "@/lib/actions/plan-edit";
import {
  PlacePicker,
  type PlaceSelection,
  type PlacePickerCustomer,
  type PlacePickerCustomerSite,
  type PlacePickerLocation,
} from "@/components/place-picker";

// The day's BASE — home/office it departs from and returns to (plan elevation
// 2026-06-15). Without it the door-to-door spine has no origin, so this is the
// affordance that replaces the retired Brief's base card. Shows the current base,
// or invites one when unset; picking writes both bookend stops via setPlanBase.
export function PlanBase({
  itineraryId,
  baseLabel,
  customers,
  customerSites,
  locations,
}: {
  itineraryId: string;
  baseLabel: string | null;
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<PlaceSelection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!place?.label) {
      setError("Pick or type your base.");
      return;
    }
    const locationId = place.kind === "location" ? place.location_id : null;
    const customerSiteId = place.kind === "customer_site" ? place.customer_site_id : null;
    if (!locationId && !customerSiteId) {
      setError("Pick a home, office or saved place as your base.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await setPlanBase({ itineraryId, locationId, customerSiteId, label: place.label });
      if (!res.ok) {
        setError(res.error ?? "Couldn't set the base.");
        return;
      }
      setOpen(false);
      setPlace(null);
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" className="cc-plan-base" data-unset={baseLabel ? undefined : ""} onClick={() => setOpen(true)}>
        <span className="cc-plan-base-pin" aria-hidden />
        {baseLabel ? (
          <span className="cc-plan-base-text">From <strong>{baseLabel}</strong></span>
        ) : (
          <span className="cc-plan-base-text">Set your base — where the day starts &amp; ends</span>
        )}
        <span className="cc-plan-base-edit" aria-hidden>{baseLabel ? "Change" : "Set"}</span>
      </button>

      {open ? (
        <div className="cc-sheet-scrim" onClick={() => setOpen(false)}>
          <div className="cc-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
            <div className="cc-sheet-grip" />
            <header className="cc-sheet-head">
              <span className="cc-eyebrow">The day&rsquo;s base</span>
              <h3 className="cc-sheet-title">Where do you start &amp; end?</h3>
            </header>
            <p className="cc-sheet-note">Home or the office — Khonsera threads the door-to-door from here, and back.</p>
            <div className="cc-time-field">
              <span className="cc-var-label">Base</span>
              <PlacePicker
                customers={customers}
                customerSites={customerSites}
                locations={locations}
                value={place}
                onChange={setPlace}
                placeholder="Search home/office, or type an address"
              />
            </div>
            {error ? <p className="cc-sheet-error">{error}</p> : null}
            <div className="cc-sheet-actions">
              <button type="button" className="cc-btn cc-btn-ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</button>
              <button type="button" className="cc-btn cc-btn-gold" onClick={save} disabled={pending}>{pending ? "Saving…" : "Set base"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

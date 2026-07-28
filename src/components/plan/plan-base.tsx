"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPlanBase } from "@/lib/actions/plan-edit";
import {
  PlacePicker,
  type PlaceSelection,
  type PlacePickerCustomer,
  type PlacePickerCustomerSite,
  type PlacePickerLocation,
} from "@/components/place-picker";
import { Sheet } from "@/components/ui/sheet";

// Base is header context and a routing endpoint, never a visible plan stop. The
// optional aliases keep the compact Plan page compatible while richer callers
// can still provide the picker collections.
export function PlanBase({
  itineraryId,
  baseLabel,
  label,
  customers = [],
  customerSites = [],
  locations = [],
}: {
  itineraryId: string;
  baseLabel?: string | null;
  label?: string | null;
  customers?: PlacePickerCustomer[];
  customerSites?: PlacePickerCustomerSite[];
  locations?: PlacePickerLocation[];
}) {
  const resolvedBaseLabel = baseLabel ?? label ?? null;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<PlaceSelection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<string | null>(null);
  useEffect(() => { setOptimistic(null); }, [resolvedBaseLabel]);
  const shownBase = optimistic ?? resolvedBaseLabel;

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
    const nextLabel = place.label;
    setError(null);
    setOpen(false);
    setPlace(null);
    setOptimistic(nextLabel);
    startTransition(async () => {
      const res = await setPlanBase({ itineraryId, locationId, customerSiteId, label: nextLabel });
      if (!res.ok) {
        setOptimistic(null);
        setError(res.error ?? "Couldn't set the base.");
        setOpen(true);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" className="cc-plan-base" data-unset={shownBase ? undefined : ""} onClick={() => setOpen(true)}>
        <span className="cc-plan-base-pin" aria-hidden />
        {shownBase ? (
          <span className="cc-plan-base-text">From <strong>{shownBase}</strong></span>
        ) : (
          <span className="cc-plan-base-text">Set your base — where the day starts &amp; ends</span>
        )}
        <span className="cc-plan-base-edit" aria-hidden>{pending ? "Threading…" : shownBase ? "Change" : "Set"}</span>
      </button>

      {open ? (
        <Sheet titleId="plan-base-sheet-title" descriptionId="plan-base-sheet-description" onClose={() => setOpen(false)}>
          <header className="cc-sheet-head">
            <span className="cc-eyebrow">The day&rsquo;s base</span>
            <h3 id="plan-base-sheet-title" className="cc-sheet-title" tabIndex={-1}>Where do you start &amp; end?</h3>
          </header>
          <p id="plan-base-sheet-description" className="cc-sheet-note">Home or the office — Khonsera threads the door-to-door from here, and back.</p>
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
            <button type="button" className="cc-btn cc-btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="cc-btn cc-btn-gold" onClick={save}>Set base</button>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}

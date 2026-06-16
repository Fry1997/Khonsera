"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveRecurringOffer, type RecurringOffer } from "@/lib/actions/recurring";

// When a recurring event lands on a day you already have a plan, we OFFER rather
// than silently skip: add it to that day, or skip just this one. Your choice is
// remembered so it doesn't keep asking.
export function RecurringOffers({ offers }: { offers: RecurringOffer[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (offers.length === 0) return null;

  function act(o: RecurringOffer, action: "merge" | "skip") {
    startTransition(async () => {
      await resolveRecurringOffer({ ruleId: o.ruleId, date: o.date, itineraryId: o.itineraryId, action });
      router.refresh();
    });
  }
  const fmt = (d: string) =>
    new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${d}T12:00:00`));

  return (
    <section className="cc-rec-offers">
      {offers.map((o) => (
        <div key={`${o.ruleId}-${o.date}`} className="cc-rec-offer">
          <p className="cc-rec-offer-text">
            <strong>{o.ruleTitle}</strong> falls on {fmt(o.date)}, which already has <strong>{o.itineraryTitle}</strong>. Add it to that day?
          </p>
          <div className="cc-rec-offer-actions">
            <button type="button" className="cc-btn cc-btn-gold" disabled={pending} onClick={() => act(o, "merge")}>Add to this day</button>
            <button type="button" className="cc-btn cc-btn-quiet" disabled={pending} onClick={() => act(o, "skip")}>Skip</button>
          </div>
        </div>
      ))}
    </section>
  );
}

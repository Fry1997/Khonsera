"use client";

import { useState } from "react";
import type { Journey } from "@/components/journey-map";
import { PlanMap as CorePlanMap } from "./plan-map";

export function PlanMap({ journey }: { journey: Journey }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <section className="cc-plan-map-deferred">
        <button type="button" className="cc-btn cc-btn-ghost" onClick={() => setOpen(true)}>
          Show route map
        </button>
      </section>
    );
  }

  return (
    <section className="cc-plan-map-deferred">
      <button type="button" className="cc-btn cc-btn-quiet" onClick={() => setOpen(false)}>
        Hide route map
      </button>
      <CorePlanMap journey={journey} />
    </section>
  );
}

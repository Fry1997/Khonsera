"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleModeExclusion, setHomeBy } from "@/lib/actions/constraints";
import type { PlanConstraints } from "@/lib/actions/constraints";
import type { TransitionMode } from "@/lib/types/domain";

// Constraints & exclusions surface (planner master brief §5.8) — a compact, calm
// summary that never clutters the spine. Excluded modes filter the
// ComparisonMatrix; "be home by" caps the day. Global standing facts.

const EXCLUDABLE: { mode: TransitionMode; label: string }[] = [
  { mode: "flight", label: "Flights" },
  { mode: "tube", label: "The Tube" },
  { mode: "train", label: "Trains" },
  { mode: "bus", label: "Buses" },
  { mode: "taxi", label: "Taxis" },
  { mode: "drive", label: "Driving" },
];

export function PlanConstraints({ initial }: { initial: PlanConstraints }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [excluded, setExcluded] = useState<TransitionMode[]>(initial.excludedModes);
  const [homeBy, setHome] = useState<string>(initial.homeBy ?? "");
  const [pending, setPending] = useState(false);

  const excludedLabels = EXCLUDABLE.filter((e) => excluded.includes(e.mode)).map((e) => e.label);
  const summary =
    excludedLabels.length || homeBy
      ? [homeBy ? `home by ${homeBy}` : null, ...excludedLabels.map((l) => `no ${l.toLowerCase()}`)]
          .filter(Boolean)
          .join(" · ")
      : "No constraints set";

  function toggle(mode: TransitionMode) {
    const next = excluded.includes(mode) ? excluded.filter((m) => m !== mode) : [...excluded, mode];
    setExcluded(next);
    setPending(true);
    void toggleModeExclusion(mode).then(() => {
      setPending(false);
      router.refresh();
    });
  }

  function saveHome(value: string) {
    setHome(value);
    setPending(true);
    void setHomeBy(value || null).then(() => {
      setPending(false);
      router.refresh();
    });
  }

  return (
    <div className="cc-constraints">
      <button type="button" className="cc-constraints-summary" onClick={() => setOpen((o) => !o)}>
        <span className="cc-constraints-label">Constraints</span>
        <span className="cc-constraints-value">{summary}</span>
      </button>

      {open ? (
        <div className="cc-constraints-body">
          <p className="cc-var-label">Avoid</p>
          <div className="cc-kind-row">
            {EXCLUDABLE.map((e) => (
              <button
                key={e.mode}
                type="button"
                className="cc-kind-chip"
                data-active={excluded.includes(e.mode) ? "" : undefined}
                onClick={() => toggle(e.mode)}
                disabled={pending}
              >
                {e.label}
              </button>
            ))}
          </div>

          <label className="cc-time-field" style={{ marginTop: "var(--space-3)" }}>
            <span className="cc-var-label">Be home by</span>
            <input type="time" value={homeBy} onChange={(e) => saveHome(e.target.value)} disabled={pending} />
          </label>
        </div>
      ) : null}
    </div>
  );
}

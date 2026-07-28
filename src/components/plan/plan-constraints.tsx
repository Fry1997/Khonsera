"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleModeExclusion, setHomeBy } from "@/lib/actions/constraints";
import type { PlanConstraints as PlanConstraintsData } from "@/lib/actions/constraints";
import type { TransitionMode } from "@/lib/types/domain";

const EXCLUDABLE: { mode: TransitionMode; label: string }[] = [
  { mode: "flight", label: "Flights" },
  { mode: "tube", label: "The Tube" },
  { mode: "train", label: "Trains" },
  { mode: "bus", label: "Buses" },
  { mode: "taxi", label: "Taxis" },
  { mode: "drive", label: "Driving" },
];

export function PlanConstraints({ initial, data }: { initial?: PlanConstraintsData; data?: PlanConstraintsData }) {
  const resolved = initial ?? data;
  if (!resolved) return null;
  return <PlanConstraintsBody initial={resolved} />;
}

function PlanConstraintsBody({ initial }: { initial: PlanConstraintsData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [excluded, setExcluded] = useState<TransitionMode[]>(initial.excludedModes);
  const [homeBy, setHome] = useState<string>(initial.homeBy ?? "");
  const [pending, setPending] = useState(false);

  const excludedLabels = EXCLUDABLE.filter((e) => excluded.includes(e.mode)).map((e) => e.label);
  const summary = excludedLabels.length || homeBy
    ? [homeBy ? `home by ${homeBy}` : null, ...excludedLabels.map((l) => `no ${l.toLowerCase()}`)].filter(Boolean).join(" · ")
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
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className="cc-constraints-body">
          <label className="cc-constraints-home">
            <span>Be home by</span>
            <input type="time" value={homeBy} onChange={(e) => saveHome(e.target.value)} disabled={pending} />
          </label>
          <div className="cc-constraints-modes">
            <span>Avoid</span>
            {EXCLUDABLE.map((entry) => (
              <button
                key={entry.mode}
                type="button"
                data-active={excluded.includes(entry.mode) ? "true" : "false"}
                onClick={() => toggle(entry.mode)}
                disabled={pending}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

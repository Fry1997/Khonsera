"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { loadCalendarProposals, importCalendarEvents, type CalendarProposal } from "@/lib/actions/calendar-import";
import { Sheet } from "@/components/ui/sheet";

function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(iso));
}

export function PlanCalendarImport({ itineraryId, journeyId }: { itineraryId?: string; journeyId?: string }) {
  const id = itineraryId ?? journeyId;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [proposals, setProposals] = useState<CalendarProposal[] | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  if (!id) return null;

  function start() {
    setOpen(true);
    setError(null);
    setProposals(null);
    setLoading(true);
    void loadCalendarProposals(id).then((res) => {
      setLoading(false);
      if (!res.ok) {
        setError(res.error ?? "Couldn't reach your calendar.");
        return;
      }
      setProposals(res.proposals ?? []);
      setPicked(Object.fromEntries((res.proposals ?? []).map((p) => [p.id, true])));
    });
  }

  function add() {
    if (!proposals) return;
    const chosen = proposals.filter((p) => picked[p.id]);
    if (chosen.length === 0) {
      setError("Tick at least one event.");
      return;
    }
    setPending(true);
    void importCalendarEvents(id, chosen).then((res) => {
      setPending(false);
      if (!res.ok) {
        setError(res.error ?? "Couldn't add those.");
        return;
      }
      setOpen(false);
      router.push(`/plan/${id}` as Route);
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" className="cc-add-trigger" onClick={start}>
        <span aria-hidden>+</span> From calendar
      </button>
      {open ? (
        <Sheet titleId="plan-calendar-import-sheet-title" onClose={() => setOpen(false)}>
          <header className="cc-sheet-head">
            <span className="cc-eyebrow">From your calendar</span>
            <h3 id="plan-calendar-import-sheet-title" className="cc-sheet-title" tabIndex={-1}>Add events to this day</h3>
          </header>
          {loading ? (
            <p className="cc-pick-loading">Reading your calendar…</p>
          ) : proposals && proposals.length === 0 ? (
            <p className="cc-pick-empty">No calendar events over this day.</p>
          ) : proposals ? (
            <div>
              {proposals.map((p) => (
                <label key={p.id} className="cc-pick-row" data-checked={picked[p.id] ? "true" : "false"}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={Boolean(picked[p.id])}
                    onChange={(e) => setPicked((prev) => ({ ...prev, [p.id]: e.target.checked }))}
                  />
                  <span className="cc-pick-box" aria-hidden>✓</span>
                  <span className="cc-pick-main">
                    <span className="cc-pick-title">{p.title}</span>
                    <span className="cc-pick-meta">{clock(p.startIso)}{p.location ? ` · ${p.location}` : ""}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : null}
          {error ? <p className="cc-sheet-error">{error}</p> : null}
          <div className="cc-sheet-actions">
            <button type="button" className="cc-btn cc-btn-ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</button>
            <button type="button" className="cc-btn cc-btn-gold" onClick={add} disabled={pending || loading || !proposals?.length}>
              {pending ? "Adding…" : "Add selected"}
            </button>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}

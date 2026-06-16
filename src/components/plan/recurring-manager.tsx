"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createRecurringEvent,
  deleteRecurringEvent,
  type RecurringEventVM,
} from "@/lib/actions/recurring";
import {
  PlacePicker,
  type PlaceSelection,
  type PlacePickerCustomer,
  type PlacePickerCustomerSite,
  type PlacePickerLocation,
} from "@/components/place-picker";

// Repeating events (mig 0050) on the Plan index. Define "Office, every Thursday,
// 9–5" once; the lazy generator (materializeRecurring) seeds real days ~8 weeks
// ahead — the event only, no transport. Owner-only.

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RecurringManager({
  rules,
  customers,
  customerSites,
  locations,
}: {
  rules: RecurringEventVM[];
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [weekday, setWeekday] = useState(1);
  const [time, setTime] = useState("09:00");
  const [hours, setHours] = useState(8);
  const [mode, setMode] = useState<"work" | "personal">("work");
  const [place, setPlace] = useState<PlaceSelection | null>(null);
  const [error, setError] = useState<string | null>(null);

  function add() {
    if (!title.trim()) { setError("Name the event."); return; }
    setError(null);
    startTransition(async () => {
      const res = await createRecurringEvent({
        title,
        weekday,
        startTime: time,
        durationMinutes: Math.round(hours * 60),
        mode,
        locationId: place?.kind === "location" ? place.location_id : null,
      });
      if (!res.ok) { setError(res.error ?? "Couldn't add that."); return; }
      setTitle(""); setPlace(null);
      router.refresh();
    });
  }
  function remove(id: string) {
    if (!window.confirm("Stop this repeating event? Days already created stay — delete those individually.")) return;
    startTransition(async () => { await deleteRecurringEvent(id); router.refresh(); });
  }

  return (
    <details className="cc-recurring">
      <summary className="cc-recurring-summary">
        <span className="cc-recurring-title">Repeating events</span>
        <span className="cc-recurring-hint">{rules.length ? `${rules.length} set` : "e.g. the office every Thursday"}</span>
      </summary>
      <div className="cc-recurring-body">
        {rules.length ? (
          <ul className="cc-recurring-list">
            {rules.map((r) => (
              <li key={r.id} className="cc-recurring-row">
                <span className="cc-recurring-row-main">
                  <strong>{r.title}</strong> · every {DAYS[r.weekday]} · {r.startTime}
                </span>
                <span className="cc-mode-tag" data-mode={r.mode}>{r.mode === "work" ? "Work" : "Personal"}</span>
                <button type="button" className="cc-recurring-del" onClick={() => remove(r.id)}>Stop</button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="cc-recurring-add">
          <label className="cc-time-field">
            <span className="cc-var-label">What repeats</span>
            <input className="cc-field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The office" />
          </label>
          <div className="cc-time-field">
            <span className="cc-var-label">Where (optional)</span>
            <PlacePicker customers={customers} customerSites={customerSites} locations={locations} value={place} onChange={setPlace} placeholder="Search a place" />
          </div>
          <div className="cc-dur-row">
            <label>
              <span className="cc-var-label">Every</span>
              <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </label>
            <label>
              <span className="cc-var-label">From</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
            <label>
              <span className="cc-var-label">Hours</span>
              <input type="number" min={1} max={24} value={hours} onChange={(e) => setHours(Math.min(24, Math.max(1, Number(e.target.value) || 1)))} />
            </label>
          </div>
          <span className="cc-share-scope">
            <button type="button" data-active={mode === "work" ? "true" : "false"} onClick={() => setMode("work")}>Work</button>
            <button type="button" data-active={mode === "personal" ? "true" : "false"} onClick={() => setMode("personal")}>Personal</button>
          </span>
          {error ? <p className="cc-sheet-error">{error}</p> : null}
          <button type="button" className="cc-btn cc-btn-gold" disabled={pending} onClick={add}>{pending ? "Adding…" : "Add repeating event"}</button>
        </div>
      </div>
    </details>
  );
}

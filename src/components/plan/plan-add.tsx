"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addManualAnchor, addTransport } from "@/lib/actions/plan-edit";
import { wallClockToIso } from "@/lib/time-zone";
import { TransportHubPicker } from "@/components/transport-hub-picker";

// Manual structured add (planner master brief §4.2) — the precise / fallback
// capture door. Three fact types: an Appointment or Place (with a concrete
// ADDRESS so it gets coordinates and routes), or Transport as a STANDALONE fact
// (a train/flight from A to B at a time — no fixed anchor required first).

type Kind = "appointment" | "place" | "transport";
type TMode = "train" | "flight";
type Hub = { id: string | null; label: string | null };

export function PlanAdd({ journeyId, journeyDate }: { journeyId: string; journeyDate: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("appointment");

  // anchor fields
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [time, setTime] = useState("");
  const [hours, setHours] = useState(1);
  const [mins, setMins] = useState(0);

  // transport fields
  const [tmode, setTmode] = useState<TMode>("train");
  const [from, setFrom] = useState<Hub>({ id: null, label: null });
  const [to, setTo] = useState<Hub>({ id: null, label: null });
  const [date, setDate] = useState(journeyDate);
  const [depart, setDepart] = useState("");
  const [arrive, setArrive] = useState("");
  const [reference, setReference] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function reset() {
    setTitle(""); setAddress(""); setTime(""); setHours(1); setMins(0);
    setFrom({ id: null, label: null }); setTo({ id: null, label: null });
    setDate(journeyDate); setDepart(""); setArrive(""); setReference("");
    setError(null);
  }

  function done(res: { ok: boolean; error?: string }) {
    setPending(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't add that.");
      return;
    }
    setOpen(false);
    reset();
    router.refresh();
  }

  function save() {
    setError(null);
    if (kind === "transport") {
      if (!from.label || !to.label) {
        setError("Pick where from and where to.");
        return;
      }
      if (!depart || !arrive) {
        setError("Set depart and arrive times.");
        return;
      }
      setPending(true);
      void addTransport({
        itineraryId: journeyId,
        mode: tmode,
        fromHubId: from.id,
        fromLabel: from.label,
        toHubId: to.id,
        toLabel: to.label,
        date,
        departTime: depart,
        arriveTime: arrive,
        reference: reference || null,
      }).then(done);
      return;
    }

    if (!title.trim()) {
      setError("Give it a name.");
      return;
    }
    setPending(true);
    const iso = time ? wallClockToIso(journeyDate, time) || null : null;
    const durationMinutes = hours * 60 + mins || null;
    void addManualAnchor({
      itineraryId: journeyId,
      kind: kind === "appointment" ? "appointment" : "place",
      title: title.trim(),
      address: address.trim() || null,
      iso,
      durationMinutes,
    }).then(done);
  }

  const hubKind = tmode === "flight" ? "airport" : "rail_station";

  return (
    <>
      <button type="button" className="cc-add-trigger" onClick={() => setOpen(true)}>
        <span aria-hidden>+</span> Add a fact
      </button>

      {open ? (
        <div className="cc-sheet-scrim" onClick={() => setOpen(false)}>
          <div className="cc-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
            <div className="cc-sheet-grip" />
            <header className="cc-sheet-head">
              <span className="cc-eyebrow">Add to the plan</span>
              <h3 className="cc-sheet-title">A new fact</h3>
            </header>

            <div className="cc-kind-row">
              {(["appointment", "place", "transport"] as Kind[]).map((k) => (
                <button key={k} type="button" className="cc-kind-chip" data-active={kind === k ? "" : undefined} onClick={() => setKind(k)}>
                  {k === "appointment" ? "Appointment" : k === "place" ? "Place" : "Transport"}
                </button>
              ))}
            </div>

            {kind === "transport" ? (
              <>
                <div className="cc-kind-row">
                  <button type="button" className="cc-kind-chip" data-active={tmode === "train" ? "" : undefined} onClick={() => setTmode("train")}>Train</button>
                  <button type="button" className="cc-kind-chip" data-active={tmode === "flight" ? "" : undefined} onClick={() => setTmode("flight")}>Flight</button>
                </div>
                <label className="cc-time-field">
                  <span className="cc-var-label">From</span>
                  <TransportHubPicker kind={hubKind} value={from} onChange={setFrom} name="from" placeholder={tmode === "flight" ? "Departure airport" : "From station"} />
                </label>
                <label className="cc-time-field">
                  <span className="cc-var-label">To</span>
                  <TransportHubPicker kind={hubKind} value={to} onChange={setTo} name="to" placeholder={tmode === "flight" ? "Arrival airport" : "To station"} />
                </label>
                <div className="cc-dur-row">
                  <label>
                    <span className="cc-var-label">Date</span>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </label>
                  <label>
                    <span className="cc-var-label">Depart</span>
                    <input type="time" value={depart} onChange={(e) => setDepart(e.target.value)} />
                  </label>
                  <label>
                    <span className="cc-var-label">Arrive</span>
                    <input type="time" value={arrive} onChange={(e) => setArrive(e.target.value)} />
                  </label>
                </div>
                <label className="cc-time-field">
                  <span className="cc-var-label">Booking ref (optional)</span>
                  <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. MC287441" />
                </label>
              </>
            ) : (
              <>
                <label className="cc-time-field">
                  <span className="cc-var-label">{kind === "appointment" ? "What" : "Where"}</span>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder={kind === "appointment" ? "Client meeting" : "The office"} autoFocus />
                </label>
                <label className="cc-time-field">
                  <span className="cc-var-label">Address (optional — pins it on the map)</span>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                    placeholder="1 Example St, London EC1A 1BB" />
                </label>
                <div className="cc-dur-row">
                  <label>
                    <span className="cc-var-label">{kind === "appointment" ? "Arrive by" : "Around"}</span>
                    <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                  </label>
                  <label>
                    <span className="cc-var-label">For (h)</span>
                    <input type="number" min={0} max={23} value={hours} onChange={(e) => setHours(clamp(+e.target.value, 0, 23))} />
                  </label>
                  <label>
                    <span className="cc-var-label">m</span>
                    <input type="number" min={0} max={59} step={5} value={mins} onChange={(e) => setMins(clamp(+e.target.value, 0, 59))} />
                  </label>
                </div>
              </>
            )}

            {error ? <p className="cc-sheet-error">{error}</p> : null}

            <div className="cc-sheet-actions">
              <button type="button" className="cc-btn cc-btn-ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </button>
              <button type="button" className="cc-btn cc-btn-gold" onClick={save} disabled={pending}>
                {pending ? "Adding…" : "Add it"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Number.isNaN(n) ? lo : Math.min(hi, Math.max(lo, n));
}

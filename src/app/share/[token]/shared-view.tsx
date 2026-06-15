"use client";

import { useEffect, useState } from "react";
import { readSharePosition, type SharePosition } from "@/lib/actions/sharing";

// The recipient's live view (Phase 18) — polls the position every 15s while active.
// Chrome-free: `.cc-shared` is the whole body. Skin = Design's sharing layer; the
// `.cc-shared-map` is the ground for a live MapLibre view (positioned) — for now a
// coords + view-on-map link sit on it. `data-ended` swaps to the calm closure.
export function SharedLocationView({ token, initial }: { token: string; initial: SharePosition }) {
  const [pos, setPos] = useState<SharePosition>(initial);

  useEffect(() => {
    if (pos && !pos.active) return;
    const t = setInterval(async () => setPos(await readSharePosition(token)), 15_000);
    return () => clearInterval(t);
  }, [token, pos]);

  const who = pos?.recipient ? `${pos.recipient}, someone is` : "Someone is";
  const ended = !pos || !pos.active;
  const hasPoint = !!pos && pos.lat != null && pos.lng != null;

  return (
    <main className="cc-shared" data-ended={ended ? "true" : "false"}>
      <span className="cc-shared-mark" aria-hidden />
      <span className="cc-shared-eyebrow">Khonsera · live location</span>
      {ended ? (
        <>
          <h1 className="cc-shared-title">This share has <em>ended</em></h1>
          <p className="cc-shared-ended-note">The live location is no longer being shared. Ask them to send a fresh link if you need it.</p>
        </>
      ) : (
        <>
          <h1 className="cc-shared-title">{who} <em>sharing their journey</em></h1>
          <p className="cc-shared-updated">{hasPoint ? `Last updated ${pos!.at ? new Date(pos!.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}` : "Waiting for their first location update…"}</p>
          <div className="cc-shared-map">
            {hasPoint ? (
              <a className="cc-shared-view" href={`https://www.google.com/maps?q=${pos!.lat},${pos!.lng}`} target="_blank" rel="noopener noreferrer">View on map</a>
            ) : null}
          </div>
          {hasPoint ? <p className="cc-shared-foot">{pos!.lat!.toFixed(5)}, {pos!.lng!.toFixed(5)}</p> : null}
        </>
      )}
    </main>
  );
}

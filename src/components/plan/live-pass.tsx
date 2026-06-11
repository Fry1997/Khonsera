"use client";

import { useEffect, useMemo, useState } from "react";
import { Pass } from "@/components/concierge";
import type { TicketVM, TravelStatus } from "@/components/concierge";

// A Pass for one booked rail hop, enriched with live Darwin status. Each
// station-to-station leg renders its OWN card; this wrapper fetches the live
// departure board for the leg's boarding station + planned time (client-side,
// after paint) and folds the live platform + on-time/delayed/cancelled state
// straight ONTO the card — so "WEL · Plat 2" and the status strip update in
// place. With no Darwin key the fetch returns { available:false } and the
// static card (CRS + "On time") simply stands.

type Live = {
  available: boolean;
  status?: TravelStatus;
  label?: string;
  detail?: string;
  platform?: string | null;
};

export function LivePass({
  ticket,
  crs,
  time,
  docked = false,
  onShow,
}: {
  ticket: TicketVM;
  crs?: string | null;
  time?: string | null; // planned departure, London HH:MM (matches Darwin <std>)
  docked?: boolean;
  onShow?: (ticket: TicketVM) => void;
}) {
  const [live, setLive] = useState<Live | null>(null);

  useEffect(() => {
    if (!crs || !time) return;
    let active = true;
    const load = () => {
      fetch(`/api/darwin/departure?crs=${encodeURIComponent(crs)}&time=${encodeURIComponent(time)}`)
        .then((r) => r.json())
        .then((d: Live) => {
          if (active) setLive(d?.available ? d : null);
        })
        .catch(() => {
          /* keep the static card */
        });
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [crs, time]);

  const enriched = useMemo<TicketVM>(() => {
    if (!live?.available) return ticket;
    const leg0 = ticket.legs[0];
    if (!leg0) return ticket;
    const leg = { ...leg0 };
    if (live.platform) leg.origin = { ...leg.origin, platform: live.platform };
    if (live.status) leg.status = { status: live.status, label: live.label, detail: live.detail };
    return { ...ticket, legs: [leg, ...ticket.legs.slice(1)] };
  }, [ticket, live]);

  return <Pass ticket={enriched} docked={docked} onShow={onShow} />;
}

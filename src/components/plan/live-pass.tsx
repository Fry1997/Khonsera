"use client";

import { useEffect, useMemo, useState } from "react";
import { Pass } from "@/components/concierge";
import type {
  BoardingVM,
  TicketVM,
  TravelStatus,
} from "@/components/concierge";

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
  destination?: string | null; // the train's final destination — "the Corby train"
  earlierSamePlatform?: {
    std: string;
    destination?: string;
    platform: string;
  } | null;
};

export function LivePass({
  ticket,
  crs,
  time,
  dest,
  docked = false,
  today = false,
  onShow,
}: {
  ticket: TicketVM;
  crs?: string | null;
  time?: string | null; // planned departure, London HH:MM (matches Darwin <std>)
  dest?: string | null; // hop destination CRS — disambiguates same-minute departures
  docked?: boolean;
  today?: boolean;
  onShow?: (ticket: TicketVM) => void;
}) {
  const [live, setLive] = useState<Live | null>(null);

  useEffect(() => {
    if (!crs || !time) return;
    let active = true;
    const load = () => {
      const qs = new URLSearchParams({ crs, time });
      if (dest) qs.set("dest", dest);
      fetch(`/api/darwin/departure?${qs.toString()}`)
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
  }, [crs, time, dest]);

  const enriched = useMemo<TicketVM>(() => {
    if (!live?.available) return ticket;
    const leg0 = ticket.legs[0];
    if (!leg0) return ticket;
    const leg = { ...leg0 };
    if (live.platform) leg.origin = { ...leg.origin, platform: live.platform };
    if (live.status)
      leg.status = {
        status: live.status,
        label: live.label,
        detail: live.detail,
      };
    return { ...ticket, legs: [leg, ...ticket.legs.slice(1)] };
  }, [ticket, live]);

  // The loud boarding callout. Platform falls back to the booked value (so it
  // shows — and persists — even with no live signal); destination + wrong-train
  // guard come only from a live board. Render only when there's something to say.
  const boarding = useMemo<BoardingVM | undefined>(() => {
    const leg0 = ticket.legs[0];
    if (!leg0 || ticket.kind === "stay") return undefined;
    const platform = live?.platform ?? leg0.origin.platform ?? undefined;
    const toward = live?.destination ?? undefined;
    const e = live?.earlierSamePlatform;
    const lab = ticket.kind === "air" ? "Gate" : "Platform";
    const earlier = e
      ? `${lab} ${e.platform} also has the ${e.std}${e.destination ? ` to ${e.destination}` : ""} before yours — let that one go.`
      : undefined;
    if (!platform && !toward && !earlier) return undefined;
    return { platform, toward, earlier };
  }, [ticket, live]);

  return (
    <Pass
      ticket={enriched}
      boarding={boarding}
      docked={docked}
      today={today}
      onShow={onShow}
    />
  );
}

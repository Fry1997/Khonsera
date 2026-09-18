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
  platformAvailable?: boolean;
  source?: "darwin";
  generatedAt?: string;
  destination?: string | null; // the train's final destination — "the Corby train"
  serviceId?: string | null;
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
  serviceId,
  docked = false,
  today = false,
  onShow,
}: {
  ticket: TicketVM;
  crs?: string | null;
  time?: string | null; // planned departure, London HH:MM (matches Darwin <std>)
  dest?: string | null; // passenger hop destination CRS; never used as train identity
  serviceId?: string | null; // durable Darwin/OpenLDB serviceID when the booked leg has one
  docked?: boolean;
  today?: boolean;
  onShow?: (ticket: TicketVM) => void;
}) {
  const expectsLiveLookup = Boolean(crs && time);
  const [live, setLive] = useState<Live | null>(null);
  const [checkingLive, setCheckingLive] = useState(expectsLiveLookup);
  const [resolvedServiceId, setResolvedServiceId] = useState<string | null>(
    serviceId ?? null,
  );

  useEffect(() => {
    setResolvedServiceId(serviceId ?? null);
  }, [ticket.id, serviceId]);

  useEffect(() => {
    setLive(null);
    setCheckingLive(Boolean(crs && time));
  }, [ticket.id, crs, time]);

  useEffect(() => {
    if (!crs || !time) {
      setCheckingLive(false);
      return;
    }
    let active = true;
    const load = () => {
      const qs = new URLSearchParams({ crs, time });
      if (dest) qs.set("dest", dest);
      if (resolvedServiceId) qs.set("serviceId", resolvedServiceId);
      fetch(`/api/darwin/departure?${qs.toString()}`)
        .then((r) => r.json())
        .then((d: Live) => {
          if (!active) return;
          setLive(d?.available ? d : null);
          setCheckingLive(false);

          // A legacy booking may not have a provider identity yet. Darwin gives
          // us one only after the server has made a confident (unique-minute)
          // match. Adopt it for subsequent polls and persist it for this stop.
          if (!resolvedServiceId && d?.available && d.serviceId) {
            setResolvedServiceId(d.serviceId);
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ticket.id)) {
              void fetch("/api/darwin/departure", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stopId: ticket.id, serviceId: d.serviceId }),
              });
            }
          }
        })
        .catch(() => {
          if (!active) return;
          setCheckingLive(false);
          /* #66 adds the explicit unavailable/stale state after request failure. */
        });
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [crs, time, dest, resolvedServiceId, ticket.id]);

  const enriched = useMemo<TicketVM>(() => {
    if (!live?.available && !checkingLive) return ticket;
    const leg0 = ticket.legs[0];
    if (!leg0) return ticket;
    const leg = {
      ...leg0,
      // From the first live lookup onward, a booked platform must not occupy the
      // current-platform position while Khonsera waits for Darwin. After a live
      // response, only a provider-confirmed platform may replace it.
      origin: {
        ...leg0.origin,
        platform:
          !checkingLive && live?.platform ? live.platform : undefined,
      },
    };
    if (live.status)
      leg.status = {
        status: live.status,
        label: live.label,
        detail: live.detail,
      };
    return { ...ticket, legs: [leg, ...ticket.legs.slice(1)] };
  }, [ticket, live, checkingLive]);

  // The loud boarding callout. During the first live lookup, suppress the booked
  // platform and make the pending verification explicit. A successful live
  // response owns the platform field: no live platform means an unavailable
  // state, never a fallback to the booked value. #66 owns later request failure
  // and stale/unavailable handling.
  const boarding = useMemo<BoardingVM | undefined>(() => {
    const leg0 = ticket.legs[0];
    if (!leg0 || ticket.kind === "stay") return undefined;
    const platform = checkingLive
      ? undefined
      : live
        ? (live.platform ?? undefined)
        : (leg0.origin.platform ?? undefined);
    const platformChecking = checkingLive && expectsLiveLookup;
    const platformUnavailable = Boolean(!checkingLive && live && !live.platform);
    const toward = checkingLive ? undefined : live?.destination ?? undefined;
    const e = live?.earlierSamePlatform;
    const lab = ticket.kind === "air" ? "Gate" : "Platform";
    const earlier = e
      ? `${lab} ${e.platform} also has the ${e.std}${e.destination ? ` to ${e.destination}` : ""} before yours — let that one go.`
      : undefined;
    if (
      !platform &&
      !platformChecking &&
      !platformUnavailable &&
      !toward &&
      !earlier
    )
      return undefined;
    return {
      platform,
      platformChecking,
      platformUnavailable,
      toward,
      earlier,
    };
  }, [ticket, live, checkingLive, expectsLiveLookup]);

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

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
  observedAt?: string;
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
    const leg = { ...leg0 };
    // Suppress the booked platform from the moment a live lookup is in flight.
    // It must never occupy the current-platform position while Khonsera waits
    // to learn whether Darwin confirms, suppresses or changes it.
    const origin = { ...leg.origin };
    if (!checkingLive && live?.platform) origin.platform = live.platform;
    else delete origin.platform;
    leg.origin = origin;
    if (live?.status)
      leg.status = {
        status: live.status,
        label: live.label,
        detail: live.detail,
      };
    return { ...ticket, legs: [leg, ...ticket.legs.slice(1)] };
  }, [ticket, live, checkingLive]);

  // The loud boarding callout. While the first live lookup is pending, suppress
  // the booked platform and say that Khonsera is checking. Once Darwin responds
  // for this service, only a provider-confirmed platform is allowed in the live
  // boarding position. Missing/suppressed live platform data becomes an explicit
  // waiting state instead of falling back to the booking.
  const boarding = useMemo<BoardingVM | undefined>(() => {
    const leg0 = ticket.legs[0];
    if (!leg0 || ticket.kind === "stay") return undefined;
    const hasLiveService = Boolean(live?.available);
    const platform = checkingLive
      ? undefined
      : hasLiveService
        ? live?.platform ?? undefined
        : leg0.origin.platform ?? undefined;
    const toward = checkingLive ? undefined : live?.destination ?? undefined;
    const e = live?.earlierSamePlatform;
    const lab = ticket.kind === "air" ? "Gate" : "Platform";
    const earlier = e
      ? `${lab} ${e.platform} also has the ${e.std}${e.destination ? ` to ${e.destination}` : ""} before yours — let that one go.`
      : undefined;
    const platformChecking = checkingLive && expectsLiveLookup;
    const platformUnavailable = hasLiveService && !platform;
    if (
      !platform &&
      !toward &&
      !earlier &&
      !platformUnavailable &&
      !platformChecking
    )
      return undefined;
    return {
      platform,
      toward,
      earlier,
      platformUnavailable,
      platformChecking,
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

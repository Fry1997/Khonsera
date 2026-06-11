// Darwin live rail status (National Rail) via OpenLDBWS — the request/response
// "Live Departure Board" web service. Powered by the same Darwin engine as the
// streaming Push Port feed, but query-on-demand, so it fits serverless: ask for
// a station's departures, match the booked service by time, read its live status.
//
// GATED: returns `null` (no-op) unless DARWIN_LDBWS_TOKEN is set, so this is
// completely inert until a token is configured — zero cost on every page.
//
// This is a tiny hand-built SOAP call (no heavy SOAP lib → Vercel-safe) and the
// response is parsed namespace-prefix-agnostically (the prefixes vary by row).

import type { TravelStatus } from "@/components/concierge";

const LDBWS_ENDPOINT =
  process.env.DARWIN_LDBWS_ENDPOINT ??
  "https://lite.realtime.nationalrail.co.uk/OpenLDBWS/ldb12.asmx";
const LDB_NS = "http://thales.com/RTTI/2021-11-01/ldb/";
const TOKEN_NS = "http://thalesgroup.com/RTTI/2013-11-28/Token/types";

export function darwinToken(): string | null {
  return process.env.DARWIN_LDBWS_TOKEN ?? null;
}

export type LiveDeparture = {
  status: TravelStatus;
  label: string; // "On time" · "Delayed" · "Cancelled" · "Now 07:38"
  detail?: string; // "+13 min" · "Platform 2"
  platform?: string;
  std: string; // scheduled departure HH:MM
  etd: string; // raw estimate from Darwin ("On time" | "07:38" | "Cancelled" | "Delayed")
  destination?: string;
};

// Local-name regex (ignores the lt/lt4/lt7… prefixes Darwin uses per element).
function tag(name: string): RegExp {
  return new RegExp(`<(?:\\w+:)?${name}>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>`);
}
function first(xml: string, name: string): string | undefined {
  return xml.match(tag(name))?.[1]?.trim() || undefined;
}

// Fetch the live departure board for `crs` and return the service whose scheduled
// departure matches `plannedHHMM` (London 24h). null on any failure / no token /
// no match — the caller falls back to the static badge.
export async function liveDeparture(
  crs: string,
  plannedHHMM: string,
): Promise<LiveDeparture | null> {
  const token = darwinToken();
  if (!token || !crs || !plannedHHMM) return null;

  const body =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:typ="${TOKEN_NS}" xmlns:ldb="${LDB_NS}">` +
    `<soap:Header><typ:AccessToken><typ:TokenValue>${token}</typ:TokenValue></typ:AccessToken></soap:Header>` +
    `<soap:Body><ldb:GetDepartureBoardRequest><ldb:numRows>15</ldb:numRows><ldb:crs>${crs.toUpperCase()}</ldb:crs></ldb:GetDepartureBoardRequest></soap:Body>` +
    `</soap:Envelope>`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  let xml: string;
  try {
    const res = await fetch(LDBWS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `${LDB_NS}GetDepartureBoard`,
      },
      body,
      signal: controller.signal,
    });
    if (!res.ok) return null;
    xml = await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }

  // Each <service>…</service> is one departure. Find the one whose <std> matches.
  const services = xml.split(/<(?:\w+:)?service>/).slice(1);
  for (const raw of services) {
    const svc = raw.split(/<\/(?:\w+:)?service>/)[0];
    const std = first(svc, "std");
    if (std !== plannedHHMM) continue;

    const etd = first(svc, "etd") ?? "On time";
    const platform = first(svc, "platform");
    // destination station name (first <location> inside <destination>)
    const destBlock = svc.match(/<(?:\w+:)?destination>([\s\S]*?)<\/(?:\w+:)?destination>/)?.[1] ?? "";
    const destination = first(destBlock, "locationName");

    return toLiveDeparture(std, etd, platform, destination);
  }
  return null;
}

function toLiveDeparture(
  std: string,
  etd: string,
  platform: string | undefined,
  destination: string | undefined,
): LiveDeparture {
  const base = { std, etd, platform, destination } as const;

  if (/cancel/i.test(etd)) {
    return { ...base, status: "cancelled", label: "Cancelled" };
  }
  if (/^on time$/i.test(etd)) {
    return {
      ...base,
      status: "on_time",
      label: "On time",
      detail: platform ? `Platform ${platform}` : undefined,
    };
  }
  // A revised HH:MM, or the word "Delayed".
  const revised = etd.match(/^(\d{1,2}):(\d{2})$/);
  if (revised) {
    const mins = hhmmDiff(std, etd);
    return {
      ...base,
      status: "delayed",
      label: `Now ${etd}`,
      detail: mins > 0 ? `+${mins} min${platform ? ` · Platform ${platform}` : ""}` : platform ? `Platform ${platform}` : undefined,
    };
  }
  return {
    ...base,
    status: "delayed",
    label: "Delayed",
    detail: platform ? `Platform ${platform}` : undefined,
  };
}

function hhmmDiff(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  if ([ah, am, bh, bm].some((n) => Number.isNaN(n))) return 0;
  return bh * 60 + bm - (ah * 60 + am);
}

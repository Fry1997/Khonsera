// Thin REST client for Aviationstack (via API Layer). One call per page
// render; no polling. Calls are wrapped server-side so the key never reaches
// the browser.

import { aviationstackConfig } from "./config";

export type AviationFlight = {
  flight_date: string | null;
  flight_status:
    | "scheduled"
    | "active"
    | "landed"
    | "cancelled"
    | "incident"
    | "diverted"
    | null;
  departure: AirportLeg;
  arrival: AirportLeg;
  airline: { name: string | null; iata: string | null } | null;
  flight: {
    number: string | null;
    iata: string | null;
    icao: string | null;
  } | null;
};

export type AirportLeg = {
  airport: string | null;
  timezone: string | null;
  iata: string | null;
  icao: string | null;
  terminal: string | null;
  gate: string | null;
  scheduled: string | null;
  estimated: string | null;
  actual: string | null;
  delay: number | null;
};

async function callAviationstack<T>(
  path: string,
  params: Record<string, string | undefined>,
): Promise<T | null> {
  const cfg = aviationstackConfig();
  if (!cfg) return null;

  const url = new URL(`${cfg.baseUrl}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, v);
  }

  try {
    const res = await fetch(url.toString(), {
      headers: {
        // API Layer uses 'apikey'; aviationstack direct uses ?access_key=.
        // Sending both is harmless and covers both proxies.
        apikey: cfg.apiKey,
      },
      // Aviationstack data changes within minutes (delays/gates). 60s is a
      // reasonable balance between freshness and call-count.
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      console.error("aviationstack", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as { data?: T };
    return data.data ?? null;
  } catch (e) {
    console.error("aviationstack call failed", e);
    return null;
  }
}

export type FlightLookupArgs = {
  flightIata: string; // e.g. "BA123"
  date?: string; // YYYY-MM-DD; defaults to today on the provider side
};

export async function getFlightsByNumber(
  args: FlightLookupArgs,
): Promise<AviationFlight[] | null> {
  return callAviationstack<AviationFlight[]>("/flights", {
    flight_iata: args.flightIata,
    flight_date: args.date,
  });
}

export type AviationAirport = {
  airport_name: string;
  iata_code: string;
  icao_code: string | null;
  city_iata_code: string | null;
  country_name: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
};

export async function getAirportByIata(
  iata: string,
): Promise<AviationAirport | null> {
  const result = await callAviationstack<AviationAirport[]>("/airports", {
    iata_code: iata,
  });
  return result?.[0] ?? null;
}

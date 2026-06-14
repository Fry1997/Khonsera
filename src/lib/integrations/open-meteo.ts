// Open-Meteo adapter (Phase 12) — corridor weather for the leave-earlier rule.
// FREE + KEYLESS (https://open-meteo.com), so it runs live in prod with no
// procurement: there's no key to gate on. We still degrade gracefully — a failed
// fetch returns null and the rule simply doesn't fire (no weather, no nudge).
//
// The PARSE is pure (`summarizeCorridor`) so it unit-tests against a fixture with
// no network; the fetch is a thin wrapper. Day one samples a single point (the
// leg's destination) over the travel window — multi-point corridor sampling is
// the capability-map deferral.

import type { CorridorWeather } from "@/lib/context/engine";

const BASE = process.env.OPEN_METEO_URL ?? "https://api.open-meteo.com/v1/forecast";

// Thresholds (mm/h precip, km/h gusts) for the human headline + severity. Fixed
// sensible defaults — the same posture as the engine's other thresholds.
const PRECIP_MODERATE = 1.5;
const PRECIP_SEVERE = 4;
const GUST_MODERATE = 40;
const GUST_SEVERE = 60;

export type OpenMeteoHourly = {
  time?: string[];
  precipitation?: number[];
  wind_gusts_10m?: number[];
  snowfall?: number[];
  visibility?: number[];
};
export type OpenMeteoResponse = { hourly?: OpenMeteoHourly };

// Reduce the hourly forecast within [startIso, endIso] to the worst conditions
// crossed → the CorridorWeather the engine reasons over. Pure.
export function summarizeCorridor(res: OpenMeteoResponse, startIso: string, endIso: string): CorridorWeather {
  const h = res.hourly ?? {};
  const times = h.time ?? [];
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  let maxPrecip = 0;
  let maxGust = 0;
  let snow = false;
  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]).getTime();
    if (Number.isNaN(t) || t < startMs || t > endMs) continue;
    maxPrecip = Math.max(maxPrecip, h.precipitation?.[i] ?? 0);
    maxGust = Math.max(maxGust, h.wind_gusts_10m?.[i] ?? 0);
    if ((h.snowfall?.[i] ?? 0) > 0) snow = true;
  }
  let severity: CorridorWeather["severity"] = "none";
  if (snow || maxPrecip >= PRECIP_SEVERE || maxGust >= GUST_SEVERE) severity = "severe";
  else if (maxPrecip >= PRECIP_MODERATE || maxGust >= GUST_MODERATE) severity = "moderate";

  const headline = snow
    ? "Snow"
    : maxPrecip >= PRECIP_SEVERE
      ? "Heavy rain"
      : maxGust >= GUST_SEVERE
        ? "Strong gusts"
        : maxPrecip >= PRECIP_MODERATE
          ? "Rain"
          : maxGust >= GUST_MODERATE
            ? "Windy"
            : "Clear";
  return { severity, headline, maxPrecipMm: Math.round(maxPrecip * 10) / 10, maxGustKmh: Math.round(maxGust), snow };
}

// Live fetch (keyless). Null on any failure → the rule stays silent.
export async function corridorForecast(args: {
  lat: number;
  lng: number;
  startIso: string;
  endIso: string;
}): Promise<CorridorWeather | null> {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(args.startIso));
  const url =
    `${BASE}?latitude=${args.lat.toFixed(4)}&longitude=${args.lng.toFixed(4)}` +
    `&hourly=precipitation,wind_gusts_10m,snowfall,visibility&start_date=${date}&end_date=${date}&timezone=Europe%2FLondon`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const json = (await res.json()) as OpenMeteoResponse;
    // Open-Meteo returns local times without an offset; treat them as Europe/London,
    // which is what the timezone param asked for — compare on the same wall clock.
    return summarizeCorridor(json, localizeWindow(args.startIso), localizeWindow(args.endIso));
  } catch {
    return null;
  }
}

// The API's hourly `time` strings are local (no Z). Strip our ISO to the same
// shape so the in-window comparison lines up.
function localizeWindow(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .format(new Date(iso))
    .replace(" ", "T");
}

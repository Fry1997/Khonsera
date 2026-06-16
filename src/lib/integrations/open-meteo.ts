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

// Today's hourly forecast (from the current hour to end of day, Europe/London) —
// the temperature + condition for each hour, for the Today strip. Cached 30 min;
// empty on failure → the strip is omitted.
export type ForecastHour = { label: string; tempC: number; code: number; headline: string };

export async function dayForecast(args: { lat: number; lng: number }): Promise<ForecastHour[]> {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const url =
    `${BASE}?latitude=${args.lat.toFixed(4)}&longitude=${args.lng.toFixed(4)}` +
    `&hourly=temperature_2m,weather_code&start_date=${date}&end_date=${date}&timezone=Europe%2FLondon`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const json = (await res.json()) as { hourly?: { time?: string[]; temperature_2m?: number[]; weather_code?: number[] } };
    const h = json.hourly;
    if (!h?.time?.length) return [];
    const nowHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(new Date()));
    const out: ForecastHour[] = [];
    for (let i = 0; i < h.time.length; i++) {
      const hh = Number(h.time[i].slice(11, 13));
      if (Number.isNaN(hh) || hh < nowHour) continue; // only the rest of today
      const temp = h.temperature_2m?.[i];
      if (temp == null) continue;
      const code = h.weather_code?.[i] ?? 0;
      out.push({ label: `${String(hh).padStart(2, "0")}:00`, tempC: Math.round(temp), code, headline: wmoHeadline(code) });
    }
    return out;
  } catch {
    return [];
  }
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

// Current conditions at a point — for the Today weather strip (it renders the
// integration we already pay for). Cached 30 min via the Next data cache, so the
// page renders WHOLE (no clumsy fill-in) and most loads are a cache hit. Null on
// any failure → Today simply omits the strip.
export type CurrentWeather = { tempC: number; headline: string; code: number; isDay: boolean };

export async function currentConditions(args: { lat: number; lng: number }): Promise<CurrentWeather | null> {
  const url =
    `${BASE}?latitude=${args.lat.toFixed(4)}&longitude=${args.lng.toFixed(4)}` +
    `&current=temperature_2m,weather_code,is_day&timezone=Europe%2FLondon`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const json = (await res.json()) as { current?: { temperature_2m?: number; weather_code?: number; is_day?: number } };
    const c = json.current;
    if (!c || c.temperature_2m == null) return null;
    const code = c.weather_code ?? 0;
    return { tempC: Math.round(c.temperature_2m), headline: wmoHeadline(code), code, isDay: c.is_day !== 0 };
  } catch {
    return null;
  }
}

// WMO weather-code → a short human headline (no emoji). Bucketed sensibly.
function wmoHeadline(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Mostly clear";
  if (code === 3) return "Cloudy";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorm";
}

// The API's hourly `time` strings are local (no Z). Strip our ISO to the same
// shape so the in-window comparison lines up.
function localizeWindow(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .format(new Date(iso))
    .replace(" ", "T");
}

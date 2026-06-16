"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { currentConditions, dayForecast, type CurrentWeather, type ForecastHour } from "@/lib/integrations/open-meteo";

export type LocalWeather = CurrentWeather & { place: string; hours: ForecastHour[] };

// "Weather where you are" for the Today strip. Uses the user's home/office
// location coords (server-known — no GPS prompt, so it renders whole with no
// pop-in) and the cached Open-Meteo current conditions. Null → Today omits it.
// (Future: prefer today's plan location, or an opt-in device-GPS reading.)
export async function getLocalWeather(): Promise<LocalWeather | null> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: loc } = await supabase
    .from("locations")
    .select("name, latitude, longitude, type")
    .eq("user_id", ctx.userId)
    .eq("workspace_id", ctx.workspaceId)
    .in("type", ["home", "office"])
    .not("latitude", "is", null)
    .order("type")
    .limit(1)
    .maybeSingle();

  const lat = loc?.latitude as number | null | undefined;
  const lng = loc?.longitude as number | null | undefined;
  if (lat == null || lng == null) return null;

  const [w, hours] = await Promise.all([
    currentConditions({ lat, lng }),
    dayForecast({ lat, lng }),
  ]);
  if (!w) return null;
  return { ...w, place: (loc?.name as string) ?? "Home", hours };
}

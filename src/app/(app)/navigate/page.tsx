import { requireUserContext } from "@/lib/auth";
import { AppScreen } from "@/components/ui/page-shell";
import { NavigateScreen } from "@/components/nav/navigate-screen";
import type { NavPoint } from "@/lib/nav/types";

// Navigate (build spine §6) — point-to-point door navigation on the open
// stack: Valhalla routing, Photon geocoding, MapLibre/OSM rendering, all
// self-hostable by env var. Other surfaces deep-link a destination via
// ?dlat=&dlng=&dname= (an anchor's "take me there" hands off here).
export default async function NavigatePage({
  searchParams,
}: {
  searchParams: Promise<{ dlat?: string; dlng?: string; dname?: string }>;
}) {
  const ctx = await requireUserContext();
  const sp = await searchParams;

  let initialDestination: NavPoint | null = null;
  const lat = Number(sp.dlat);
  const lng = Number(sp.dlng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && sp.dname) {
    initialDestination = { lat, lng, name: sp.dname.slice(0, 160) };
  }

  return (
    <AppScreen eyebrow="Navigate" title="Point to point">
      <NavigateScreen initialDestination={initialDestination} />
    </AppScreen>
  );
}

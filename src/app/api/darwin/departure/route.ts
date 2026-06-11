import { NextResponse } from "next/server";
import { requireUserContext } from "@/lib/auth";
import { darwinKey, liveDeparture, debugDeparture } from "@/lib/integrations/darwin";

// Live departure status for a booked Pass. Client-side fetch (so the page render
// is never blocked). Returns { available: false } when no key is configured — the
// caller just keeps the static badge. Auth-gated so it isn't an open proxy.
export async function GET(request: Request) {
  try {
    await requireUserContext();
  } catch {
    return NextResponse.json({ available: false }, { status: 401 });
  }

  if (!darwinKey()) {
    return NextResponse.json({ available: false });
  }

  const url = new URL(request.url);
  const crs = url.searchParams.get("crs");
  const time = url.searchParams.get("time"); // planned departure HH:MM (London)
  const dest = url.searchParams.get("dest"); // optional destination CRS to disambiguate
  if (!crs || !time) {
    return NextResponse.json({ available: false });
  }

  // ?debug=1 → reveal the cause (key-present boolean, HTTP status, board contents)
  // without ever exposing the key.
  if (url.searchParams.get("debug")) {
    return NextResponse.json(await debugDeparture(crs, time));
  }

  const live = await liveDeparture(crs, time, dest);
  if (!live) return NextResponse.json({ available: false });

  return NextResponse.json(
    { available: true, ...live },
    // Short private cache so a few refreshes don't re-hit Darwin per second.
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}

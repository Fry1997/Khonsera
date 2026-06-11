import { NextResponse } from "next/server";
import { requireUserContext } from "@/lib/auth";
import { darwinToken, liveDeparture } from "@/lib/integrations/darwin";

// Live departure status for a booked Pass. Client-side fetch (so the page render
// is never blocked). Returns { available: false } when no token is configured —
// the caller just keeps the static badge. Auth-gated so it isn't an open proxy.
export async function GET(request: Request) {
  try {
    await requireUserContext();
  } catch {
    return NextResponse.json({ available: false }, { status: 401 });
  }

  if (!darwinToken()) {
    return NextResponse.json({ available: false });
  }

  const url = new URL(request.url);
  const crs = url.searchParams.get("crs");
  const time = url.searchParams.get("time"); // planned departure HH:MM (London)
  if (!crs || !time) {
    return NextResponse.json({ available: false });
  }

  const live = await liveDeparture(crs, time);
  if (!live) return NextResponse.json({ available: false });

  return NextResponse.json(
    { available: true, ...live },
    // Short private cache so a few refreshes don't re-hit Darwin per second.
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}

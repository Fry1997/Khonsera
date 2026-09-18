import { NextResponse } from "next/server";
import { liveDeparture } from "@/lib/integrations/darwin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const crs = url.searchParams.get("crs")?.trim().toUpperCase();
  const time = url.searchParams.get("time")?.trim();
  const dest = url.searchParams.get("dest")?.trim().toUpperCase() || null;

  if (!crs || !/^\d{2}:\d{2}$/.test(time ?? "")) {
    return NextResponse.json(
      { error: "crs and HH:MM time are required" },
      { status: 400 },
    );
  }

  const live = await liveDeparture(crs, time!, dest);
  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    query: { crs, time, dest },
    available: Boolean(live),
    live,
  });
}

import { NextResponse } from "next/server";
import { requireUserContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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

  const url = new URL(request.url);
  const crs = url.searchParams.get("crs");
  const time = url.searchParams.get("time"); // planned departure HH:MM (London)
  const dest = url.searchParams.get("dest"); // passenger hop destination context, not service identity
  const serviceId = url.searchParams.get("serviceId"); // durable Darwin/OpenLDB serviceID when known

  // ?debug=1 → reveal the cause (key-present boolean, HTTP status, board contents)
  // without ever exposing the key. Runs BEFORE the key gate so it can report
  // keyPresent:false explicitly instead of a bare {available:false}.
  if (url.searchParams.get("debug")) {
    return NextResponse.json(await debugDeparture(crs ?? "", time ?? ""));
  }

  if (!darwinKey()) {
    return NextResponse.json({ available: false });
  }
  if (!crs || !time) {
    return NextResponse.json({ available: false });
  }

  const live = await liveDeparture(crs, time, dest, serviceId);
  if (!live) return NextResponse.json({ available: false });

  return NextResponse.json(
    { available: true, ...live },
    // Short private cache so a few refreshes don't re-hit Darwin per second.
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}


export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireUserContext();
  } catch {
    return NextResponse.json({ bound: false }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ bound: false }, { status: 400 });
  }

  const input = body as { stopId?: unknown; serviceId?: unknown };
  const stopId = typeof input.stopId === "string" ? input.stopId.trim() : "";
  const serviceId = typeof input.serviceId === "string" ? input.serviceId.trim() : "";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(stopId) || !serviceId || serviceId.length > 200) {
    return NextResponse.json({ bound: false }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: stop, error: readError } = await supabase
    .from("stops")
    .select("metadata")
    .eq("id", stopId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  if (readError || !stop) {
    return NextResponse.json({ bound: false }, { status: 404 });
  }

  const metadata =
    stop.metadata &&
    typeof stop.metadata === "object" &&
    !Array.isArray(stop.metadata)
      ? (stop.metadata as Record<string, unknown>)
      : {};
  const existing =
    typeof metadata.provider_service_id === "string"
      ? metadata.provider_service_id
      : null;

  // Never replace an already-bound service identity from a client request.
  if (existing) {
    return NextResponse.json(
      { bound: existing === serviceId, serviceId: existing },
      { status: existing === serviceId ? 200 : 409 },
    );
  }

  const { error: updateError } = await supabase
    .from("stops")
    .update({
      metadata: {
        ...metadata,
        provider_service_id: serviceId,
      },
    })
    .eq("id", stopId)
    .eq("workspace_id", ctx.workspaceId);

  if (updateError) {
    return NextResponse.json({ bound: false }, { status: 500 });
  }

  return NextResponse.json({ bound: true, serviceId });
}

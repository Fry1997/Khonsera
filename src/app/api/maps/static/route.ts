// Proxy for Google Static Maps. The browser never sees the API key — it
// fetches /api/maps/static?spec=<base64-encoded-spec>, this route validates
// the spec, signs the upstream URL with our key, and streams the image back
// with aggressive caching.
//
// The "spec" is just our internal description of what to draw. We avoid
// allowing the client to forge arbitrary Google URLs — they can only ask for
// maps composed of markers + polylines we accept.

import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  buildStaticMapUrl,
  type MapStyle,
  type StaticMapMarker,
  type StaticMapPath,
} from "@/lib/google/maps";

type Spec = {
  width: number;
  height: number;
  zoom?: number;
  center?: { lat: number; lng: number };
  markers?: StaticMapMarker[];
  paths?: StaticMapPath[];
  style?: MapStyle;
};

export async function GET(request: NextRequest) {
  // Authenticated users only — keeps API budget tied to signed-in usage.
  await requireUser();

  const spec64 = request.nextUrl.searchParams.get("s");
  if (!spec64) {
    return NextResponse.json({ error: "missing spec" }, { status: 400 });
  }

  let spec: Spec;
  try {
    spec = JSON.parse(Buffer.from(spec64, "base64url").toString("utf8")) as Spec;
  } catch {
    return NextResponse.json({ error: "bad spec" }, { status: 400 });
  }

  // Defensive bounds — Static Maps caps at 640x640 without premium.
  spec.width = Math.min(Math.max(spec.width || 320, 100), 640);
  spec.height = Math.min(Math.max(spec.height || 200, 100), 640);

  const url = buildStaticMapUrl(spec);
  if (!url) {
    return new NextResponse("Maps not configured", { status: 503 });
  }

  const upstream = await fetch(url);
  if (!upstream.ok) {
    return new NextResponse("Map fetch failed", { status: 502 });
  }

  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      // Cache aggressively — the same spec always renders the same image.
      "Cache-Control": "public, max-age=3600, s-maxage=86400, immutable",
    },
  });
}

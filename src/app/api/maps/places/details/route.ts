// Server proxy for Google Place Details. Returns the fields we need to
// materialise a place into our `locations` table (formatted address, lat/lng,
// postcode, types).

import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { getPlaceDetails, locationTypeFromGoogleTypes } from "@/lib/google/places";
import { mapsApiKey } from "@/lib/google/maps";

export async function GET(request: NextRequest) {
  await requireUser();

  if (!mapsApiKey()) {
    return NextResponse.json({ error: "maps_not_configured" }, { status: 503 });
  }

  const placeId = request.nextUrl.searchParams.get("place_id")?.trim();
  const session = request.nextUrl.searchParams.get("session") ?? undefined;

  if (!placeId) {
    return NextResponse.json({ error: "missing place_id" }, { status: 400 });
  }

  const details = await getPlaceDetails({ placeId, sessionToken: session });
  if (!details) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    place: details,
    suggested_type: locationTypeFromGoogleTypes(details.types),
  });
}

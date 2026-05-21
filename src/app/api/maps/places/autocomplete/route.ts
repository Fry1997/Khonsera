// Server proxy for Google Places Autocomplete. Authenticated calls only —
// keeps our key off the browser and ties API spend to signed-in users.

import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { autocompletePlaces } from "@/lib/google/places";
import { mapsApiKey } from "@/lib/google/maps";

export async function GET(request: NextRequest) {
  await requireUser();

  if (!mapsApiKey()) {
    return NextResponse.json({ suggestions: [], configured: false });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const session = request.nextUrl.searchParams.get("session") ?? undefined;
  const types = request.nextUrl.searchParams.get("types") || null;
  const country = request.nextUrl.searchParams.get("country");

  if (query.length < 2) {
    return NextResponse.json({ suggestions: [], configured: true });
  }

  const { suggestions, failure } = await autocompletePlaces({
    query,
    sessionToken: session,
    types,
    country: country === "" ? null : country,
  });

  // Surface Google's failure reason in the response so it's visible in
  // the browser network panel without having to crack open Vercel's
  // truncated log viewer.
  return NextResponse.json({
    suggestions,
    configured: true,
    ...(failure ? { failure } : {}),
  });
}

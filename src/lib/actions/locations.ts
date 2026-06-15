"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit/with-audit";
import { dbResult, maybeGeocode, parseInput } from "./_helpers";
import { geocodeAddress } from "@/lib/google/maps";
import {
  getPlaceDetails,
  locationTypeFromGoogleTypes,
} from "@/lib/google/places";
import type { Result } from "@/lib/errors";
import type { LocationType } from "@/lib/types/domain";

const locationTypeEnum = z.enum([
  "home",
  "office",
  "station",
  "hotel",
  "customer_site",
  "parking",
  "other",
]);

const baseLocationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: locationTypeEnum,
  address: z.string().trim().max(500).optional().nullable(),
  postcode: z.string().trim().max(16).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const updateLocationSchema = baseLocationSchema.extend({ id: z.string().uuid() });

export type Location = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  name: string;
  type: LocationType;
  address: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function createLocation(
  input: z.input<typeof baseLocationSchema>,
): Promise<Result<Location>> {
  const parsed = parseInput(baseLocationSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();
  const geocoded = await maybeGeocode(parsed.value);

  const { data, error } = await supabase
    .from("locations")
    .insert({
      ...geocoded,
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
    })
    .select("*")
    .single();

  const result = dbResult<Location>(data, error, "location");
  if (result.ok) {
    await recordAudit({
      entityType: "location",
      entityId: result.value.id,
      action: "create",
      after: result.value,
    });
  }
  return result;
}

export async function updateLocation(
  input: z.input<typeof updateLocationSchema>,
): Promise<Result<Location>> {
  const parsed = parseInput(updateLocationSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("locations")
    .select("*")
    .eq("id", parsed.value.id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  const { id, ...patch } = parsed.value;
  const geocoded = await maybeGeocode(patch);
  const { data, error } = await supabase
    .from("locations")
    .update(geocoded)
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .select("*")
    .single();

  const result = dbResult<Location>(data, error, "location");
  if (result.ok) {
    await recordAudit({
      entityType: "location",
      entityId: result.value.id,
      action: "update",
      before,
      after: result.value,
    });
  }
  return result;
}

// Inline-create a location from the place picker. Distinct from createLocation
// because the user may only know the name ("Wellingborough train station"),
// not a clean address — so we geocode by name when no address is given.
const inlineLocationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: locationTypeEnum.optional(),
  address: z.string().trim().max(500).nullable().optional(),
  // Optional Google place identifier — when present we resolve coords +
  // address from Places Details (more accurate than free-text geocoding).
  google_place_id: z.string().trim().max(200).nullable().optional(),
  google_session_token: z.string().trim().max(80).nullable().optional(),
});

export async function createInlineLocation(
  input: z.input<typeof inlineLocationSchema>,
): Promise<Result<Location>> {
  const parsed = parseInput(inlineLocationSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  let address = parsed.value.address ?? null;
  let latitude: number | null = null;
  let longitude: number | null = null;
  let postcode: string | null = null;
  let resolvedType: LocationType = parsed.value.type ?? "other";

  // Path A — caller selected a Google place. Use Place Details for the most
  // accurate values and override "other" type when Google tells us this is a
  // station / airport / hotel etc.
  if (parsed.value.google_place_id) {
    const details = await getPlaceDetails({
      placeId: parsed.value.google_place_id,
      sessionToken: parsed.value.google_session_token ?? undefined,
    });
    if (details) {
      latitude = details.latitude;
      longitude = details.longitude;
      address = address ?? details.formatted_address;
      postcode = details.postcode;
      if (!parsed.value.type || parsed.value.type === "other") {
        resolvedType = locationTypeFromGoogleTypes(details.types);
      }
    }
  }

  // Path B — fall back to geocoding by the address or name.
  if (latitude == null || longitude == null) {
    const query = address ?? parsed.value.name;
    const geo = await geocodeAddress(query);
    if (geo) {
      latitude = geo.lat;
      longitude = geo.lng;
      if (!address) address = geo.formattedAddress;
    }
  }

  // Dedup before insert: re-picking the same place (e.g. setting your base again,
  // or adding home to two plans) must NOT mint a duplicate location. Reuse an
  // existing one for this user with the same formatted address (stable per Google
  // place), else the same name sitting at the same coordinates (~55m). Without
  // this, every pick of "Home" created another row — the duplicate-base bug.
  const { data: existing } = await supabase
    .from("locations")
    .select("*")
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", ctx.userId);
  const near = (a: number | null, b: number | null) => a != null && b != null && Math.abs(a - b) < 0.0005;
  const match = (existing ?? []).find((l) => {
    if (address && l.address && String(l.address).toLowerCase() === address.toLowerCase()) return true;
    return (
      String(l.name).toLowerCase() === parsed.value.name.toLowerCase() &&
      near(l.latitude as number | null, latitude) &&
      near(l.longitude as number | null, longitude)
    );
  });
  if (match) return { ok: true, value: match as Location };

  const { data, error } = await supabase
    .from("locations")
    .insert({
      name: parsed.value.name,
      type: resolvedType,
      address,
      postcode,
      latitude,
      longitude,
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
    })
    .select("*")
    .single();

  const result = dbResult<Location>(data, error, "location");
  if (result.ok) {
    await recordAudit({
      entityType: "location",
      entityId: result.value.id,
      action: "create",
      after: result.value,
    });
  }
  return result;
}

// Patch just the type on a location — used when the user overrides
// Google's inferred classification (e.g. "actually this is a hotel").
const updateLocationTypeSchema = z.object({
  id: z.string().uuid(),
  type: locationTypeEnum,
});

export async function updateLocationType(
  input: z.input<typeof updateLocationTypeSchema>,
): Promise<Result<{ id: string; type: string }>> {
  const parsed = parseInput(updateLocationTypeSchema, input);
  if (!parsed.ok) return parsed;

  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("locations")
    .update({ type: parsed.value.type })
    .eq("id", parsed.value.id)
    .eq("workspace_id", ctx.workspaceId)
    .select("id, type")
    .single();

  const result = dbResult<{ id: string; type: string }>(data, error, "location");
  if (result.ok) {
    await recordAudit({
      entityType: "location",
      entityId: result.value.id,
      action: "update_type",
      after: result.value,
    });
  }
  return result;
}

export async function deleteLocation(id: string): Promise<Result<{ id: string }>> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("locations")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  const { error } = await supabase
    .from("locations")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);

  if (error) return dbResult<{ id: string }>(null, error, "location");
  await recordAudit({
    entityType: "location",
    entityId: id,
    action: "delete",
    before,
  });
  return { ok: true, value: { id } };
}

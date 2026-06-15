"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { trackDistanceMeters, metersToMiles, buildReport, taxYearOf, type MileageReport, type Vehicle } from "@/lib/mileage/engine";

// Mileage actions (Phase 15) — the private trip ledger. RLS scopes every row to
// the owner; these just shape input/output. Trips arrive from the GPS recorder
// (a track) or manual entry (a distance); both land in the same ledger.

export type TripVM = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  originLabel: string | null;
  destLabel: string | null;
  distanceMiles: number;
  classification: "business" | "personal" | "unset";
  vehicle: Vehicle;
  source: "gps" | "manual";
  purpose: string | null;
  passengers: number;
  hasRoute: boolean;
};

type Row = {
  id: string;
  started_at: string;
  ended_at: string | null;
  origin_label: string | null;
  dest_label: string | null;
  distance_meters: number;
  classification: TripVM["classification"];
  vehicle: Vehicle;
  source: "gps" | "manual";
  purpose: string | null;
  passengers: number | null;
  route_polyline: string | null;
};

function toVM(r: Row): TripVM {
  return {
    id: r.id,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    originLabel: r.origin_label,
    destLabel: r.dest_label,
    distanceMiles: Math.round(metersToMiles(r.distance_meters) * 10) / 10,
    classification: r.classification,
    vehicle: r.vehicle,
    source: r.source,
    purpose: r.purpose,
    passengers: r.passengers ?? 0,
    hasRoute: !!r.route_polyline,
  };
}

const point = z.object({ lat: z.number(), lng: z.number() });
const logSchema = z.object({
  startedAt: z.string(),
  endedAt: z.string().optional(),
  originLabel: z.string().trim().max(160).optional(),
  origin: point.optional(),
  destLabel: z.string().trim().max(160).optional(),
  dest: point.optional(),
  // A GPS track (recorder) OR a manual distance — one of the two.
  track: z.array(point).optional(),
  distanceMiles: z.number().min(0).max(2000).optional(),
  classification: z.enum(["business", "personal", "unset"]).default("unset"),
  vehicle: z.enum(["car", "motorcycle", "bicycle"]).default("car"),
  source: z.enum(["gps", "manual"]).default("manual"),
  purpose: z.string().trim().max(280).optional(),
  passengers: z.number().int().min(0).max(8).optional(),
  itineraryId: z.string().uuid().optional(),
});

export async function logTrip(input: z.input<typeof logSchema>): Promise<{ ok: boolean; id?: string; error?: string }> {
  const parsed = logSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the trip details." };
  const v = parsed.data;
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const distanceMeters = v.track && v.track.length > 1 ? trackDistanceMeters(v.track) : (v.distanceMiles ?? 0) * 1609.344;
  if (distanceMeters <= 0) return { ok: false, error: "A trip needs a distance — record a drive or enter the miles." };

  const { data, error } = await supabase
    .from("mileage_trips")
    .insert({
      user_id: ctx.userId,
      workspace_id: v.classification === "business" ? ctx.workspaceId : null,
      itinerary_id: v.itineraryId ?? null,
      started_at: v.startedAt,
      ended_at: v.endedAt ?? null,
      origin_label: v.originLabel ?? null,
      origin_lat: v.origin?.lat ?? null,
      origin_lng: v.origin?.lng ?? null,
      dest_label: v.destLabel ?? null,
      dest_lat: v.dest?.lat ?? null,
      dest_lng: v.dest?.lng ?? null,
      distance_meters: distanceMeters,
      route_polyline: v.track && v.track.length > 1 ? JSON.stringify(v.track) : null,
      classification: v.classification,
      vehicle: v.vehicle,
      source: v.source,
      purpose: v.purpose ?? null,
      passengers: v.passengers ?? 0,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/mileage");
  return { ok: true, id: data.id as string };
}

export async function listTrips(): Promise<TripVM[]> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("mileage_trips")
    .select("id, started_at, ended_at, origin_label, dest_label, distance_meters, classification, vehicle, source, purpose, passengers, route_polyline")
    .eq("user_id", ctx.userId)
    .order("started_at", { ascending: false });
  return ((data ?? []) as Row[]).map(toVM);
}

export async function classifyTrip(id: string, classification: "business" | "personal"): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  // Business trips carry the workspace tag (for a later submission); personal clears it.
  const { error } = await supabase
    .from("mileage_trips")
    .update({ classification, workspace_id: classification === "business" ? ctx.workspaceId : null })
    .eq("id", id)
    .eq("user_id", ctx.userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/mileage");
  return { ok: true };
}

const editSchema = z.object({
  id: z.string().uuid(),
  distanceMiles: z.number().min(0).max(2000).optional(),
  vehicle: z.enum(["car", "motorcycle", "bicycle"]).optional(),
  purpose: z.string().trim().max(280).nullable().optional(),
  passengers: z.number().int().min(0).max(8).optional(),
  originLabel: z.string().trim().max(160).nullable().optional(),
  destLabel: z.string().trim().max(160).nullable().optional(),
});

export async function updateTrip(input: z.input<typeof editSchema>): Promise<{ ok: boolean; error?: string }> {
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid edit." };
  const v = parsed.data;
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (v.distanceMiles != null) patch.distance_meters = v.distanceMiles * 1609.344;
  if (v.vehicle) patch.vehicle = v.vehicle;
  if (v.purpose !== undefined) patch.purpose = v.purpose;
  if (v.passengers !== undefined) patch.passengers = v.passengers;
  if (v.originLabel !== undefined) patch.origin_label = v.originLabel;
  if (v.destLabel !== undefined) patch.dest_label = v.destLabel;
  if (Object.keys(patch).length === 0) return { ok: true };
  const { error } = await supabase.from("mileage_trips").update(patch).eq("id", v.id).eq("user_id", ctx.userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/mileage");
  return { ok: true };
}

export async function deleteTrip(id: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { error } = await supabase.from("mileage_trips").delete().eq("id", id).eq("user_id", ctx.userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/mileage");
  return { ok: true };
}

// The claim-ready HMRC report for a tax year (defaults to the current one).
export async function mileageReport(taxYear?: string): Promise<MileageReport> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("mileage_trips")
    .select("id, started_at, distance_meters, classification, vehicle, passengers, purpose")
    .eq("user_id", ctx.userId);
  const trips = ((data ?? []) as { id: string; started_at: string; distance_meters: number; classification: TripVM["classification"]; vehicle: Vehicle; passengers: number | null; purpose: string | null }[]).map((r) => ({
    id: r.id,
    startedAt: r.started_at,
    distanceMeters: r.distance_meters,
    classification: r.classification,
    vehicle: r.vehicle,
    passengers: r.passengers ?? 0,
    purpose: r.purpose,
  }));
  return buildReport(trips, taxYear ?? taxYearOf(new Date().toISOString()));
}

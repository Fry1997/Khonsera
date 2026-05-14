// Shared helpers used by every server action module. Every action follows the
// same contract: validate input with Zod -> auth via requireUserContext() ->
// mutate -> withAudit() -> return Result<T, AppError>.

import { z } from "zod";
import {
  err,
  errors,
  fromThrown,
  ok,
  type Result,
} from "@/lib/errors";
import { geocodeAddress } from "@/lib/google/maps";

export function parseInput<T extends z.ZodTypeAny>(
  schema: T,
  raw: unknown,
): Result<z.infer<T>> {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);

  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join(".") || "_root";
    (fieldErrors[key] ||= []).push(issue.message);
  }
  return err(
    errors.validation(parsed.error.issues[0]?.message ?? "Invalid input", fieldErrors),
  );
}

export function dbResult<T>(
  data: T | null,
  error: { code?: string; message?: string } | null,
  entity: string,
): Result<T> {
  if (error) return err(fromThrown(error, entity));
  if (data === null || data === undefined) return err(errors.notFound(entity));
  return ok(data);
}

// Geocode helper used by location + site server actions. Takes an input that
// may include an address + lat/lng, returns the same shape with lat/lng
// filled in when the caller didn't supply them. Silently returns the input
// unchanged when Google Maps isn't configured or geocoding fails.
export async function maybeGeocode<
  T extends {
    address?: string | null;
    postcode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  },
>(input: T): Promise<T> {
  if (input.latitude != null && input.longitude != null) return input;
  const addressParts = [input.address, input.postcode].filter(Boolean);
  if (addressParts.length === 0) return input;
  const result = await geocodeAddress(addressParts.join(", "));
  if (!result) return input;
  return { ...input, latitude: result.lat, longitude: result.lng };
}

// Zod parsers at the integration boundary. Every provider response — live or
// stubbed — passes through one of these before being returned as
// IntegrationResult.data. This is the one place external data crosses into
// trusted code; if anything malformed gets past here, the rest of the app
// can trust the shapes.

import { z } from "zod";

const dateLike = z.union([z.date(), z.string().datetime()]).transform((v) =>
  v instanceof Date ? v : new Date(v),
);

export const routeLegSchema = z.object({
  type: z.enum(["walk", "drive", "train", "bus", "taxi"]),
  startName: z.string(),
  endName: z.string(),
  startTime: dateLike,
  endTime: dateLike,
  durationMinutes: z.number().int().nonnegative(),
  distanceMiles: z.number().nonnegative().optional(),
  instructions: z.string().optional(),
});

export const routeResultSchema = z.object({
  legs: z.array(routeLegSchema),
  totalDurationMinutes: z.number().int().nonnegative(),
  totalDistanceMiles: z.number().nonnegative().optional(),
});

export const railJourneySchema = z.object({
  departStation: z.string(),
  arriveStation: z.string(),
  departAt: dateLike,
  arriveAt: dateLike,
  durationMinutes: z.number().int().nonnegative(),
  changes: z.number().int().nonnegative(),
  estimatedPrice: z.number().nonnegative().optional(),
  serviceNumbers: z.array(z.string()),
});

export const calendarBusyBlockSchema = z.object({
  start: dateLike,
  end: dateLike,
  title: z.string().optional(),
});

export const bookingHandoffSchema = z.object({
  outbound: railJourneySchema,
  return: railJourneySchema.optional(),
  partnerDeepLink: z.string().url(),
  embeddable: z.boolean(),
});

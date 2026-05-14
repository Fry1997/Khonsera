// Time primitives. Rules:
//   1. Everything in the database is UTC (timestamptz columns).
//   2. Every render goes through formatInTz() with the workspace timezone.
//   3. Parse input dates as user-local in the workspace timezone before
//      converting to UTC for storage.
//
// We deliberately stick to native Date + Intl APIs to avoid a date library
// dependency this early. Replace with @internationalized/date or temporal if
// needed once we hit DST-edge bugs.

import { z } from "zod";

export type IsoDateTime = string; // ISO 8601 UTC string

export const isoDateTimeSchema = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), {
    message: "Invalid ISO datetime",
  });

export function nowUtc(): Date {
  return new Date();
}

export function toIsoUtc(d: Date): IsoDateTime {
  return d.toISOString();
}

export function fromIso(s: IsoDateTime): Date {
  return new Date(s);
}

const DEFAULT_LOCALE = "en-GB";

export function formatInTz(
  d: Date,
  timezone: string,
  opts: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
  locale = DEFAULT_LOCALE,
): string {
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: timezone }).format(d);
}

export function formatTimeInTz(d: Date, timezone: string): string {
  return formatInTz(d, timezone, { hour: "2-digit", minute: "2-digit" });
}

export function formatDateInTz(d: Date, timezone: string): string {
  return formatInTz(d, timezone, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

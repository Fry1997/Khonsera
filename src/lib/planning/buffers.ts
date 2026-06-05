// Mode-specific connection buffers (P1.2).
//
// The planning engine used to assume a flat 10-minute buffer at every
// interchange (see `lib/feasibility/check.ts`). That is wrong in both
// directions: it over-pads a door-to-door drive (no interchange at all) and
// badly under-pads a flight (security + boarding is an hour or more).
//
// This module is the single source of truth for how much time a mode costs
// you *at the connection* — the margin between arriving at a hub and the
// fixed departure of the service you're catching. Two flavours:
//
//   • boardingBufferMinutes — first-/last-mile leg arrives at a hub, you then
//     board a scheduled service. The buffer you want before its departure.
//   • interchangeBufferMinutes — you change between two scheduled services at
//     the same hub (train → train, flight → flight).
//
// Pure, no IO. Composition (`door-to-door.ts`) and feasibility checks read
// these instead of hard-coding 10.

import type { TransitionMode } from "@/lib/types/domain";

// Margin to budget before boarding a scheduled service of this mode, coming
// in off a flexible first-mile leg (walk/drive/taxi to the hub). Calibrated
// per the brief: rail station entry ~5–8, airport 60–120, coach/ferry mid,
// road/network ~0 (no fixed departure to miss).
export const BOARDING_BUFFER_MINUTES: Record<TransitionMode, number> = {
  walk: 0,
  drive: 0,
  taxi: 3, // wait for the car to actually arrive
  bus: 5,
  tube: 5,
  train: 8, // get into the station, find the platform
  flight: 90, // bag drop, security, boarding
  mixed: 6,
};

// Time to walk through the station building itself — entry on the way in,
// exit on the way out — on top of the boarding margin. Brief P1.2: station
// entry/exit ~5 min. Used by rail-candidate timing (leave-home / arrive-home).
export const STATION_DWELL_MINUTES = 5;

// Margin to budget when changing between two scheduled services at one hub.
// Interchanges are tighter than a cold-start boarding (you're already inside
// the building) except for flights, where you may re-clear security.
export const INTERCHANGE_BUFFER_MINUTES: Record<TransitionMode, number> = {
  walk: 0,
  drive: 0,
  taxi: 3,
  bus: 6,
  tube: 6,
  train: 8,
  flight: 60,
  mixed: 6,
};

// Modes that run to a fixed timetable — a connection buffer is meaningful
// because there is a departure you can miss. Flexible modes (walk/drive/taxi/
// cycle) leave when you do, so the buffer into them is zero.
const SCHEDULED_MODES: ReadonlySet<TransitionMode> = new Set([
  "bus",
  "tube",
  "train",
  "flight",
]);

export function isScheduledMode(mode: TransitionMode): boolean {
  return SCHEDULED_MODES.has(mode);
}

export function boardingBufferMinutes(mode: TransitionMode): number {
  return BOARDING_BUFFER_MINUTES[mode] ?? 0;
}

export function interchangeBufferMinutes(mode: TransitionMode): number {
  return INTERCHANGE_BUFFER_MINUTES[mode] ?? 0;
}

// The buffer to insert *between* two adjacent legs of a composed journey.
// Boarding a scheduled service from a flexible leg → boarding buffer of the
// service. Changing between two scheduled services → interchange buffer.
// Anything arriving into a flexible leg (you drive away whenever) → 0.
export function connectionBufferMinutes(
  fromMode: TransitionMode,
  toMode: TransitionMode,
): number {
  if (!isScheduledMode(toMode)) return 0;
  if (isScheduledMode(fromMode)) return interchangeBufferMinutes(toMode);
  return boardingBufferMinutes(toMode);
}

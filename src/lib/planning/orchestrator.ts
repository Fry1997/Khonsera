// Pure orchestrator. Given a visit plan's parameters AND the results of the
// integration calls (route + rail), produce a ranked list of TravelOption
// candidates. The integration IO lives in the server action — this module
// stays pure so it's easy to test and reuse anywhere.
//
// Rationale for keeping pure: integration provider responses are the only
// non-deterministic input. Once they're fetched, building options +
// computing feasibility + ranking is straightforward math.

import { addMinutes, minutesBetween } from "@/lib/types/time";
import { evaluateFeasibility, type FeasibilityVerdict } from "./feasibility";
import { rankOptions, type RankableOption } from "./ranking";
import type {
  FeasibilityStatus,
  TravelModePreference,
} from "@/lib/types/domain";

export type PlanningInput = {
  appointmentStart: Date;
  meetingDurationMinutes: number;
  latestReturnTime?: Date;
  arrivalBufferMinutes: number;
  returnBufferMinutes: number;
  preferredMode: TravelModePreference;
  timezone: string;
  conflictTitles?: string[];
};

export type RailOptionInput = {
  outboundDepartAt: Date;
  outboundArriveAt: Date;
  outboundDurationMinutes: number;
  outboundChanges: number;
  outboundEstimatedPrice?: number;
  outboundServiceNumbers: string[];
  outboundOriginStation: string;
  outboundDestinationStation: string;
  returnDepartAt: Date;
  returnArriveAt: Date;
  returnDurationMinutes: number;
  returnChanges: number;
  returnEstimatedPrice?: number;
  // Walk legs around the rail journey (last-mile to/from customer site).
  walkToSiteMinutes: number;
  walkFromSiteMinutes: number;
};

export type DriveOptionInput = {
  leaveOriginAt: Date;
  arriveSiteAt: Date;
  durationMinutes: number;
  distanceMiles: number;
  mileageRate: number; // £/mile
  parkingCostEstimate?: number;
  returnDurationMinutes: number;
};

export type BuiltOption = {
  id: string;
  mode: "rail" | "drive";
  feasibilityStatus: FeasibilityStatus;
  verdict: FeasibilityVerdict;
  leaveOriginAt: Date;
  arriveSiteAt: Date;
  meetingStartAt: Date;
  meetingEndAt: Date;
  leaveSiteAt: Date;
  arriveReturnLocationAt: Date;
  totalDurationMinutes: number;
  totalCostEstimate: number | null;
  travelTimeMinutes: number;
  bufferMinutes: number;
  legs: BuiltLeg[];
};

export type BuiltLeg = {
  sequence: number;
  legType: "walk" | "drive" | "train" | "wait" | "meeting";
  startLocationName: string;
  endLocationName: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  distanceMiles?: number;
  provider?: string;
  serviceNumber?: string;
  instructions?: string;
};

function localId(prefix: string): string {
  // Caller (the server action) assigns real UUIDs at insert time. The
  // orchestrator just needs handles for ranking-then-mapping in TS.
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildRailOption(
  input: PlanningInput,
  rail: RailOptionInput,
): BuiltOption {
  const meetingStartAt = input.appointmentStart;
  const meetingEndAt = addMinutes(meetingStartAt, input.meetingDurationMinutes);

  const leaveOriginAt = addMinutes(rail.outboundDepartAt, -rail.walkToSiteMinutes);
  const arriveSiteAt = addMinutes(rail.outboundArriveAt, rail.walkToSiteMinutes);
  const leaveSiteAt = addMinutes(rail.returnDepartAt, -rail.walkFromSiteMinutes);
  const arriveReturnLocationAt = rail.returnArriveAt;

  const verdict = evaluateFeasibility({
    appointmentStart: meetingStartAt,
    appointmentEnd: meetingEndAt,
    arriveSiteAt,
    leaveSiteAt,
    arriveReturnLocationAt,
    latestReturnTime: input.latestReturnTime,
    arrivalBufferMinutes: input.arrivalBufferMinutes,
    returnBufferMinutes: input.returnBufferMinutes,
    timezone: input.timezone,
    conflictTitles: input.conflictTitles,
  });

  const totalCost =
    (rail.outboundEstimatedPrice ?? 0) + (rail.returnEstimatedPrice ?? 0);

  const legs: BuiltLeg[] = [
    {
      sequence: 0,
      legType: "walk",
      startLocationName: "Origin",
      endLocationName: rail.outboundOriginStation,
      startTime: leaveOriginAt,
      endTime: rail.outboundDepartAt,
      durationMinutes: rail.walkToSiteMinutes,
      instructions: `Walk to ${rail.outboundOriginStation}.`,
    },
    {
      sequence: 1,
      legType: "train",
      startLocationName: rail.outboundOriginStation,
      endLocationName: rail.outboundDestinationStation,
      startTime: rail.outboundDepartAt,
      endTime: rail.outboundArriveAt,
      durationMinutes: rail.outboundDurationMinutes,
      provider: "Rail",
      serviceNumber: rail.outboundServiceNumbers.join(" → "),
      instructions:
        rail.outboundChanges === 0
          ? "Direct."
          : `${rail.outboundChanges} change(s).`,
    },
    {
      sequence: 2,
      legType: "walk",
      startLocationName: rail.outboundDestinationStation,
      endLocationName: "Customer site",
      startTime: rail.outboundArriveAt,
      endTime: arriveSiteAt,
      durationMinutes: rail.walkToSiteMinutes,
    },
    {
      sequence: 3,
      legType: "meeting",
      startLocationName: "Customer site",
      endLocationName: "Customer site",
      startTime: meetingStartAt,
      endTime: meetingEndAt,
      durationMinutes: input.meetingDurationMinutes,
    },
    {
      sequence: 4,
      legType: "walk",
      startLocationName: "Customer site",
      endLocationName: rail.outboundDestinationStation,
      startTime: leaveSiteAt,
      endTime: rail.returnDepartAt,
      durationMinutes: rail.walkFromSiteMinutes,
    },
    {
      sequence: 5,
      legType: "train",
      startLocationName: rail.outboundDestinationStation,
      endLocationName: rail.outboundOriginStation,
      startTime: rail.returnDepartAt,
      endTime: rail.returnArriveAt,
      durationMinutes: rail.returnDurationMinutes,
      provider: "Rail",
      instructions:
        rail.returnChanges === 0 ? "Direct." : `${rail.returnChanges} change(s).`,
    },
  ];

  return {
    id: localId("rail"),
    mode: "rail",
    feasibilityStatus: verdict.status,
    verdict,
    leaveOriginAt,
    arriveSiteAt,
    meetingStartAt,
    meetingEndAt,
    leaveSiteAt,
    arriveReturnLocationAt,
    totalDurationMinutes: minutesBetween(leaveOriginAt, arriveReturnLocationAt),
    totalCostEstimate: totalCost > 0 ? totalCost : null,
    travelTimeMinutes:
      rail.outboundDurationMinutes +
      rail.returnDurationMinutes +
      rail.walkToSiteMinutes * 2 +
      rail.walkFromSiteMinutes,
    bufferMinutes: minutesBetween(arriveSiteAt, meetingStartAt),
    legs,
  };
}

export function buildDriveOption(
  input: PlanningInput,
  drive: DriveOptionInput,
): BuiltOption {
  const meetingStartAt = input.appointmentStart;
  const meetingEndAt = addMinutes(meetingStartAt, input.meetingDurationMinutes);
  const leaveOriginAt = drive.leaveOriginAt;
  const arriveSiteAt = drive.arriveSiteAt;
  const leaveSiteAt = meetingEndAt;
  const arriveReturnLocationAt = addMinutes(leaveSiteAt, drive.returnDurationMinutes);

  const verdict = evaluateFeasibility({
    appointmentStart: meetingStartAt,
    appointmentEnd: meetingEndAt,
    arriveSiteAt,
    leaveSiteAt,
    arriveReturnLocationAt,
    latestReturnTime: input.latestReturnTime,
    arrivalBufferMinutes: input.arrivalBufferMinutes,
    returnBufferMinutes: input.returnBufferMinutes,
    timezone: input.timezone,
    conflictTitles: input.conflictTitles,
  });

  const mileageCost = drive.distanceMiles * drive.mileageRate;
  const totalCost = mileageCost + (drive.parkingCostEstimate ?? 0);

  const legs: BuiltLeg[] = [
    {
      sequence: 0,
      legType: "drive",
      startLocationName: "Origin",
      endLocationName: "Customer site",
      startTime: leaveOriginAt,
      endTime: arriveSiteAt,
      durationMinutes: drive.durationMinutes,
      distanceMiles: drive.distanceMiles,
      instructions: `Drive ${drive.distanceMiles.toFixed(0)} miles.`,
    },
    {
      sequence: 1,
      legType: "meeting",
      startLocationName: "Customer site",
      endLocationName: "Customer site",
      startTime: meetingStartAt,
      endTime: meetingEndAt,
      durationMinutes: input.meetingDurationMinutes,
    },
    {
      sequence: 2,
      legType: "drive",
      startLocationName: "Customer site",
      endLocationName: "Origin",
      startTime: leaveSiteAt,
      endTime: arriveReturnLocationAt,
      durationMinutes: drive.returnDurationMinutes,
      distanceMiles: drive.distanceMiles,
    },
  ];

  return {
    id: localId("drive"),
    mode: "drive",
    feasibilityStatus: verdict.status,
    verdict,
    leaveOriginAt,
    arriveSiteAt,
    meetingStartAt,
    meetingEndAt,
    leaveSiteAt,
    arriveReturnLocationAt,
    totalDurationMinutes: minutesBetween(leaveOriginAt, arriveReturnLocationAt),
    totalCostEstimate: totalCost,
    travelTimeMinutes: drive.durationMinutes + drive.returnDurationMinutes,
    bufferMinutes: minutesBetween(arriveSiteAt, meetingStartAt),
    legs,
  };
}

export function rankBuiltOptions(
  options: BuiltOption[],
  preference: TravelModePreference,
): BuiltOption[] {
  const rankable: (BuiltOption & RankableOption)[] = options.map((o) => ({
    ...o,
    totalCostEstimate: o.totalCostEstimate,
    totalDurationMinutes: o.totalDurationMinutes,
  }));
  return rankOptions(rankable, preference);
}

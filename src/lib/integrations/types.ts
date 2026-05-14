// Shared types for integration providers. The UI and planning engine code
// against these interfaces, never against a specific provider. Real providers
// implement the same shape; stubs return realistic mock data when demo mode
// is on, otherwise they return UNAVAILABLE.

export type IntegrationMode = "live" | "demo" | "unavailable";

export type IntegrationResult<T> =
  | { mode: "live"; data: T }
  | { mode: "demo"; data: T; demo: true }
  | { mode: "unavailable"; reason: string };

export type LatLng = { lat: number; lng: number };

// ---- Routing
export type RouteRequest = {
  origin: LatLng | string;
  destination: LatLng | string;
  mode: "drive" | "walk" | "transit";
  departAt?: Date;
  arriveBy?: Date;
};
export type RouteLeg = {
  type: "walk" | "drive" | "train" | "bus" | "taxi";
  startName: string;
  endName: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  distanceMiles?: number;
  instructions?: string;
};
export type RouteResult = {
  legs: RouteLeg[];
  totalDurationMinutes: number;
  totalDistanceMiles?: number;
};

// ---- Rail
export type RailJourneyRequest = {
  originStation: string;
  destinationStation: string;
  departAt?: Date;
  arriveBy?: Date;
};
export type RailJourney = {
  departStation: string;
  arriveStation: string;
  departAt: Date;
  arriveAt: Date;
  durationMinutes: number;
  changes: number;
  estimatedPrice?: number;
  serviceNumbers: string[];
};

// ---- Calendar
export type CalendarFreeBusyRequest = {
  start: Date;
  end: Date;
};
export type CalendarBusyBlock = {
  start: Date;
  end: Date;
  title?: string;
};
export type CalendarEventInput = {
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
};

// ---- Rail booking partner
export type BookingHandoff = {
  outbound: RailJourney;
  return?: RailJourney;
  partnerDeepLink: string;
  embeddable: boolean;
};

// ---- Notifications
export type NotificationInput = {
  to: string;
  subject?: string;
  body: string;
  channel: "email" | "push";
};

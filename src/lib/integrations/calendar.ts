import { features } from "@/lib/features";
import { isDemoModeActive } from "@/lib/demo-mode";
import type {
  CalendarBusyBlock,
  CalendarEventInput,
  CalendarFreeBusyRequest,
  IntegrationResult,
} from "./types";

export async function getFreeBusy(
  req: CalendarFreeBusyRequest,
): Promise<IntegrationResult<CalendarBusyBlock[]>> {
  if (features.calendarGoogle || features.calendarMicrosoft) {
    return { mode: "unavailable", reason: "Live calendar not yet implemented" };
  }
  if (await isDemoModeActive()) {
    return { mode: "demo", demo: true, data: mockBusy(req) };
  }
  return { mode: "unavailable", reason: "Calendar not connected." };
}

export async function createCalendarEvent(
  event: CalendarEventInput,
): Promise<IntegrationResult<{ externalId: string }>> {
  if (features.calendarGoogle || features.calendarMicrosoft) {
    return { mode: "unavailable", reason: "Live calendar not yet implemented" };
  }
  if (await isDemoModeActive()) {
    return {
      mode: "demo",
      demo: true,
      data: { externalId: `demo-evt-${Math.random().toString(36).slice(2, 10)}` },
    };
  }
  return { mode: "unavailable", reason: "Calendar not connected." };
}

function mockBusy(req: CalendarFreeBusyRequest): CalendarBusyBlock[] {
  // Plausible single busy block mid-morning the day after the request window.
  const day = new Date(req.start);
  day.setDate(day.getDate() + 1);
  day.setHours(9, 0, 0, 0);
  return [
    {
      start: day,
      end: new Date(day.getTime() + 60 * 60_000),
      title: "Existing commitment (demo)",
    },
  ];
}

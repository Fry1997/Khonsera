import { features } from "@/lib/features";
import { isDemoModeActive } from "@/lib/demo-mode";
import { getValidGoogleAccessToken } from "@/lib/google/client";
import {
  googleCreateEvent,
  googleFreeBusy,
  googleListEvents,
  type GoogleEvent,
} from "@/lib/google/calendar";
import type {
  CalendarBusyBlock,
  CalendarEventInput,
  CalendarFreeBusyRequest,
  IntegrationResult,
} from "./types";

export async function getFreeBusy(
  req: CalendarFreeBusyRequest,
): Promise<IntegrationResult<CalendarBusyBlock[]>> {
  if (features.calendarGoogle) {
    const auth = await getValidGoogleAccessToken();
    if (auth) {
      try {
        const blocks = await googleFreeBusy({
          accessToken: auth.accessToken,
          start: req.start,
          end: req.end,
        });
        return {
          mode: "live",
          data: blocks.map((b) => ({ start: b.start, end: b.end })),
        };
      } catch (e) {
        console.error("google freeBusy failed", e);
        // Fall through to demo/unavailable rather than failing the whole
        // planning run.
      }
    }
  }
  if (await isDemoModeActive()) {
    return { mode: "demo", demo: true, data: mockBusy(req) };
  }
  return { mode: "unavailable", reason: "Calendar not connected." };
}

export async function listEvents(
  req: CalendarFreeBusyRequest,
): Promise<IntegrationResult<Array<GoogleEvent>>> {
  if (features.calendarGoogle) {
    const auth = await getValidGoogleAccessToken();
    if (auth) {
      try {
        const events = await googleListEvents({
          accessToken: auth.accessToken,
          start: req.start,
          end: req.end,
        });
        return { mode: "live", data: events };
      } catch (e) {
        console.error("google listEvents failed", e);
      }
    }
  }
  if (await isDemoModeActive()) {
    return {
      mode: "demo",
      demo: true,
      data: mockEvents(req),
    };
  }
  return { mode: "unavailable", reason: "Calendar not connected." };
}

export async function createCalendarEvent(
  event: CalendarEventInput,
  options: { colorId?: string } = {},
): Promise<IntegrationResult<{ externalId: string; htmlLink?: string }>> {
  if (features.calendarGoogle) {
    const auth = await getValidGoogleAccessToken();
    if (auth) {
      try {
        const created = await googleCreateEvent({
          accessToken: auth.accessToken,
          event: {
            title: event.title,
            description: event.description,
            location: event.location,
            start: event.start,
            end: event.end,
            colorId: options.colorId,
          },
        });
        return {
          mode: "live",
          data: { externalId: created.id, htmlLink: created.htmlLink },
        };
      } catch (e) {
        console.error("google createEvent failed", e);
        return {
          mode: "unavailable",
          reason: `Calendar event creation failed: ${(e as Error).message}`,
        };
      }
    }
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

function mockEvents(req: CalendarFreeBusyRequest): GoogleEvent[] {
  return mockBusy(req).map((b, i) => ({
    id: `demo-${i}`,
    summary: b.title ?? "Busy",
    start: b.start,
    end: b.end,
  }));
}

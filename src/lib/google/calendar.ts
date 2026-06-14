// Google Calendar REST helpers. Each function takes an access token and
// makes a single API call. The wrapping in src/lib/integrations/calendar.ts
// is what decides "live vs demo vs unavailable".

const API_BASE = "https://www.googleapis.com/calendar/v3";

async function callGoogle<T>(
  url: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export type GoogleFreeBusyBlock = {
  start: Date;
  end: Date;
};

export async function googleFreeBusy(args: {
  accessToken: string;
  start: Date;
  end: Date;
  calendarId?: string;
}): Promise<GoogleFreeBusyBlock[]> {
  const data = await callGoogle<{
    calendars: Record<string, { busy: Array<{ start: string; end: string }> }>;
  }>(`${API_BASE}/freeBusy`, args.accessToken, {
    method: "POST",
    body: JSON.stringify({
      timeMin: args.start.toISOString(),
      timeMax: args.end.toISOString(),
      items: [{ id: args.calendarId ?? "primary" }],
    }),
  });
  const cal = Object.values(data.calendars)[0];
  if (!cal) return [];
  return cal.busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

export type GoogleEvent = {
  id: string;
  summary: string | null;
  start: Date;
  end: Date;
  location?: string | null;
  htmlLink?: string;
};

export async function googleListEvents(args: {
  accessToken: string;
  start: Date;
  end: Date;
  calendarId?: string;
}): Promise<GoogleEvent[]> {
  const url = new URL(`${API_BASE}/calendars/${args.calendarId ?? "primary"}/events`);
  url.searchParams.set("timeMin", args.start.toISOString());
  url.searchParams.set("timeMax", args.end.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "100");

  const data = await callGoogle<{
    items: Array<{
      id: string;
      summary?: string;
      location?: string;
      start: { dateTime?: string; date?: string };
      end: { dateTime?: string; date?: string };
      htmlLink?: string;
    }>;
  }>(url.toString(), args.accessToken);

  return data.items
    .filter((e) => e.start.dateTime && e.end.dateTime)
    .map((e) => ({
      id: e.id,
      summary: e.summary ?? null,
      start: new Date(e.start.dateTime!),
      end: new Date(e.end.dateTime!),
      location: e.location ?? null,
      htmlLink: e.htmlLink,
    }));
}

export type GoogleEventInput = {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  colorId?: string; // "1"-"11" — Google's preset colours
};

export async function googleCreateEvent(args: {
  accessToken: string;
  event: GoogleEventInput;
  calendarId?: string;
}): Promise<{ id: string; htmlLink: string }> {
  const data = await callGoogle<{ id: string; htmlLink: string }>(
    `${API_BASE}/calendars/${args.calendarId ?? "primary"}/events`,
    args.accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        summary: args.event.title,
        description: args.event.description,
        location: args.event.location,
        start: { dateTime: args.event.start.toISOString() },
        end: { dateTime: args.event.end.toISOString() },
        colorId: args.event.colorId,
      }),
    },
  );
  return { id: data.id, htmlLink: data.htmlLink };
}

export async function googleDeleteEvent(args: {
  accessToken: string;
  eventId: string;
  calendarId?: string;
}): Promise<void> {
  await fetch(
    `${API_BASE}/calendars/${args.calendarId ?? "primary"}/events/${args.eventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${args.accessToken}` },
    },
  );
}

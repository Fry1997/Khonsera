import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { liveDeparture } from "./darwin";

const originalKey = process.env.DARWIN_LDBWS_KEY;

function mockBoard(
  trainServices: unknown[],
  platformAvailable: boolean | "absent" = true,
) {
  const board =
    platformAvailable === "absent"
      ? { trainServices }
      : { trainServices, platformAvailable };

  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(board), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

describe("Darwin live rail accuracy edge cases", () => {
  beforeEach(() => {
    process.env.DARWIN_LDBWS_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalKey === undefined) delete process.env.DARWIN_LDBWS_KEY;
    else process.env.DARWIN_LDBWS_KEY = originalKey;
  });

  it("reports a cross-midnight delay with the correct positive delay magnitude", async () => {
    mockBoard([
      {
        serviceID: "svc-midnight",
        std: "23:58",
        etd: "00:05",
        platform: "2",
        destination: [{ locationName: "Derby", crs: "DBY" }],
      },
    ]);

    const live = await liveDeparture("WEL", "23:58", "DBY", "svc-midnight");

    expect(live).not.toBeNull();
    expect(live?.status).toBe("delayed");
    expect(live?.label).toBe("Now 00:05");
    expect(live?.detail).toContain("+7 min");
    expect(live?.detail).toContain("Platform 2");
  });

  it("keeps an ordinary same-day delay magnitude unchanged", async () => {
    mockBoard([
      {
        serviceID: "svc-same-day",
        std: "22:06",
        etd: "22:11",
        platform: "1",
        destination: [{ locationName: "London St Pancras", crs: "STP" }],
      },
    ]);

    const live = await liveDeparture("WEL", "22:06", "STP", "svc-same-day");

    expect(live?.detail).toContain("+5 min");
  });

  it("does not invent a next-day rollover for a small backwards live-time move", async () => {
    mockBoard([
      {
        serviceID: "svc-backwards",
        std: "10:00",
        etd: "09:55",
        platform: "1",
        destination: [{ locationName: "London St Pancras", crs: "STP" }],
      },
    ]);

    const live = await liveDeparture("WEL", "10:00", "STP", "svc-backwards");

    expect(live).not.toBeNull();
    expect(live?.label).toBe("Now 09:55");
    expect(live?.detail).not.toContain("+1435 min");
  });

  it("treats exactly six hours backwards as back-in-time, not a midnight rollover", async () => {
    mockBoard([
      {
        serviceID: "svc-minus-six",
        std: "12:00",
        etd: "06:00",
        platform: "1",
        destination: [{ locationName: "London St Pancras", crs: "STP" }],
      },
    ]);

    const live = await liveDeparture("WEL", "12:00", "STP", "svc-minus-six");

    expect(live?.detail).not.toContain("+1080 min");
  });

  it("keeps exactly eighteen hours forwards as a normal increasing Darwin time", async () => {
    mockBoard([
      {
        serviceID: "svc-plus-eighteen",
        std: "00:00",
        etd: "18:00",
        platform: "1",
        destination: [{ locationName: "London St Pancras", crs: "STP" }],
      },
    ]);

    const live = await liveDeparture("WEL", "00:00", "STP", "svc-plus-eighteen");

    expect(live?.detail).toContain("+1080 min");
  });

  it("treats a forward jump over eighteen hours as back-in-time across midnight", async () => {
    mockBoard([
      {
        serviceID: "svc-forward-wrap",
        std: "00:05",
        etd: "23:58",
        platform: "1",
        destination: [{ locationName: "London St Pancras", crs: "STP" }],
      },
    ]);

    const live = await liveDeparture("WEL", "00:05", "STP", "svc-forward-wrap");

    expect(live).not.toBeNull();
    expect(live?.detail).not.toContain("+1433 min");
  });

  it("does not warn about a same-platform train that is now expected to leave after the user's train", async () => {
    mockBoard([
      {
        serviceID: "svc-held",
        std: "00:25",
        etd: "00:40",
        platform: "2",
        destination: [{ locationName: "Nottingham", crs: "NOT" }],
      },
      {
        serviceID: "svc-user",
        std: "00:30",
        etd: "On time",
        platform: "2",
        destination: [{ locationName: "Derby", crs: "DBY" }],
      },
    ]);

    const live = await liveDeparture("WEL", "00:30", "DBY", "svc-user");

    expect(live).not.toBeNull();
    expect(live?.serviceId).toBe("svc-user");
    expect(live?.destination).toBe("Derby");
    expect(live?.earlierSamePlatform).toBeUndefined();
  });

  it("keeps tracking the exact service when a timetable amendment changes its scheduled minute", async () => {
    mockBoard([
      {
        serviceID: "svc-derby",
        rsid: "EM123400",
        std: "00:30",
        etd: "On time",
        platform: "3",
        destination: [{ locationName: "Derby", crs: "DBY" }],
      },
    ]);

    const live = await liveDeparture("WEL", "00:22", "DBY", "svc-derby");

    expect(live).not.toBeNull();
    expect(live?.serviceId).toBe("svc-derby");
    expect(live?.rsid).toBe("EM123400");
    expect(live?.std).toBe("00:30");
    expect(live?.platform).toBe("3");

    const requestUrl = new URL(String(vi.mocked(fetch).mock.calls[0]?.[0]));
    expect(requestUrl.searchParams.get("numRows")).toBe("149");
    expect(requestUrl.searchParams.get("timeWindow")).toBe("119");
  });

  it("uses durable identity even when the passenger destination is only an intermediate stop", async () => {
    mockBoard([
      {
        serviceID: "svc-corby",
        std: "08:15",
        etd: "On time",
        platform: "1",
        destination: [{ locationName: "Corby", crs: "COR" }],
      },
      {
        serviceID: "svc-london",
        std: "08:15",
        etd: "08:18",
        platform: "2",
        destination: [{ locationName: "London St Pancras", crs: "STP" }],
      },
    ]);

    // LUT is the passenger's hop destination, not the train's final destination.
    const live = await liveDeparture("WEL", "08:15", "LUT", "svc-london");

    expect(live).not.toBeNull();
    expect(live?.serviceId).toBe("svc-london");
    expect(live?.destination).toBe("London St Pancras");
    expect(live?.platform).toBe("2");
    expect(live?.label).toBe("Now 08:18");
  });

  it("refuses to guess when two services share the booked minute and no durable identity is available", async () => {
    mockBoard([
      {
        serviceID: "svc-corby",
        std: "08:15",
        etd: "On time",
        platform: "1",
        destination: [{ locationName: "Corby", crs: "COR" }],
      },
      {
        serviceID: "svc-derby",
        std: "08:15",
        etd: "On time",
        platform: "2",
        destination: [{ locationName: "Derby", crs: "DBY" }],
      },
    ]);

    const live = await liveDeparture("WEL", "08:15");

    expect(live).toBeNull();
  });

  it("does not use a passenger hop destination as a same-minute identity tie-break", async () => {
    mockBoard([
      {
        serviceID: "svc-corby",
        std: "08:15",
        etd: "On time",
        platform: "1",
        destination: [{ locationName: "Corby", crs: "COR" }],
      },
      {
        serviceID: "svc-derby",
        std: "08:15",
        etd: "On time",
        platform: "2",
        destination: [{ locationName: "Derby", crs: "DBY" }],
      },
    ]);

    const live = await liveDeparture("WEL", "08:15", "DBY");

    expect(live).toBeNull();
  });

  it("does not fall back to another train when a stored service identity is absent from the board", async () => {
    mockBoard([
      {
        serviceID: "svc-other",
        std: "08:15",
        etd: "On time",
        platform: "1",
        destination: [{ locationName: "Derby", crs: "DBY" }],
      },
    ]);

    const live = await liveDeparture("WEL", "08:15", "DBY", "svc-missing");

    expect(live).toBeNull();
  });

  it("recognises the immediately preceding same-platform train across midnight", async () => {
    mockBoard([
      {
        serviceID: "svc-prev",
        std: "23:58",
        etd: "On time",
        platform: "2",
        destination: [{ locationName: "Nottingham", crs: "NOT" }],
      },
      {
        serviceID: "svc-user",
        std: "00:05",
        etd: "On time",
        platform: "2",
        destination: [{ locationName: "Derby", crs: "DBY" }],
      },
    ]);

    const live = await liveDeparture("WEL", "00:05", "DBY", "svc-user");

    expect(live).not.toBeNull();
    expect(live?.earlierSamePlatform).toMatchObject({
      std: "23:58",
      destination: "Nottingham",
      platform: "2",
    });
  });


  it("suppresses a service platform when Darwin says platform data is unavailable", async () => {
    mockBoard(
      [
        {
          serviceID: "svc-platform-suppressed",
          std: "09:30",
          etd: "On time",
          platform: "2",
          destination: [{ locationName: "London St Pancras", crs: "STP" }],
        },
      ],
      false,
    );

    const live = await liveDeparture(
      "WEL",
      "09:30",
      "STP",
      "svc-platform-suppressed",
    );

    expect(live).not.toBeNull();
    expect(live?.platformAvailable).toBe(false);
    expect(live?.platform).toBeUndefined();
    expect(live?.detail).toBeUndefined();
    expect(live?.earlierSamePlatform).toBeUndefined();
  });

  it("suppresses platform data when Darwin omits platformAvailable", async () => {
    mockBoard(
      [
        {
          serviceID: "svc-platform-unknown",
          std: "09:30",
          etd: "On time",
          platform: "2",
          destination: [{ locationName: "London St Pancras", crs: "STP" }],
        },
      ],
      "absent",
    );

    const live = await liveDeparture(
      "WEL",
      "09:30",
      "STP",
      "svc-platform-unknown",
    );

    expect(live).not.toBeNull();
    expect(live?.platformAvailable).toBe(false);
    expect(live?.platform).toBeUndefined();
    expect(live?.detail).toBeUndefined();
  });

  it("preserves an alphanumeric platform exactly as announced", async () => {
    mockBoard([
      {
        serviceID: "svc-ayr",
        std: "00:15",
        etd: "On time",
        platform: "13R",
        destination: [{ locationName: "Ayr", crs: "AYR" }],
      },
    ]);

    const live = await liveDeparture("GLC", "00:15", "AYR", "svc-ayr");

    expect(live).not.toBeNull();
    expect(live?.platform).toBe("13R");
    expect(live?.detail).toContain("Platform 13R");
  });


  it("preserves Darwin No report as an honest unknown live state", async () => {
    mockBoard([
      {
        serviceID: "svc-no-report",
        std: "12:30",
        etd: "No report",
        platform: "4",
        destination: [{ locationName: "Bedford", crs: "BDM" }],
      },
    ]);

    const live = await liveDeparture("LUT", "12:30", "BDM", "svc-no-report");

    expect(live).not.toBeNull();
    expect(live?.status).toBe("stale");
    expect(live?.label).toBe("No live report");
    expect(live?.detail).toBe("Platform 4");
    expect(live?.etd).toBe("No report");
    expect(live?.uncertain).toBeUndefined();
  });

  it("preserves an asterisked Darwin forecast without presenting it as confirmed", async () => {
    mockBoard([
      {
        serviceID: "svc-uncertain",
        std: "12:30",
        etd: "12:34*",
        platform: "5",
        destination: [{ locationName: "Bedford", crs: "BDM" }],
      },
    ]);

    const live = await liveDeparture("LUT", "12:30", "BDM", "svc-uncertain");

    expect(live).not.toBeNull();
    expect(live?.status).toBe("stale");
    expect(live?.label).toBe("Expected 12:34 · uncertain");
    expect(live?.detail).toBe("+4 min · Platform 5");
    expect(live?.etd).toBe("12:34*");
    expect(live?.uncertain).toBe(true);
  });

  it("keeps Darwin's explicit Delayed state distinct from unknown forecasts", async () => {
    mockBoard([
      {
        serviceID: "svc-delayed-text",
        std: "12:30",
        etd: "Delayed",
        platform: "5",
        delayReason: "Awaiting train crew",
        destination: [{ locationName: "Bedford", crs: "BDM" }],
      },
    ]);

    const live = await liveDeparture("LUT", "12:30", "BDM", "svc-delayed-text");

    expect(live?.status).toBe("delayed");
    expect(live?.label).toBe("Delayed");
    expect(live?.detail).toBe("Awaiting train crew");
    expect(live?.etd).toBe("Delayed");
  });

  it("maps unknown or missing Darwin forecast values to unavailable rather than Delayed or On time", async () => {
    mockBoard([
      {
        serviceID: "svc-unknown",
        std: "12:30",
        etd: "Forecast pending",
        platform: "2",
        destination: [{ locationName: "Bedford", crs: "BDM" }],
      },
    ]);

    const unknown = await liveDeparture("LUT", "12:30", "BDM", "svc-unknown");

    expect(unknown?.status).toBe("stale");
    expect(unknown?.label).toBe("Live forecast unavailable");
    expect(unknown?.detail).toBe("Platform 2");
    expect(unknown?.etd).toBe("Forecast pending");

    mockBoard([
      {
        serviceID: "svc-missing-etd",
        std: "12:30",
        platform: "2",
        destination: [{ locationName: "Bedford", crs: "BDM" }],
      },
    ]);

    const missing = await liveDeparture("LUT", "12:30", "BDM", "svc-missing-etd");

    expect(missing?.status).toBe("stale");
    expect(missing?.label).toBe("Live forecast unavailable");
    expect(missing?.etd).toBe("");
  });

  it("maps a cancelled service to an explicit cancelled state", async () => {
    mockBoard([
      {
        serviceID: "svc-cancelled",
        std: "23:06",
        etd: "Cancelled",
        platform: "5",
        isCancelled: true,
        cancelReason: "Operational incident",
        destination: [{ locationName: "Bedford", crs: "BDM" }],
      },
    ]);

    const live = await liveDeparture("LBG", "23:06", "BDM", "svc-cancelled");

    expect(live).not.toBeNull();
    expect(live?.status).toBe("cancelled");
    expect(live?.label).toBe("Cancelled");
    expect(live?.detail).toBe("Operational incident");
    expect(live?.platform).toBe("5");
  });
});

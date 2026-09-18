import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { liveDeparture } from "./darwin";

const originalKey = process.env.DARWIN_LDBWS_KEY;

function mockBoard(trainServices: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ trainServices }), {
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

  it.fails("reports a cross-midnight delay with the correct positive delay magnitude", async () => {
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

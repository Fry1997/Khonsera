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
        std: "23:58",
        etd: "00:05",
        platform: "2",
        destination: [{ locationName: "Derby", crs: "DBY" }],
      },
    ]);

    const live = await liveDeparture("WEL", "23:58", "DBY");

    expect(live).not.toBeNull();
    expect(live?.status).toBe("delayed");
    expect(live?.label).toBe("Now 00:05");
    expect(live?.detail).toContain("+7 min");
    expect(live?.detail).toContain("Platform 2");
  });

  it("does not warn about a same-platform train that is now expected to leave after the user's train", async () => {
    mockBoard([
      {
        std: "00:25",
        etd: "00:40",
        platform: "2",
        destination: [{ locationName: "Nottingham", crs: "NOT" }],
      },
      {
        std: "00:30",
        etd: "On time",
        platform: "2",
        destination: [{ locationName: "Derby", crs: "DBY" }],
      },
    ]);

    const live = await liveDeparture("WEL", "00:30", "DBY");

    expect(live).not.toBeNull();
    expect(live?.destination).toBe("Derby");
    expect(live?.earlierSamePlatform).toBeUndefined();
  });

  it("characterises the current amended-timetable gap: a booked minute no longer on the live board cannot be matched", async () => {
    // Real-world pattern seen on the 23:04 St Pancras -> Derby service during
    // engineering work: a normally earlier Wellingborough time was amended to
    // 00:30. Until a durable service identity is stored, exact-minute matching
    // cannot safely bridge this gap.
    mockBoard([
      {
        std: "00:30",
        etd: "On time",
        platform: "3",
        destination: [{ locationName: "Derby", crs: "DBY" }],
      },
    ]);

    const live = await liveDeparture("WEL", "00:22", "DBY");

    expect(live).toBeNull();
  });

  it("does not use the passenger hop destination as a final-destination tie-break", async () => {
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

    // LUT is an intermediate passenger stop on the London train, not its board
    // destination. Without durable service identity the collision is ambiguous.
    const live = await liveDeparture("WEL", "08:15", "LUT");

    expect(live).toBeNull();
  });

  it("uses an exact Darwin serviceID across a legitimate timetable amendment", async () => {
    mockBoard([
      {
        serviceID: "svc-target",
        rsid: "EM123400",
        std: "00:30",
        etd: "On time",
        platform: "3",
        destination: [{ locationName: "Derby", crs: "DBY" }],
      },
      {
        serviceID: "svc-other",
        std: "00:22",
        etd: "On time",
        platform: "2",
        destination: [{ locationName: "Corby", crs: "COR" }],
      },
    ]);

    const live = await liveDeparture("WEL", "00:22", "DBY", "svc-target");

    expect(live).not.toBeNull();
    expect(live?.serviceId).toBe("svc-target");
    expect(live?.rsid).toBe("EM123400");
    expect(live?.std).toBe("00:30");
    expect(live?.platform).toBe("3");
  });

  it("uses exact service identity when the passenger destination is only an intermediate stop", async () => {
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

    const live = await liveDeparture("WEL", "08:15", "LUT", "svc-london");

    expect(live).not.toBeNull();
    expect(live?.serviceId).toBe("svc-london");
    expect(live?.destination).toBe("London St Pancras");
    expect(live?.platform).toBe("2");
  });

  it("does not downgrade a known serviceID to a time-only guess when that ID is absent", async () => {
    mockBoard([
      {
        serviceID: "svc-other",
        std: "08:15",
        etd: "On time",
        platform: "1",
        destination: [{ locationName: "Corby", crs: "COR" }],
      },
    ]);

    const live = await liveDeparture("WEL", "08:15", "COR", "svc-target");

    expect(live).toBeNull();
  });
  it("refuses to guess when two services share the booked minute and no destination can disambiguate them", async () => {
    mockBoard([
      {
        std: "08:15",
        etd: "On time",
        platform: "1",
        destination: [{ locationName: "Corby", crs: "COR" }],
      },
      {
        std: "08:15",
        etd: "On time",
        platform: "2",
        destination: [{ locationName: "Derby", crs: "DBY" }],
      },
    ]);

    const live = await liveDeparture("WEL", "08:15");

    expect(live).toBeNull();
  });

  it("refuses to guess when destination was supplied but none of the same-minute services match it", async () => {
    mockBoard([
      {
        std: "08:15",
        etd: "On time",
        platform: "1",
        destination: [{ locationName: "Corby", crs: "COR" }],
      },
      {
        std: "08:15",
        etd: "On time",
        platform: "2",
        destination: [{ locationName: "Derby", crs: "DBY" }],
      },
    ]);

    const live = await liveDeparture("WEL", "08:15", "NOT");

    expect(live).toBeNull();
  });

  it("recognises the immediately preceding same-platform train across midnight", async () => {
    mockBoard([
      {
        std: "23:58",
        etd: "On time",
        platform: "2",
        destination: [{ locationName: "Nottingham", crs: "NOT" }],
      },
      {
        std: "00:05",
        etd: "On time",
        platform: "2",
        destination: [{ locationName: "Derby", crs: "DBY" }],
      },
    ]);

    const live = await liveDeparture("WEL", "00:05", "DBY");

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
        std: "00:15",
        etd: "On time",
        platform: "13R",
        destination: [{ locationName: "Ayr", crs: "AYR" }],
      },
    ]);

    const live = await liveDeparture("GLC", "00:15", "AYR");

    expect(live).not.toBeNull();
    expect(live?.platform).toBe("13R");
    expect(live?.detail).toContain("Platform 13R");
  });

  it("maps a cancelled service to an explicit cancelled state", async () => {
    mockBoard([
      {
        std: "23:06",
        etd: "Cancelled",
        platform: "5",
        isCancelled: true,
        cancelReason: "Operational incident",
        destination: [{ locationName: "Bedford", crs: "BDM" }],
      },
    ]);

    const live = await liveDeparture("LBG", "23:06", "BDM");

    expect(live).not.toBeNull();
    expect(live?.status).toBe("cancelled");
    expect(live?.label).toBe("Cancelled");
    expect(live?.detail).toBe("Operational incident");
    expect(live?.platform).toBe("5");
  });

});

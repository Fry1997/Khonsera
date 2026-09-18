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

  it.fails("does not warn about a same-platform train that is now expected to leave after the user's train", async () => {
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

  it("uses destination to disambiguate two services scheduled in the same minute when possible", async () => {
    mockBoard([
      {
        std: "08:15",
        etd: "On time",
        platform: "1",
        destination: [{ locationName: "Corby", crs: "COR" }],
      },
      {
        std: "08:15",
        etd: "08:18",
        platform: "2",
        destination: [{ locationName: "Derby", crs: "DBY" }],
      },
    ]);

    const live = await liveDeparture("WEL", "08:15", "DBY");

    expect(live).not.toBeNull();
    expect(live?.destination).toBe("Derby");
    expect(live?.platform).toBe("2");
    expect(live?.label).toBe("Now 08:18");
  });
  it.fails("refuses to guess when two services share the booked minute and no destination can disambiguate them", async () => {
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

  it.fails("refuses to guess when destination was supplied but none of the same-minute services match it", async () => {
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

  it.fails("recognises the immediately preceding same-platform train across midnight", async () => {
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

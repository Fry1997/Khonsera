const KEY = process.env.DARWIN_LDBWS_KEY ?? process.env.DARWIN_LDBWS_TOKEN;
const BASE =
  process.env.DARWIN_LDBWS_ENDPOINT ??
  "https://api1.raildata.org.uk/1010-live-departure-board-dep1_2/LDBWS/api/20220120";

const stations = ["WEL", "BDM", "STP", "GTW", "ECR"];

function slim(s) {
  return {
    std: s?.std ?? null,
    etd: s?.etd ?? null,
    platform: s?.platform ?? null,
    isCancelled: Boolean(s?.isCancelled),
    destination: Array.isArray(s?.destination)
      ? s.destination.map((d) => ({ name: d?.locationName ?? null, crs: d?.crs ?? null }))
      : [],
    serviceID: s?.serviceID ?? null,
    serviceId: s?.serviceId ?? null,
    rid: s?.rid ?? null,
    operatorCode: s?.operatorCode ?? null,
  };
}

if (!KEY) {
  console.log("RAIL_SHADOW " + JSON.stringify({ checkedAt: new Date().toISOString(), keyPresent: false }));
  process.exit(0);
}

for (const crs of stations) {
  try {
    const url = new URL(`${BASE}/GetDepartureBoard/${crs}`);
    url.searchParams.set("numRows", "20");
    url.searchParams.set("timeWindow", "240");
    const res = await fetch(url, {
      headers: { "x-apikey": KEY, accept: "application/json" },
    });
    const body = await res.json().catch(() => null);
    const services =
      body?.trainServices ??
      body?.GetStationBoardResult?.trainServices ??
      [];
    console.log(
      "RAIL_SHADOW " +
        JSON.stringify({
          checkedAt: new Date().toISOString(),
          crs,
          http: res.status,
          generatedAt: body?.generatedAt ?? body?.GetStationBoardResult?.generatedAt ?? null,
          locationName: body?.locationName ?? body?.GetStationBoardResult?.locationName ?? null,
          services: Array.isArray(services) ? services.slice(0, 12).map(slim) : [],
        }),
    );
  } catch (error) {
    console.log(
      "RAIL_SHADOW " +
        JSON.stringify({ checkedAt: new Date().toISOString(), crs, error: String(error) }),
    );
  }
}

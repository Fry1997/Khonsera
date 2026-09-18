const KEY = process.env.DARWIN_LDBWS_KEY ?? process.env.DARWIN_LDBWS_TOKEN;
const BASE =
  process.env.DARWIN_LDBWS_ENDPOINT ??
  "https://api1.raildata.org.uk/1010-live-departure-board-dep1_2/LDBWS/api/20220120";

const detailedStations = ["WEL", "BDM", "STP", "GTW", "ECR"];
const hazeStations = [
  "KGX", "EUS", "PAD", "VIC", "LBG", "WAT", "CLJ",
  "BHM", "MAN", "LDS", "YRK", "EDB", "GLC", "BRI",
  "RDG", "MKC", "LUT", "WEL", "BDM", "STP", "GTW", "ECR",
];

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
    operatorCode: s?.operatorCode ?? null,
    platformIsHidden: s?.platformIsHidden ?? null,
    serviceIsSuppressed: s?.serviceIsSuppressed ?? null,
  };
}

function ordinaryEtd(value) {
  return (
    value === "On time" ||
    value === "Cancelled" ||
    value === "Delayed" ||
    /^\d{1,2}:\d{2}\*?$/.test(String(value ?? ""))
  );
}

async function board(crs, numRows = 30) {
  const url = new URL(`${BASE}/GetDepartureBoard/${crs}`);
  url.searchParams.set("numRows", String(numRows));
  url.searchParams.set("timeWindow", "240");
  const res = await fetch(url, { headers: { "x-apikey": KEY, accept: "application/json" } });
  const body = await res.json().catch(() => null);
  return {
    http: res.status,
    generatedAt: body?.generatedAt ?? body?.GetStationBoardResult?.generatedAt ?? null,
    locationName: body?.locationName ?? body?.GetStationBoardResult?.locationName ?? null,
    services: body?.trainServices ?? body?.GetStationBoardResult?.trainServices ?? [],
  };
}

if (!KEY) {
  console.log("RAIL_SHADOW " + JSON.stringify({ checkedAt: new Date().toISOString(), keyPresent: false }));
  process.exit(0);
}

for (const crs of detailedStations) {
  try {
    const result = await board(crs, 20);
    console.log(
      "RAIL_SHADOW " +
        JSON.stringify({
          checkedAt: new Date().toISOString(),
          crs,
          http: result.http,
          generatedAt: result.generatedAt,
          locationName: result.locationName,
          services: Array.isArray(result.services) ? result.services.slice(0, 12).map(slim) : [],
        }),
    );
  } catch (error) {
    console.log("RAIL_SHADOW " + JSON.stringify({ checkedAt: new Date().toISOString(), crs, error: String(error) }));
  }
}

const findings = [];
let totalServices = 0;

for (const crs of hazeStations) {
  try {
    const result = await board(crs, 40);
    const services = Array.isArray(result.services) ? result.services : [];
    totalServices += services.length;

    const noPlatform = services.filter(
      (s) => !s?.isCancelled && !s?.platform && !s?.platformIsHidden && !s?.serviceIsSuppressed,
    );
    const hiddenPlatform = services.filter((s) => s?.platformIsHidden);
    const unusualStatus = services.filter((s) => !ordinaryEtd(s?.etd));

    const byMinute = new Map();
    for (const s of services) {
      if (!s?.std) continue;
      const bucket = byMinute.get(s.std) ?? [];
      bucket.push(s);
      byMinute.set(s.std, bucket);
    }
    const sameMinute = [...byMinute.entries()]
      .filter(([, rows]) => rows.length > 1)
      .map(([std, rows]) => ({ std, services: rows.map(slim) }));

    if (noPlatform.length || hiddenPlatform.length || unusualStatus.length || sameMinute.length) {
      findings.push({
        crs,
        locationName: result.locationName,
        generatedAt: result.generatedAt,
        noPlatform: noPlatform.slice(0, 5).map(slim),
        hiddenPlatform: hiddenPlatform.slice(0, 5).map(slim),
        unusualStatus: unusualStatus.slice(0, 5).map(slim),
        sameMinute: sameMinute.slice(0, 5),
      });
    }
  } catch (error) {
    findings.push({ crs, error: String(error) });
  }
}

console.log(
  "RAIL_HAZE " +
    JSON.stringify({
      checkedAt: new Date().toISOString(),
      stationsChecked: hazeStations.length,
      totalServices,
      findings,
    }),
);

const { liveDeparture, nextServicesTo } = await import("../src/lib/integrations/darwin.ts");

const checks = [
  { crs: "WEL", time: "01:23", dest: "COR", label: "Wellingborough → Corby" },
  { crs: "BDM", time: "02:14", dest: "TBD", label: "Bedford → Three Bridges" },
  { crs: "STP", time: "01:32", dest: "TBD", label: "St Pancras → Three Bridges" },
  { crs: "GTW", time: "01:23", dest: "TBD", label: "Gatwick → Three Bridges" },
  { crs: "ECR", time: "02:10", dest: "BDM", label: "East Croydon → Bedford" },
];

for (const check of checks) {
  try {
    const live = await liveDeparture(check.crs, check.time, check.dest);
    console.log("KHONSERA_RAIL " + JSON.stringify({
      checkedAt: new Date().toISOString(),
      ...check,
      live,
    }));
  } catch (error) {
    console.log("KHONSERA_RAIL " + JSON.stringify({
      checkedAt: new Date().toISOString(),
      ...check,
      error: String(error),
    }));
  }
}

for (const recovery of [
  { origin: "BDM", dest: "TBD", label: "Bedford → Three Bridges after 02:14 cancellation" },
  { origin: "GTW", dest: "BDM", label: "Gatwick → Bedford after 01:45 cancellation" },
  { origin: "ECR", dest: "BDM", label: "East Croydon → Bedford after 02:10 cancellation" },
]) {
  try {
    const services = await nextServicesTo(recovery.origin, recovery.dest, 8);
    console.log("KHONSERA_RECOVERY " + JSON.stringify({
      checkedAt: new Date().toISOString(),
      ...recovery,
      services,
    }));
  } catch (error) {
    console.log("KHONSERA_RECOVERY " + JSON.stringify({
      checkedAt: new Date().toISOString(),
      ...recovery,
      error: String(error),
    }));
  }
}

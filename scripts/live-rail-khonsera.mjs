const { liveDeparture } = await import("../src/lib/integrations/darwin.ts");

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
    console.log(
      "KHONSERA_RAIL " +
        JSON.stringify({
          checkedAt: new Date().toISOString(),
          ...check,
          live,
        }),
    );
  } catch (error) {
    console.log(
      "KHONSERA_RAIL " +
        JSON.stringify({ checkedAt: new Date().toISOString(), ...check, error: String(error) }),
    );
  }
}

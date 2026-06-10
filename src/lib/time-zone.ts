import { DISPLAY_TZ } from "@/components/concierge/types";

// Interpret a wall-clock `YYYY-MM-DD` + `HH:MM` as a time in the display
// timezone (Europe/London) and return the correct UTC ISO. Without this, the
// runtime (UTC on the server) treated typed times as UTC — so a 09:00 entry was
// stored an hour off and rendered wrong in BST. Standard offset trick; works on
// both server and client. Thread a per-workspace tz when multi-tz lands.
export function wallClockToIso(dateStr: string, hhmm: string, tz: string = DISPLAY_TZ): string {
  if (!dateStr || !hhmm) return "";
  const asUtc = new Date(`${dateStr}T${hhmm}:00Z`).getTime();
  if (Number.isNaN(asUtc)) return "";
  // How that instant reads in `tz` → the zone's offset at that moment.
  const local = new Date(new Date(asUtc).toLocaleString("en-US", { timeZone: tz })).getTime();
  const offset = local - asUtc;
  return new Date(asUtc - offset).toISOString();
}

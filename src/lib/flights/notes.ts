// Plain helpers shared between client + server. Lives outside the "use server"
// boundary in src/lib/actions/* so sync exports are allowed.
//
// We piggy-back the visit's free-form notes field for the flight IATA until
// flights graduate to their own first-class column. Format:
//   [flight] BA123
//   (rest of user's notes follow)

export const FLIGHT_NOTE_PREFIX = "[flight]";
export const FLIGHT_NOTE_RE = /\[flight\]\s*([A-Z0-9]+)/i;

export function extractFlightIataFromNotes(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(FLIGHT_NOTE_RE);
  return m ? m[1].toUpperCase() : null;
}

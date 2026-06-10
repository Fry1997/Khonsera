// Shared constants/types for the waitlist (importable from server actions,
// server components, and client components alike — no "use server" here).

export const WAITLIST_COOKIE = "khonsera_waitlist";

export type WaitlistResult =
  | { status: "joined" }
  | { status: "already" }
  | { status: "invalid"; message: string };

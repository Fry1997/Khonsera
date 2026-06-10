import type { CurrentUserContext } from "@/lib/auth";

// Landing+waitlist brief §4 — the post-auth access gate.
//
// "Gated to staff for now." Access is decided by the EXISTING identity flags,
// not a parallel auth system: a profile is approved for the app when it is
// staff or admin. Everyone else (a fresh waitlist signup who somehow has an
// account, an invited-but-not-yet-enabled traveller) lands on the gated
// thank-you screen until we open the doors.
//
// NOTE on membership_role: the brief frames this as a membership_role gate,
// but signup auto-provisions an owner membership for every account, so the
// role alone can't distinguish "approved" from "not yet". is_staff/is_admin is
// the honest signal while access is closed. When we open the doors, widen this
// predicate (e.g. an `approved` column or an allowlist) — it is the single
// chokepoint the whole app guards on.
export function isApproved(
  ctx: Pick<CurrentUserContext, "isStaff" | "isAdmin">,
): boolean {
  return ctx.isStaff || ctx.isAdmin;
}

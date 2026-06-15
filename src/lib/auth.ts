import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type AppMode } from "@/lib/mode";

export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export type WorkspaceRole = "company_admin" | "team_manager" | "traveller" | "owner" | "admin" | "member" | "viewer";

export type CurrentUserContext = {
  userId: string;
  email: string;
  fullName: string | null;
  isStaff: boolean;
  isAdmin: boolean;
  workspaceId: string;
  activeMode: AppMode;
  // The user's role in their default workspace — the RBAC handle (P17). Server
  // actions gate on this; never trust a client-sent role.
  role: WorkspaceRole;
};

export const requireUserContext = cache(
  async (): Promise<CurrentUserContext> => {
    const user = await requireUser();
    const supabase = await createClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, full_name, is_staff, is_admin, default_workspace_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || !profile.default_workspace_id) {
      // Profile not provisioned yet — shouldn't happen given the auth trigger,
      // but fail loudly rather than silently using a fake workspace.
      throw new Error("Profile not provisioned");
    }

    // Edition III D1: there is no work/personal toggle. The day is one unified
    // view; `activeMode` is the user's PRIMARY mode — derived from their default
    // workspace's nature — used only as the default tag on new items and the
    // Clients↔People nav variant, never as a visibility lens. The privacy
    // boundary stays enforced in the data layer (RLS, migration 0030).
    const { data: ws } = await supabase
      .from("workspaces")
      .select("type")
      .eq("id", profile.default_workspace_id)
      .maybeSingle();
    const primaryMode: AppMode = ws?.type === "organisation" ? "work" : "personal";

    const { data: membership } = await supabase
      .from("memberships")
      .select("role")
      .eq("workspace_id", profile.default_workspace_id)
      .eq("user_id", profile.id)
      .maybeSingle();

    return {
      userId: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      isStaff: profile.is_staff,
      isAdmin: profile.is_admin,
      workspaceId: profile.default_workspace_id,
      activeMode: primaryMode,
      role: (membership?.role as WorkspaceRole) ?? "traveller",
    };
  },
);

// RBAC (P17): roles that can manage a workspace — assign visits, approve trips +
// over-cap spend, review the team. Legacy owner/admin map to the manager tier.
const MANAGER_ROLES: ReadonlySet<WorkspaceRole> = new Set(["company_admin", "team_manager", "owner", "admin"]);
export function isManager(ctx: CurrentUserContext): boolean {
  return MANAGER_ROLES.has(ctx.role);
}
export async function requireManager(): Promise<CurrentUserContext> {
  const ctx = await requireUserContext();
  if (!isManager(ctx)) throw new Error("Not authorised — this needs a manager or admin role.");
  return ctx;
}
